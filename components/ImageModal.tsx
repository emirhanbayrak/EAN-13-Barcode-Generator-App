import React from 'react';
import { BarcodeEntry } from '../types';
import Barcode from './Barcode';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  barcodeEntry: BarcodeEntry | null;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, barcodeEntry }) => {
  if (!isOpen || !barcodeEntry) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4" 
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl relative max-w-lg w-full animate-scale-in" 
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
          aria-label="Close image view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="bg-white p-4 rounded-md">
            <Barcode value={barcodeEntry.barcode} id="modal-barcode" width={300} height={150} />
        </div>
         <div className="text-center mt-4">
            <p className="font-mono text-lg text-green-400 break-all">{barcodeEntry.barcode}</p>
            <p className="text-gray-300">{barcodeEntry.productName}</p>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
