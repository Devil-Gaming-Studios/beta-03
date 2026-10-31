import React, { useState, useEffect, useRef } from 'react';
import { store } from '../services/store';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsIngested: () => void;
  isHindi: boolean;
  initialMode?: 'receipt' | 'fridge';
}

export interface ScannedItem {
  name: string;
  name_hi?: string;
  rawLineText?: string;
  price?: string;
  qty_base: number;
  unit_base: 'g' | 'ml' | 'pcs';
  location: 'pantry' | 'fridge';
  targetScope: 'personal' | 'shared';
  confidence?: number;
  is_estimate?: boolean;
}

interface ScanMetadata {
  merchantOrSource: string;
  billDate: string;
  totalAmount: string;
  rawTextSummary: string;
  engine: string;
}

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  onItemsIngested,
  isHindi,
  initialMode = 'receipt',
}) => {
  const [scanType, setScanType] = useState<'receipt' | 'fridge'>(initialMode);
  const [isScanning, setIsScanning] = useState(false);
  const [items, setItems] = useState<ScannedItem[] | null>(null);
  const [scanMeta, setScanMeta] = useState<ScanMetadata | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setScanType(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    const handlePaste = (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;
      for (let i = 0; i < clipboardItems.length; i++) {
        if (clipboardItems[i].type.startsWith('image/')) {
          const blob = clipboardItems[i].getAsFile();
          if (blob) {
            processImageFile(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
      stopCamera();
    };
  }, [isOpen, scanType]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const startCamera = async () => {
    setErrorMessage(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not available in this browser frame.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err: any) {
      setIsCameraOpen(false);
      setErrorMessage(
        'Live camera preview could not open in the embedded frame. Use "Upload or Choose Photo" below (or open the app in a new tab for live camera).'
      );
    }
  };

  const captureCameraFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const maxDim = 1600;
    let width = video.videoWidth || 1280;
    let height = video.videoHeight || 720;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      stopCamera();
      setImagePreview(dataUrl);
      runScan(scanType, dataUrl, 'image/jpeg');
    }
  };

  const compressAndReadImage = (file: File): Promise<{ dataUrl: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.onload = () => {
        const rawDataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = 1600;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.88);
            resolve({ dataUrl: compressed, mimeType: 'image/jpeg' });
          } else {
            resolve({ dataUrl: rawDataUrl, mimeType: file.type || 'image/jpeg' });
          }
        };
        img.onerror = () => {
          resolve({ dataUrl: rawDataUrl, mimeType: file.type || 'image/jpeg' });
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const processImageFile = async (file: File) => {
    setErrorMessage(null);
    setItems(null);
    setScanMeta(null);
    try {
      const { dataUrl, mimeType } = await compressAndReadImage(file);
      setImagePreview(dataUrl);
      await runScan(scanType, dataUrl, mimeType);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not read the selected image.');
    }
  };

  const runScan = async (type: 'receipt' | 'fridge', base64DataUrl: string, mimeType = 'image/jpeg') => {
    setIsScanning(true);
    setErrorMessage(null);
    setStatusMessage(
      type === 'receipt'
        ? 'Running Gemini Vision OCR on receipt lines & quantities...'
        : 'Analyzing fridge/pantry photo with Gemini Vision...'
    );

    try {
      const res = await fetch('/api/vision/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: type,
          imageBase64: base64DataUrl,
          mimeType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Scan failed with status ${res.status}`);
      }

      setItems(Array.isArray(data.items) ? data.items : []);
      setScanMeta({
        merchantOrSource: data.merchantOrSource || (type === 'receipt' ? 'Scanned Receipt' : 'Kitchen Photo'),
        billDate: data.billDate || '',
        totalAmount: data.totalAmount || '',
        rawTextSummary: data.rawTextSummary || '',
        engine: data.engine || 'gemini-3.8-flash',
      });
      setStatusMessage(null);
    } catch (err: any) {
      console.error('OCR Scan error:', err);
      setErrorMessage(err.message || 'Failed to analyze image with Gemini Vision.');
      setStatusMessage(null);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  };

  const handleToggleScope = (index: number) => {
    if (!items) return;
    const updated = [...items];
    updated[index].targetScope = updated[index].targetScope === 'personal' ? 'shared' : 'personal';
    setItems(updated);
  };

  const handleToggleLocation = (index: number) => {
    if (!items) return;
    const updated = [...items];
    updated[index].location = updated[index].location === 'fridge' ? 'pantry' : 'fridge';
    setItems(updated);
  };

  const handleUpdateName = (index: number, newName: string) => {
    if (!items) return;
    const updated = [...items];
    updated[index].name = newName;
    setItems(updated);
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (!items) return;
    const updated = [...items];
    updated[index].qty_base = Math.max(1, newQty);
    setItems(updated);
  };

  const handleUpdateUnit = (index: number, newUnit: 'g' | 'ml' | 'pcs') => {
    if (!items) return;
    const updated = [...items];
    updated[index].unit_base = newUnit;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    if (!items) return;
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated);
  };

  const handleAddBlankItem = () => {
    const next: ScannedItem = {
      name: 'New Kitchen Item',
      qty_base: 500,
      unit_base: 'g',
      location: 'pantry',
      targetScope: 'shared',
    };
    setItems((prev) => [...(prev || []), next]);
  };

  const handleResetScan = () => {
    stopCamera();
    setItems(null);
    setScanMeta(null);
    setImagePreview(null);
    setErrorMessage(null);
  };

  const handleConfirmAndSave = () => {
    if (!items || items.length === 0) return;
    store.ingestScannedItems(items);
    onItemsIngested();
    handleResetScan();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-2xl border border-[#E6E4DD] max-h-[94vh] overflow-y-auto flex flex-col gap-3.5 sm:gap-4 text-[#1a1c1a]"
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-2.5 sm:pb-3 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E8F0EC] text-[#1A3826] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px] sm:text-[22px]">document_scanner</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-[15px] sm:text-[17px] font-bold text-[#1a1c1a] truncate">
                  {isHindi ? 'रियल AI रसीद व फ्रिज स्कैनर' : 'Real Gemini Vision OCR'}
                </h3>
                <span className="px-1.5 py-0.5 rounded-full bg-[#E8F0EC] text-[#137333] text-[9.5px] sm:text-[10px] font-bold border border-[#137333]/20 shrink-0">
                  Live OCR
                </span>
              </div>
              <p className="text-[11px] text-[#424843]">
                {isHindi
                  ? 'असली किराना बिल या फ्रिज की फोटो अपलोड करें'
                  : 'Upload, paste (Ctrl+V), or snap a real receipt or fridge photo'}
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#424843] hover:bg-[#eeeeea] cursor-pointer"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scan Type Picker */}
        {!items && !isScanning && (
          <div className="flex flex-col gap-3.5">
            <div className="flex rounded-2xl bg-[#f4f4f0] p-1 border border-[#E6E4DD]">
              <button
                type="button"
                className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  scanType === 'receipt'
                    ? 'bg-[#1A3826] text-white shadow-xs'
                    : 'text-[#424843] hover:text-[#1a1c1a]'
                }`}
                onClick={() => setScanType('receipt')}
              >
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                {isHindi ? 'किराना रसीद (Receipt OCR)' : 'Grocery Receipt OCR'}
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  scanType === 'fridge'
                    ? 'bg-[#1A3826] text-white shadow-xs'
                    : 'text-[#424843] hover:text-[#1a1c1a]'
                }`}
                onClick={() => setScanType('fridge')}
              >
                <span className="material-symbols-outlined text-[18px]">kitchen</span>
                {isHindi ? 'फ्रिज / पैंट्री फोटो' : 'Fridge / Shelf Photo'}
              </button>
            </div>

            {/* Live Camera Viewfinder if active */}
            {isCameraOpen ? (
              <div className="flex flex-col gap-2.5 bg-black rounded-2xl overflow-hidden p-2 border border-[#E6E4DD]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 object-cover rounded-xl bg-black"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={captureCameraFrame}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#1A3826] text-white text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#132a1d]"
                  >
                    <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                    <span>Capture &amp; Run OCR</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="py-2.5 px-3 rounded-xl bg-white/15 text-white text-[12px] font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Dropzone + Upload / Camera Triggers */
              <div className="border-2 border-dashed border-[#c2c8c1] hover:border-[#1A3826] rounded-2xl p-5 bg-[#faf9f6] flex flex-col items-center text-center gap-3 transition-colors">
                <div className="w-12 h-12 rounded-full bg-[#E8F0EC] text-[#1A3826] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[26px]">
                    {scanType === 'receipt' ? 'receipt_long' : 'add_a_photo'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[14px] font-bold text-[#1a1c1a]">
                    {scanType === 'receipt'
                      ? 'Upload or Paste a Grocery Receipt / Bill'
                      : 'Upload or Paste a Fridge / Pantry Photo'}
                  </span>
                  <span className="text-[12px] text-[#424843] max-w-sm">
                    {scanType === 'receipt'
                      ? 'Supports Blinkit, Zepto, Swiggy Instamart, DMart, BigBasket screenshots, paper bills, or handwritten lists. You can also press Ctrl+V / Cmd+V to paste an image.'
                      : 'Upload a photo of your open fridge, vegetable basket, or pantry shelf. Gemini Vision detects items and estimates quantities.'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full pt-1">
                  <label className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-[#1A3826] text-white text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all hover:bg-[#132a1d] shadow-xs">
                    <span className="material-symbols-outlined text-[20px]">upload_file</span>
                    <span>{isHindi ? 'फ़ोटो चुनें (Upload Image)' : 'Choose / Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={isScanning}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-white border border-[#E6E4DD] text-[#1a1c1a] text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-[#f4f4f0]"
                  >
                    <span className="material-symbols-outlined text-[20px] text-[#1A3826]">photo_camera</span>
                    <span>{isHindi ? 'कैमरा खोलें' : 'Use Camera'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-3 bg-[#ffdad6]/70 border border-[#ba1a1a]/30 rounded-xl text-[12px] text-[#93000a] flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-[#93000a] hover:opacity-75 shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
            {imagePreview && !isScanning && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => runScan(scanType, imagePreview)}
                  className="px-3 py-1 rounded-lg bg-[#93000a] text-white text-[11px] font-bold cursor-pointer"
                >
                  Retry OCR Scan
                </button>
                <button
                  type="button"
                  onClick={handleResetScan}
                  className="px-3 py-1 rounded-lg bg-white border border-[#93000a]/30 text-[#93000a] text-[11px] font-semibold cursor-pointer"
                >
                  Upload Another Photo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading Spinner with Uploaded Image Preview */}
        {isScanning && (
          <div className="p-6 text-center flex flex-col items-center justify-center gap-3 bg-[#faf9f6] rounded-2xl border border-[#E6E4DD]">
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Scanning preview"
                className="w-28 h-28 object-cover rounded-xl border border-[#E6E4DD] shadow-xs opacity-80"
              />
            )}
            <span className="w-8 h-8 border-3 border-[#1A3826] border-t-transparent rounded-full animate-spin"></span>
            <span className="text-[13px] font-semibold text-[#1a1c1a]">{statusMessage}</span>
            <span className="text-[11px] text-[#727972]">
              Extracting item names, weights/volumes, and storage locations...
            </span>
          </div>
        )}

        {/* Confirm-and-Edit Screen */}
        {items && !isScanning && (
          <div className="flex flex-col gap-3">
            {/* Image + Extracted Receipt Metadata Header */}
            <div className="bg-[#FAF6F0] p-3 rounded-2xl border border-[#E9E1D6] flex items-start gap-3">
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Scanned source"
                  className="w-16 h-16 object-cover rounded-xl border border-[#E6E4DD] shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[14px] font-bold text-[#1a1c1a] truncate">
                    {scanMeta?.merchantOrSource || 'OCR Results'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#E8F0EC] text-[#1E4620] text-[10.5px] font-bold">
                    {items.length} {items.length === 1 ? 'item' : 'items'} extracted
                  </span>
                </div>
                {(scanMeta?.billDate || scanMeta?.totalAmount) && (
                  <div className="flex items-center gap-2 text-[11.5px] text-[#B45309] font-semibold mt-0.5">
                    {scanMeta.billDate && <span>📅 {scanMeta.billDate}</span>}
                    {scanMeta.totalAmount && <span>• Total: {scanMeta.totalAmount}</span>}
                  </div>
                )}
                {scanMeta?.rawTextSummary && (
                  <p className="text-[11.5px] text-[#424843] mt-1 line-clamp-2">
                    {scanMeta.rawTextSummary}
                  </p>
                )}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-6 text-center bg-[#faf9f6] rounded-2xl border border-[#E6E4DD] flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-[28px] text-[#B45309]">search_off</span>
                <p className="text-[13.5px] font-bold text-[#1a1c1a]">
                  No grocery or food items detected in this image
                </p>
                <p className="text-[12px] text-[#424843]">
                  Try uploading a clearer photo of a grocery receipt or fridge shelf, or add an item manually below.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleResetScan}
                    className="px-3.5 py-2 rounded-xl bg-[#1A3826] text-white text-[12px] font-semibold cursor-pointer"
                  >
                    Scan Another Image
                  </button>
                  <button
                    type="button"
                    onClick={handleAddBlankItem}
                    className="px-3.5 py-2 rounded-xl bg-white border border-[#E6E4DD] text-[#1a1c1a] text-[12px] font-semibold cursor-pointer"
                  >
                    + Add Item Manually
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-[12px] text-[#424843]">
                  <span>
                    Review &amp; edit extracted items before adding to stock:
                  </span>
                  <button
                    type="button"
                    onClick={handleAddBlankItem}
                    className="text-[#1A3826] font-bold hover:underline cursor-pointer"
                  >
                    + Add Row
                  </button>
                </div>

                <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateName(idx, e.target.value)}
                            className="w-full text-[13px] font-bold text-[#1a1c1a] bg-white px-2 py-1 rounded-lg border border-[#E6E4DD] focus:outline-none focus:border-[#1A3826]"
                          />
                          {(item.rawLineText || item.name_hi || item.price) && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[11px] text-[#727972]">
                              {item.name_hi && <span className="font-medium text-[#424843]">{item.name_hi}</span>}
                              {item.rawLineText && <span>• OCR: "{item.rawLineText}"</span>}
                              {item.price && <span className="font-semibold text-[#1A3826]">• {item.price}</span>}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className="text-[#727972] hover:text-[#9E2A2B] p-1 shrink-0 cursor-pointer"
                          onClick={() => handleRemoveItem(idx)}
                          title="Remove item"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-[#E6E4DD]/60">
                        {/* Quantity & Unit Controls */}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            value={item.qty_base}
                            onChange={(e) => handleUpdateQty(idx, parseFloat(e.target.value) || 1)}
                            className="w-20 px-2 py-1 rounded-lg border border-[#E6E4DD] bg-white text-[12px] font-bold text-center"
                          />
                          <select
                            value={item.unit_base}
                            onChange={(e) => handleUpdateUnit(idx, e.target.value as 'g' | 'ml' | 'pcs')}
                            className="px-2 py-1 rounded-lg border border-[#E6E4DD] bg-white text-[12px] font-semibold"
                          >
                            <option value="g">g</option>
                            <option value="ml">ml</option>
                            <option value="pcs">pcs</option>
                          </select>
                        </div>

                        {/* Storage Location & Personal/Shared Scope Toggles */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleLocation(idx)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer ${
                              item.location === 'fridge'
                                ? 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]'
                                : 'bg-[#F4F4F0] text-[#525252] border-[#E6E4DD]'
                            }`}
                            title="Toggle Fridge vs Pantry"
                          >
                            {item.location === 'fridge' ? '❄️ Fridge' : '🌾 Pantry'}
                          </button>

                          <button
                            type="button"
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border cursor-pointer ${
                              item.targetScope === 'personal'
                                ? 'bg-[#E8F0EC] text-[#1E4620] border-[#D1E2D7]'
                                : 'bg-[#F2ECE1] text-[#B45309] border-[#E9E1D6]'
                            }`}
                            onClick={() => handleToggleScope(idx)}
                            title="Toggle Personal vs Shared scope"
                          >
                            {item.targetScope === 'personal' ? '👤 Personal' : '👥 Shared'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Modal Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#E6E4DD]">
                  <button
                    type="button"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#1A3826] text-white text-[13px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5 hover:bg-[#132a1d] cursor-pointer"
                    onClick={handleConfirmAndSave}
                  >
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>
                      {isHindi
                        ? `${items.length} आइटम स्टॉक में जोड़ें`
                        : `Confirm & Add ${items.length} Items to Stock`}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="py-2.5 px-3 rounded-xl bg-white border border-[#E6E4DD] text-[#424843] text-[13px] font-medium hover:bg-[#f4f4f0] cursor-pointer"
                    onClick={handleResetScan}
                  >
                    Scan New
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
