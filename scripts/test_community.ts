import { store } from '../src/services/store.js';

async function testCommunityFeed() {
  console.log('--- Testing Community Feed Feature ---');
  
  // 1. Initial posts check
  const initialPosts = store.getCommunityPosts();
  console.log(`Initial posts loaded: ${initialPosts.length}`);
  if (initialPosts.length < 4) {
    throw new Error(`Expected at least 4 seed community posts, got ${initialPosts.length}`);
  }
  
  const firstPost = initialPosts[0];
  console.log(`First post by ${firstPost.author_name}: "${firstPost.caption.substring(0, 30)}..."`);
  console.log(`Recipe attached: ${firstPost.recipe_title} (ID: ${firstPost.recipe_id})`);
  
  // 2. Test Like functionality
  const initialLikes = firstPost.likes_count;
  const initialLikedStatus = firstPost.liked_by_me;
  
  const likedResult = store.togglePostLike(firstPost.id);
  console.log(`Toggled like: liked=${likedResult.liked}, count=${likedResult.likesCount}`);
  if (likedResult.liked === initialLikedStatus) {
    throw new Error('Liked status did not toggle');
  }
  if (likedResult.liked && likedResult.likesCount !== initialLikes + 1) {
    throw new Error('Like count did not increment');
  }
  
  // Toggle back
  const unlikedResult = store.togglePostLike(firstPost.id);
  console.log(`Toggled back: liked=${unlikedResult.liked}, count=${unlikedResult.likesCount}`);
  if (unlikedResult.liked !== initialLikedStatus) {
    throw new Error('Unliking did not return to original status');
  }
  
  // 3. Test Create Post
  const newPost = store.createCommunityPost({
    author_id: 'user_test_123',
    author_name: 'Test Chef Vikram',
    author_avatar: '👨‍🍳',
    caption: 'Made a fresh pot of Matar Paneer with warm homemade phulkas! Came out super fragrant.',
    image_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect fill="%23f97316" width="400" height="400"/></svg>',
    recipe_id: 'rec_paneer_01',
    recipe_title: 'Paneer Butter Masala',
    recipe_prep_time_mins: 35,
    recipe_diet_tag: 'veg'
  });
  
  console.log(`Created new post id: ${newPost.id}`);
  const postsAfterCreate = store.getCommunityPosts();
  if (postsAfterCreate[0].id !== newPost.id) {
    throw new Error('New post is not at the top of the feed');
  }
  
  // 4. Test Delete Post
  store.deleteCommunityPost(newPost.id);
  const postsAfterDelete = store.getCommunityPosts();
  if (postsAfterDelete.some(p => p.id === newPost.id)) {
    throw new Error('Failed to delete post');
  }
  console.log('Post deleted successfully');
  
  console.log('✅ ALL COMMUNITY FEED TESTS PASSED!');
}

testCommunityFeed().catch(err => {
  console.error('❌ Community Feed Test Failed:', err);
  process.exit(1);
});
