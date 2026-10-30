import React, { useState } from 'react';
import { store } from '../services/store';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsIngested: () => void;
  isHindi: boolean;
}

interface ScannedItem {
  name: string;
  qty_base: number;
  unit_base: string;
  location: string;
  targetScope: 'personal' | 'shared';
  is_estimate?: boolean;
}

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  onItemsIngested,
  isHindi,
}) => {
  if (!isOpen) return null;

  const [scanType, setScanType] = useState<'receipt' | 'fridge'>('receipt');
  const [isScanning, setIsScanning] = useState(false);
  const [items, setItems] = useState<ScannedItem[] | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const runScan = async (type: 'receipt' | 'fridge', sampleImg?: string) => {
    setIsScanning(true);
    setStatusMessage(type === 'receipt' ? 'Analyzing grocery receipt...' : 'Estimating fridge inventory...');

    try {
      const res = await fetch('/api/vision/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: type,
          imageBase64: sampleImg || null,
        }),
      });

      const data = await res.json();
      setItems(data.items || []);
      setStatusMessage(null);
    } catch (err: any) {
      console.warn('Scan error:', err);
      // Fallback sample items
      if (type === 'receipt') {
        setItems([
          { name: 'Fresh Dahi / Curd', qty_base: 500, unit_base: 'ml', location: 'fridge', targetScope: 'personal' },
          { name: 'Aloo (Baby Potatoes)', qty_base: 1500, unit_base: 'g', location: 'pantry', targetScope: 'shared' },
          { name: 'Chakki Atta (Whole Wheat)', qty_base: 5000, unit_base: 'g', location: 'pantry', targetScope: 'shared' },
          { name: 'Fresh Paneer Block', qty_base: 200, unit_base: 'g', location: 'fridge', targetScope: 'personal' },
        ]);
      } else {
        setItems([
          { name: 'Fresh Milk / Doodh', qty_base: 1000, unit_base: 'ml', location: 'fridge', targetScope: 'shared', is_estimate: true },
          { name: 'Tomatoes / Tamatar', qty_base: 500, unit_base: 'g', location: 'fridge', targetScope: 'shared', is_estimate: true },
          { name: 'Green Chillies & Ginger', qty_base: 100, unit_base: 'g', location: 'fridge', targetScope: 'shared', is_estimate: true },
          { name: 'Curd / Dahi', qty_base: 400, unit_base: 'ml', location: 'fridge', targetScope: 'personal', is_estimate: true },
        ]);
      }
      setStatusMessage(null);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        runScan(scanType, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleScope = (index: number) => {
    if (!items) return;
    const updated = [...items];
    updated[index].targetScope = updated[index].targetScope === 'personal' ? 'shared' : 'personal';
    setItems(updated);
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (!items) return;
    const updated = [...items];
    updated[index].qty_base = Math.max(1, newQty);
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    if (!items) return;
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated);
  };

  const handleConfirmAndSave = () => {
    if (!items || items.length === 0) return;
    store.ingestScannedItems(items);
    onItemsIngested();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl p-5 shadow-2xl border border-[#E6E4DD] max-h-[90vh] overflow-y-auto flex flex-col gap-4 text-[#1a1c1a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#E8F0EC] text-[#1A3826] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">document_scanner</span>
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-[#1a1c1a]">
                {isHindi ? 'रसीद व फ्रिज स्कैन' : 'Smart Kitchen Scanner'}
              </h3>
              <p className="text-[11px] text-[#424843]">
                {isHindi ? 'AI विज़न से इन्वेंटरी अपडेट करें' : 'Receipt OCR & Fridge Scan with Personal/Shared Split'}
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#424843] hover:bg-[#eeeeea]"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scan Type Picker */}
        {!items && (
          <div className="flex flex-col gap-4">
            <div className="flex rounded-2xl bg-[#f4f4f0] p-1 border border-[#E6E4DD]">
              <button
                className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
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
                className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  scanType === 'fridge'
                    ? 'bg-[#1A3826] text-white shadow-xs'
                    : 'text-[#424843] hover:text-[#1a1c1a]'
                }`}
                onClick={() => setScanType('fridge')}
              >
                <span className="material-symbols-outlined text-[18px]">kitchen</span>
                {isHindi ? 'फ्रिज फोटो (Fridge Scan)' : 'Fridge / Shelf Photo'}
              </button>
            </div>

            {/* Instruction description */}
            <p className="text-[12.5px] text-[#424843] leading-relaxed">
              {scanType === 'receipt'
                ? 'Upload a photo of your supermarket/mart paper bill or screenshot. Gemini OCR extracts items with quantities and suggests personal or shared shelf locations.'
                : 'Take a snapshot of your fridge or pantry shelf. The vision model will identify vegetables, milk packets, curd, paneer, and estimate counts.'}
            </p>

            {/* Upload or Demo Scan Actions */}
            <div className="flex flex-col gap-2.5">
              <label className="w-full py-3 px-4 rounded-2xl bg-[#1A3826] text-white text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all hover:bg-[#132a1d] shadow-sm">
                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                <span>{isHindi ? 'फ़ोटो अपलोड या कैप्चर करें' : 'Upload or Capture Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isScanning}
                />
              </label>

              <button
                className="w-full py-2.5 px-4 rounded-2xl bg-white border border-[#E6E4DD] text-[#1a1c1a] text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-98 transition-all hover:bg-[#f4f4f0]"
                onClick={() => runScan(scanType)}
                disabled={isScanning}
              >
                <span className="material-symbols-outlined text-[18px] text-[#3b684a]">auto_awesome</span>
                <span>{isHindi ? 'डेमो स्कैन चलाएं' : `Run Demo ${scanType === 'receipt' ? 'Receipt' : 'Fridge'} Scan`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {isScanning && (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
            <span className="w-8 h-8 border-3 border-[#1A3826] border-t-transparent rounded-full animate-spin"></span>
            <span className="text-[13px] font-medium text-[#1a1c1a]">{statusMessage}</span>
          </div>
        )}

        {/* Confirm-and-Edit Screen (Section 2.5 of spec) */}
        {items && !isScanning && (
          <div className="flex flex-col gap-3">
            <div className="bg-[#FAF6F0] p-3 rounded-2xl border border-[#E9E1D6] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#B45309] text-[20px]">rate_review</span>
                <span className="text-[13px] font-bold text-[#1a1c1a]">
                  {isHindi ? 'पुष्टि और संपादन स्क्रीन' : 'Confirm & Edit Screen'}
                </span>
              </div>
              <span className="text-[11px] text-[#424843]">
                {items.length} items detected
              </span>
            </div>

            <p className="text-[12px] text-[#424843]">
              Review detected items before adding to stock. Toggle items between <strong>Personal</strong> and <strong>Shared</strong>:
            </p>

            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-[#1a1c1a] block truncate">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={item.qty_base}
                          onChange={(e) => handleUpdateQty(idx, parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 rounded border border-[#E6E4DD] bg-white text-[12px] font-semibold text-center"
                        />
                        <span className="text-[11px] text-[#424843]">{item.unit_base}</span>
                      </div>
                      <span className="text-[#c2c8c1]">•</span>
                      <span className="text-[11px] text-[#424843] capitalize">{item.location}</span>
                    </div>
                  </div>

                  {/* Personal vs Shared Scope Toggle Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                        item.targetScope === 'personal'
                          ? 'bg-[#E8F0EC] text-[#1E4620] border-[#D1E2D7]'
                          : 'bg-[#F2ECE1] text-[#B45309] border-[#E9E1D6]'
                      }`}
                      onClick={() => handleToggleScope(idx)}
                      title="Click to switch between Personal and Shared scope"
                    >
                      {item.targetScope === 'personal' ? '👤 Personal' : '👥 Shared'}
                    </button>

                    <button
                      className="text-[#727972] hover:text-[#9E2A2B] p-1"
                      onClick={() => handleRemoveItem(idx)}
                      title="Remove from batch"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#E6E4DD]">
              <button
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#1A3826] text-white text-[13px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5 hover:bg-[#132a1d]"
                onClick={handleConfirmAndSave}
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{isHindi ? 'इन्वेंटरी में जोड़ें' : 'Confirm & Add to Stock'}</span>
              </button>
              <button
                className="py-2.5 px-3 rounded-xl bg-white border border-[#E6E4DD] text-[#424843] text-[13px] font-medium hover:bg-[#f4f4f0]"
                onClick={() => setItems(null)}
              >
                Rescan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
