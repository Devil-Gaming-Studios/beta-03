import React, { useState, useRef } from 'react';
import { store } from '../services/store';
import { CommunityPost, Recipe } from '../types';
import { shareNative, vibrateNative } from '../utils/nativeApp';

interface CommunityScreenProps {
  isHindi: boolean;
  onViewRecipe: (recipeId: string, servings: number) => void;
}

// Preset food photography options for quick testing or fallback
const PRESET_DISH_PHOTOS = [
  {
    name: 'Paneer Bhurji',
    url: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Dum Biryani',
    url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Dal Tadka',
    url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Kanda Poha',
    url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Chole Bhature',
    url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=800&auto=format&fit=crop&q=80',
  },
];

export const CommunityScreen: React.FC<CommunityScreenProps> = ({ isHindi, onViewRecipe }) => {
  const me = store.getMe();
  const currentUserId = me.user.id;
  const currentUserName = me.user.name || 'Home Cook';

  const [refreshKey, setRefreshKey] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Compose State
  const [caption, setCaption] = useState('');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedRecipe, setSelectedRecipe] = useState<{
    id: string;
    title: string;
    prepTime: number;
    dietTag: 'veg' | 'nonveg' | 'egg';
  } | null>(null);

  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const posts = store.getCommunityPosts();
  const allRecipes = store.getRecipes();

  // Extract recent planned or cooked meals for quick attachment suggestions
  const currentPlan = store.getPlan();
  const recentPlanMeals = currentPlan.meals
    .filter((m) => m.household_recipe_id)
    .slice(0, 4)
    .map((m) => {
      const rec = allRecipes.find((r) => r.id === m.household_recipe_id);
      return {
        id: m.household_recipe_id as string,
        title: (m.title || rec?.title || 'Planned Dish') as string,
        prepTime: rec ? 25 : 20,
        dietTag: (rec?.category === 'nonveg' ? 'nonveg' : 'veg') as 'veg' | 'nonveg' | 'egg',
      };
    });

  // Handle image upload with client-side canvas downsampling (max 1200px)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setSelectedImage(compressedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim() && !selectedImage) {
      showToast(isHindi ? 'कृपया फोटो जोड़ें या विवरण लिखें' : 'Please upload a photo or write a caption');
      return;
    }

    // Default image if only text provided
    const imageToUse =
      selectedImage ||
      PRESET_DISH_PHOTOS[Math.floor(Math.random() * PRESET_DISH_PHOTOS.length)].url;

    store.createCommunityPost({
      caption: caption.trim(),
      image_url: imageToUse,
      recipe_id: selectedRecipe?.id,
      recipe_title: selectedRecipe?.title,
      recipe_prep_time_mins: selectedRecipe?.prepTime,
      recipe_diet_tag: selectedRecipe?.dietTag,
    });

    setCaption('');
    setSelectedImage('');
    setSelectedRecipe(null);
    showToast(isHindi ? 'आपकी डिश कम्युनिटी में पोस्ट हो गई! ✨' : 'Your dish was posted to Community! ✨');
    setRefreshKey((k) => k + 1);
  };

  const handleToggleLike = (postId: string) => {
    vibrateNative(50);
    store.togglePostLike(postId);
    setRefreshKey((k) => k + 1);
  };

  const handleDeletePost = (postId: string) => {
    if (window.confirm(isHindi ? 'क्या आप इस पोस्ट को हटाना चाहते हैं?' : 'Delete this post from community?')) {
      store.deleteCommunityPost(postId);
      showToast(isHindi ? 'पोस्ट हटा दिया गया' : 'Post removed');
      setRefreshKey((k) => k + 1);
    }
  };

  const handleSharePost = async (post: CommunityPost) => {
    const shareText = `Check out ${post.author_name}'s dish on KitchenSync: "${post.caption}" ${post.recipe_title ? `(Recipe: ${post.recipe_title})` : ''}`;
    const shared = await shareNative(shareText, `${post.author_name}'s dish on KitchenSync`);
    if (shared) {
      showToast(isHindi ? 'शेयर किया गया / कॉपी हुआ!' : 'Shared / copied to clipboard!');
    }
  };

  // Time formatter
  const formatTimeAgo = (isoDate: string) => {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return isHindi ? 'अभी' : 'Just now';
    if (diffMins < 60) return `${diffMins}m ${isHindi ? 'पहले' : 'ago'}`;
    if (diffHours < 24) return `${diffHours}h ${isHindi ? 'पहले' : 'ago'}`;
    if (diffDays === 1) return isHindi ? 'कल' : 'Yesterday';
    return `${diffDays}d ${isHindi ? 'पहले' : 'ago'}`;
  };

  // Recipe Search Filtering
  const filteredRecipes = allRecipes.filter((r) =>
    r.title.toLowerCase().includes(recipeSearch.toLowerCase())
  );

  const displayedPosts = filterMode === 'mine' ? posts.filter((p) => p.author_id === currentUserId) : posts;

  return (
    <div key={refreshKey} className="max-w-xl mx-auto px-3 sm:px-4 pb-20 pt-1 flex flex-col gap-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#1A3826] text-white px-4 py-2.5 rounded-2xl text-[13px] font-semibold flex items-center gap-2 shadow-lg animate-fade-in border border-[#c8ebd1]/30">
          <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Community Screen Header */}
      <div className="flex items-center justify-between py-2 border-b border-[#E6E4DD]">
        <div>
          <h1 className="text-[20px] font-bold text-[#1a1c1a] tracking-tight flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[22px] text-[#1A3826]">forum</span>
            <span>{isHindi ? 'कुक कम्युनिटी' : 'Cook Community'}</span>
          </h1>
          <p className="text-[12px] text-[#727972]">
            {isHindi
              ? 'बनाए गए व्यंजनों की तस्वीरें साझा करें और अन्य घरों की डिशेज देखें'
              : 'Share photos of what you cooked & borrow recipes from fellow cooks'}
          </p>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center bg-[#eeece5] p-1 rounded-xl text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              filterMode === 'all' ? 'bg-white text-[#1a1c1a] shadow-xs' : 'text-[#727972]'
            }`}
          >
            {isHindi ? 'सभी' : 'All'}
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('mine')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              filterMode === 'mine' ? 'bg-white text-[#1a1c1a] shadow-xs' : 'text-[#727972]'
            }`}
          >
            {isHindi ? 'मेरी पोस्ट' : 'My Posts'}
          </button>
        </div>
      </div>

      {/* COMPOSE THREAD CARD */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1A3826] text-white flex items-center justify-center font-bold text-sm shrink-0">
            {currentUserName.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 flex flex-col gap-2">
            <textarea
              rows={2}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={
                isHindi
                  ? 'आज आपने क्या बनाया? स्वाद या सुझाव साझा करें...'
                  : 'What did you cook today? Share your thoughts, tips or tasting notes...'
              }
              className="w-full text-[13.5px] text-[#1a1c1a] placeholder:text-[#93a0b4] resize-none focus:outline-none bg-transparent"
            />

            {/* Selected Image Thumbnail Preview */}
            {selectedImage && (
              <div className="relative rounded-xl overflow-hidden border border-[#E6E4DD] max-h-56 bg-black/5 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Dish preview"
                  className="w-full h-48 object-cover rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setSelectedImage('')}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                  title="Remove image"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}

            {/* Attached Recipe Card in Composer */}
            {selectedRecipe && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#1A3826]">
                    soup_kitchen
                  </span>
                  <div>
                    <div className="font-bold text-[#1a1c1a]">{selectedRecipe.title}</div>
                    <div className="text-[10.5px] text-[#727972] flex items-center gap-1">
                      <span>⏱ {selectedRecipe.prepTime} min</span>
                      <span>·</span>
                      <span className={selectedRecipe.dietTag === 'veg' ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                        {selectedRecipe.dietTag === 'veg' ? 'Pure Veg' : 'Non-Veg'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRecipe(null)}
                  className="text-[#727972] hover:text-[#1a1c1a] p-1 cursor-pointer"
                  title="Remove recipe link"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}

            {/* Compose Actions Toolbar */}
            <div className="flex items-center justify-between pt-2 border-t border-[#F0EFEA] gap-2">
              <div className="flex items-center gap-1.5">
                {/* Photo upload trigger */}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-xl border border-[#E6E4DD] text-[11.5px] font-semibold text-[#424843] hover:text-[#1A3826] hover:bg-[#FAF9F6] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#1A3826]">
                    photo_camera
                  </span>
                  <span>{selectedImage ? (isHindi ? 'फोटो बदलें' : 'Change') : (isHindi ? 'फोटो' : 'Photo')}</span>
                </button>

                {/* Attach Recipe Button */}
                <button
                  type="button"
                  onClick={() => setShowRecipePicker(true)}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11.5px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                    selectedRecipe
                      ? 'border-[#1A3826] bg-[#1A3826]/10 text-[#1A3826]'
                      : 'border-[#E6E4DD] text-[#424843] hover:text-[#1A3826] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    menu_book
                  </span>
                  <span>
                    {selectedRecipe
                      ? (isHindi ? 'रेसिपी जुड़ी है' : 'Recipe Attached')
                      : (isHindi ? 'रेसिपी जोड़ें' : 'Attach Recipe')}
                  </span>
                </button>
              </div>

              {/* Submit Post Button */}
              <button
                type="button"
                onClick={handlePublish}
                disabled={!caption.trim() && !selectedImage}
                className="px-4 py-1.5 rounded-xl bg-[#1A3826] disabled:opacity-40 hover:bg-[#142d1e] text-white text-[12px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
              >
                <span>{isHindi ? 'पोस्ट करें' : 'Post Dish'}</span>
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FEED LIST */}
      <div className="flex flex-col gap-4">
        {displayedPosts.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-[#E6E4DD] text-center text-[#727972] text-[13px] flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[36px] text-gray-300">
              local_dining
            </span>
            <span className="font-bold text-[#1a1c1a]">
              {isHindi ? 'अभी कोई पोस्ट नहीं है' : 'No Community Posts Yet'}
            </span>
            <p className="text-[12px] max-w-xs">
              {isHindi
                ? 'अपने द्वारा पकाए गए खाने की तस्वीर खींचकर ऊपर दिए गए बॉक्स से पोस्ट करें!'
                : 'Be the first to share a cooked dish! Snap a photo and post it to inspire your household.'}
            </p>
          </div>
        ) : (
          displayedPosts.map((post) => (
            <article
              key={post.id}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E6E4DD] shadow-2xs flex flex-col gap-3 transition-all hover:border-[#1A3826]/30"
            >
              {/* Post Author Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {post.author_avatar ? (
                    <img
                      src={post.author_avatar}
                      alt={post.author_name}
                      className="w-9 h-9 rounded-full object-cover border border-[#E6E4DD]"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#1A3826] text-white flex items-center justify-center font-bold text-xs">
                      {post.author_name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <div className="font-bold text-[13.5px] text-[#1a1c1a] leading-tight">
                      {post.author_name}
                    </div>
                    <div className="text-[11px] text-[#727972] flex items-center gap-1.5 mt-0.5">
                      <span>{formatTimeAgo(post.created_at)}</span>
                      <span>·</span>
                      <span>{isHindi ? 'होममेड डिश' : 'Cooked in Kitchen'}</span>
                    </div>
                  </div>
                </div>

                {/* Delete button for author */}
                {post.author_id === currentUserId && (
                  <button
                    type="button"
                    onClick={() => handleDeletePost(post.id)}
                    className="text-[#727972] hover:text-[#9E2A2B] p-1 rounded-lg transition-colors cursor-pointer"
                    title={isHindi ? 'पोस्ट हटाएं' : 'Delete post'}
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                )}
              </div>

              {/* Caption Text */}
              {post.caption && (
                <p className="text-[13.5px] text-[#1a1c1a] leading-relaxed whitespace-pre-wrap">
                  {post.caption}
                </p>
              )}

              {/* Dish Photo */}
              {post.image_url && (
                <div
                  className="rounded-xl overflow-hidden border border-[#E6E4DD] bg-[#FAF9F6] cursor-pointer group"
                  onClick={() => setExpandedImage(post.image_url)}
                >
                  <img
                    src={post.image_url}
                    alt={post.recipe_title || 'Cooked dish'}
                    loading="lazy"
                    className="w-full max-h-96 object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                  />
                </div>
              )}

              {/* Embedded In-App Recipe Preview Card (One-Tap View) */}
              {post.recipe_id && (
                <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] flex items-center justify-between gap-3 hover:border-[#1A3826]/40 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-[#1A3826]/10 text-[#1A3826] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">
                        menu_book
                      </span>
                    </span>

                    <div className="min-w-0">
                      <div className="text-[10px] text-[#727972] uppercase font-bold tracking-wider">
                        {isHindi ? 'उपयोग की गई रेसिपी' : 'Recipe Used from KitchenSync'}
                      </div>
                      <div className="font-bold text-[13px] text-[#1a1c1a] truncate">
                        {post.recipe_title}
                      </div>
                      {post.recipe_prep_time_mins && (
                        <div className="text-[10.5px] text-[#727972] flex items-center gap-1.5">
                          <span>⏱ {post.recipe_prep_time_mins} min</span>
                          <span>·</span>
                          <span className={post.recipe_diet_tag === 'veg' ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                            {post.recipe_diet_tag === 'veg' ? 'Vegetarian' : 'Non-Vegetarian'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onViewRecipe(post.recipe_id!, 2)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#E6E4DD] text-[11.5px] font-bold text-[#1A3826] hover:bg-[#1A3826] hover:text-white transition-all shrink-0 flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <span>{isHindi ? 'रेसिपी देखें' : 'View Recipe'}</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              )}

              {/* Interactions Bar (Like & Share) */}
              <div className="flex items-center justify-between pt-2 border-t border-[#F0EFEA] text-[12px]">
                <button
                  type="button"
                  onClick={() => handleToggleLike(post.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    post.liked_by_me
                      ? 'text-[#E11D48] bg-rose-50 font-bold'
                      : 'text-[#424843] hover:text-[#1a1c1a] hover:bg-gray-50'
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[19px]"
                    style={post.liked_by_me ? { fontVariationSettings: "'FILL' 1" } : {}}
                  >
                    favorite
                  </span>
                  <span className="tabular-nums font-semibold">{post.likes_count}</span>
                  <span className="text-[11px] font-normal">
                    {post.likes_count === 1 ? 'like' : 'likes'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSharePost(post)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[#424843] hover:text-[#1a1c1a] hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px]">share</span>
                  <span>{isHindi ? 'शेयर' : 'Share'}</span>
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {/* RECIPE PICKER MODAL */}
      {showRecipePicker && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-5 flex flex-col gap-3 shadow-xl max-h-[85vh]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E6E4DD]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#1A3826]">
                  menu_book
                </span>
                <h3 className="text-[15px] font-bold text-[#1a1c1a]">
                  {isHindi ? 'रेसिपी चुनें' : 'Attach a Recipe from KitchenSync'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRecipePicker(false)}
                className="text-[#727972] hover:text-[#1a1c1a] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Quick Suggestions from Meal Planner */}
            {recentPlanMeals.length > 0 && !recipeSearch && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10.5px] font-bold text-[#727972] uppercase tracking-wider">
                  {isHindi ? 'आज के प्लान में से चुनें:' : 'Recently Planned Dishes:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {recentPlanMeals.map((m, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedRecipe(m);
                        setShowRecipePicker(false);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#FAF9F6] hover:bg-[#E8F0EC] border border-[#E6E4DD] hover:border-[#1A3826] text-[11.5px] font-semibold text-[#1a1c1a] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px] text-[#1A3826]">
                        add
                      </span>
                      <span>{m.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Input */}
            <div className="relative mt-1">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#727972]">
                search
              </span>
              <input
                type="text"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                placeholder={isHindi ? 'सभी रेसिपी में खोजें...' : 'Search all recipes...'}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[12.5px] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
              />
            </div>

            {/* Recipe List */}
            <div className="flex-1 overflow-y-auto max-h-64 divide-y divide-[#F0EFEA] border border-[#E6E4DD] rounded-xl">
              {filteredRecipes.slice(0, 30).map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => {
                    setSelectedRecipe({
                      id: recipe.id,
                      title: recipe.title,
                      prepTime: 25,
                      dietTag: (recipe.category === 'nonveg' ? 'nonveg' : 'veg') as 'veg' | 'nonveg' | 'egg',
                    });
                    setShowRecipePicker(false);
                  }}
                  className="w-full text-left p-2.5 hover:bg-[#FAF9F6] flex items-center justify-between text-[12px] transition-colors cursor-pointer group"
                >
                  <div>
                    <div className="font-bold text-[#1a1c1a] group-hover:text-[#1A3826]">
                      {recipe.title}
                    </div>
                    <div className="text-[10.5px] text-[#727972]">
                      {recipe.category || 'Regular'} · {recipe.base_servings || 2} servings
                    </div>
                  </div>

                  <span className="text-[11px] text-[#1A3826] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    Select +
                  </span>
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#E6E4DD]">
              <button
                type="button"
                onClick={() => setShowRecipePicker(false)}
                className="px-4 py-1.5 rounded-xl border border-[#E6E4DD] text-[12px] font-semibold text-[#424843] hover:bg-gray-50 cursor-pointer"
              >
                {isHindi ? 'रद्द करें' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE LIGHTBOX */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-fade-in"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] flex items-center justify-center">
            <img
              src={expandedImage}
              alt="Cooked dish fullscreen"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setExpandedImage(null)}
              className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
