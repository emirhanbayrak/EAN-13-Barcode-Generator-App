export interface BarcodeEntry {
  id: string; // Unique ID for React keys
  rowId: string;
  productType: string;
  productName: string;
  colorComponent: string;
  productCode: string;
  packageInfo: string;
  barcode: string;
  createDate: string; // ISO Date string
}
