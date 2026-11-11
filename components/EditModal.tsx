import React, { useState, useEffect } from 'react';
import { BarcodeEntry } from '../types';
import { validateEan13, calculateCheckDigit } from '../utils/ean13';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedEntry: BarcodeEntry) => void;
  barcodeEntry: BarcodeEntry | null;
}

const EditModal: React.FC<EditModalProps> = ({ isOpen, onClose, onSave, barcodeEntry }) => {
  const [formData, setFormData] = useState({
    rowId: '',
    barcode: '',
    productName: '',
    productType: '',
    colorComponent: '',
    productCode: '',
    packageInfo: '',
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (barcodeEntry) {
      setFormData({
        rowId: barcodeEntry.rowId,
        barcode: barcodeEntry.barcode,
        productName: barcodeEntry.productName,
        productType: barcodeEntry.productType,
        colorComponent: barcodeEntry.colorComponent,
        productCode: barcodeEntry.productCode,
        packageInfo: barcodeEntry.packageInfo,
      });
      setValidationError(null);
    }
  }, [barcodeEntry]);

  if (!isOpen || !barcodeEntry) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'barcode' ? value.replace(/\s+/g, '') : value,
    }));
    setValidationError(null);
  };

  const handleFixCheckDigit = () => {
    const digitsOnly = formData.barcode.replace(/\D/g, '');
    if (digitsOnly.length >= 12) {
      const base12 = digitsOnly.substring(0, 12);
      const checkDigit = calculateCheckDigit(base12);
      setFormData(prev => ({ ...prev, barcode: `${base12}${checkDigit}` }));
      setValidationError(null);
    } else {
      setValidationError('Check digit calculation requires at least 12 digits.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productName.trim()) {
      setValidationError('Product name cannot be empty.');
      return;
    }
    if (!formData.barcode.trim()) {
      setValidationError('Barcode cannot be empty.');
      return;
    }
    const updatedEntry: BarcodeEntry = {
      ...barcodeEntry,
      rowId: formData.rowId.trim() || barcodeEntry.rowId,
      barcode: formData.barcode.trim(),
      productName: formData.productName.trim(),
      productType: formData.productType.trim(),
      colorComponent: formData.colorComponent.trim(),
      productCode: formData.productCode.trim(),
      packageInfo: formData.packageInfo.trim(),
    };
    onSave(updatedEntry);
  };

  const isBarcodeValid = validateEan13(formData.barcode);
  const canCalculateCheckDigit = /^\d{12,13}$/.test(formData.barcode) && !isBarcodeValid;

  const inputFields = [
    { name: 'productName', label: 'Product Name', required: true, placeholder: 'e.g. T-Shirt' },
    { name: 'productCode', label: 'Product Code', placeholder: 'e.g. TS-001' },
    { name: 'colorComponent', label: 'Color', placeholder: 'e.g. Blue' },
    { name: 'productType', label: 'Product Type', placeholder: 'e.g. Apparel' },
    { name: 'packageInfo', label: 'Package Info', placeholder: 'e.g. Single Pack' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-xl relative max-w-lg w-full animate-scale-in border border-gray-700 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close edit view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Edit Entry</h2>
          <p className="font-mono text-sm text-gray-400 mt-1">Row ID: {barcodeEntry.rowId}</p>
        </div>

        {validationError && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-2.5 rounded-lg mb-4 text-sm">
            {validationError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label htmlFor="edit_rowId" className="block text-sm font-medium text-gray-300 mb-1">Row ID</label>
              <input
                id="edit_rowId"
                name="rowId"
                type="text"
                value={formData.rowId}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit_barcode" className="block text-sm font-medium text-gray-300">Barcode (EAN-13)</label>
                <span className={`text-xs font-medium ${isBarcodeValid ? 'text-green-400' : 'text-amber-400'}`}>
                  {isBarcodeValid ? 'Valid EAN-13' : 'Invalid Check Digit / Format'}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  id="edit_barcode"
                  name="barcode"
                  type="text"
                  value={formData.barcode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono focus:ring-indigo-500 focus:border-indigo-500"
                />
                {canCalculateCheckDigit && (
                  <button
                    type="button"
                    onClick={handleFixCheckDigit}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg whitespace-nowrap transition"
                    title="Auto-calculate and fix the 13th check digit"
                  >
                    Fix Digit
                  </button>
                )}
              </div>
            </div>
          </div>

          {inputFields.map(field => (
            <div key={field.name}>
              <label htmlFor={`edit_${field.name}`} className="block text-sm font-medium text-gray-300 mb-1">{field.label}</label>
              <input
                id={`edit_${field.name}`}
                name={field.name}
                type="text"
                value={formData[field.name as keyof typeof formData]}
                onChange={handleChange}
                placeholder={field.placeholder}
                required={field.required}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          ))}
          <div className="flex justify-end space-x-4 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-semibold transition">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition">
              Save Changes
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default EditModal;