import React from 'react';
import { BarcodeEntry } from '../types';

interface DetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  barcodeEntry: BarcodeEntry | null;
}

const DetailsModal: React.FC<DetailsModalProps> = ({ isOpen, onClose, barcodeEntry }) => {
  if (!isOpen || !barcodeEntry) return null;

  const formatIsoDate = (isoString: string) => {
    if (!isoString || isNaN(new Date(isoString).getTime())) {
      return 'N/A';
    }
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const detailItems = [
    { label: 'Product Code', value: barcodeEntry.productCode },
    { label: 'Color', value: barcodeEntry.colorComponent },
    { label: 'Product Type', value: barcodeEntry.productType },
    { label: 'Package Info', value: barcodeEntry.packageInfo },
    { label: 'Created Date', value: formatIsoDate(barcodeEntry.createDate) },
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-xl relative max-w-md w-full animate-scale-in border border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close details view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">{barcodeEntry.productName}</h2>
            <p className="font-mono text-lg text-green-400 mt-1">{barcodeEntry.barcode}</p>
        </div>

        <div className="space-y-3">
          {detailItems.map(item => (
            item.value ? (
                <div key={item.label} className="bg-gray-900/50 p-3 rounded-lg flex justify-between items-center">
                    <span className="text-gray-400 font-medium text-sm">{item.label}</span>
                    <span className="text-gray-200 text-sm font-semibold">{item.value}</span>
                </div>
            ) : null
          ))}
        </div>

      </div>
    </div>
  );
};

export default DetailsModal;
