import { BarcodeEntry } from '../types';
import { validateEan13, calculateCheckDigit } from './ean13';

export interface ImportReport {
  totalRowsRead: number;
  importedCount: number;
  validEanCount: number;
  invalidEanCount: number;
  autoFixedFormatCount: number;
  skippedEmptyRows: number;
}

/**
 * Normalizes a raw header name to a canonical key.
 */
const normalizeHeaderKey = (rawHeader: string): string => {
  const cleaned = rawHeader
    .replace(/^\uFEFF/, '')
    .replace(/^["']+|["']+$/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  const aliasMap: Record<string, string> = {
    rowid: 'rowid',
    row: 'rowid',
    id: 'rowid',
    sira: 'rowid',
    sirano: 'rowid',
    producttype: 'producttype',
    type: 'producttype',
    uruntipi: 'producttype',
    kategori: 'producttype',
    productname: 'productname',
    name: 'productname',
    urunadi: 'productname',
    urun: 'productname',
    colorcomponent: 'colorcomponent',
    color: 'colorcomponent',
    renk: 'colorcomponent',
    renkbilesen: 'colorcomponent',
    productcode: 'productcode',
    code: 'productcode',
    urunkodu: 'productcode',
    stokkodu: 'productcode',
    package: 'package',
    packageinfo: 'package',
    paket: 'package',
    paketbilgisi: 'package',
    ambalaj: 'package',
    barkod: 'barkod',
    barcode: 'barkod',
    ean: 'barkod',
    ean13: 'barkod',
    createdate: 'createdate',
    createddate: 'createdate',
    date: 'createdate',
    tarih: 'createdate',
    olusturmatarihi: 'createdate',
  };

  return aliasMap[cleaned] || cleaned;
};

/**
 * Detects the most likely CSV delimiter (comma, semicolon, or tab) from the header line,
 * ignoring characters inside double quotes.
 */
const detectDelimiter = (text: string): string => {
  const firstLineEnd = text.search(/\r?\n/);
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);

  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      if (inQuotes && firstLine[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && ch in counts) {
      counts[ch]++;
    }
  }

  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';';
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
  return ',';
};

/**
 * Full RFC-4180 compliant state-machine CSV parser.
 * Properly handles commas/semicolons inside quotes, escaped quotes (""),
 * and multi-line values inside quotes.
 */
export const parseRawCsvRows = (rawText: string): string[][] => {
  const text = rawText.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"' && currentCell.trim() === '') {
        inQuotes = true;
        currentCell = '';
      } else if (ch === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && text[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        currentCell = '';
        if (currentRow.some(cell => cell !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
};

/**
 * Cleans and normalizes a raw barcode value from CSV/Excel.
 * Returns { barcode, wasAutoFixed }.
 */
export const normalizeImportedBarcode = (rawBarcode: string): { barcode: string; wasAutoFixed: boolean } => {
  if (!rawBarcode) return { barcode: '', wasAutoFixed: false };

  // Strip surrounding quotes, Excel leading apostrophe, and all whitespace
  let cleaned = rawBarcode
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\s+/g, '')
    .trim();

  let wasAutoFixed = cleaned !== rawBarcode.trim();

  // If 12 digits, check if Excel stripped a leading zero or if it needs a check digit
  if (/^\d{12}$/.test(cleaned)) {
    const withLeadingZero = '0' + cleaned;
    if (validateEan13(withLeadingZero)) {
      return { barcode: withLeadingZero, wasAutoFixed: true };
    }
    // Otherwise calculate the 13th check digit from the 12-digit base
    const checkDigit = calculateCheckDigit(cleaned);
    return { barcode: `${cleaned}${checkDigit}`, wasAutoFixed: true };
  }

  return { barcode: cleaned, wasAutoFixed };
};

/**
 * Parses CSV text into BarcodeEntry items without silently dropping rows.
 */
export const parseCsvToEntries = (
  text: string
): { entries: BarcodeEntry[]; report: ImportReport } => {
  const rows = parseRawCsvRows(text);
  if (rows.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const rawHeaders = rows[0];
  const headers = rawHeaders.map(normalizeHeaderKey);

  const requiredHeaders = ['rowid', 'barkod'];
  if (!requiredHeaders.every(h => headers.includes(h))) {
    throw new Error(
      `CSV header is missing required columns. Found: [${rawHeaders.join(', ')}]. Expected at least RowID and Barkod.`
    );
  }

  const dataRows = rows.slice(1);
  const entries: BarcodeEntry[] = [];
  let validEanCount = 0;
  let invalidEanCount = 0;
  let autoFixedFormatCount = 0;
  let skippedEmptyRows = 0;

  const barkodIdx = headers.indexOf('barkod');
  const createDateIdx = headers.indexOf('createdate');

  dataRows.forEach((values, rowIndex) => {
    // Skip completely empty rows
    if (values.every(v => !v || v.trim() === '')) {
      skippedEmptyRows++;
      return;
    }

    let alignedValues = [...values];

    // Recovery for unquoted commas that caused extra columns in a row
    if (alignedValues.length > headers.length && barkodIdx !== -1) {
      const extraCols = alignedValues.length - headers.length;
      const candidateAtStandardIdx = alignedValues[barkodIdx] || '';
      const candidateFromRight = alignedValues[barkodIdx + extraCols] || '';

      // If the shifted position from the right looks like a barcode and standard index does not
      if (
        !/^\d{12,13}$/.test(candidateAtStandardIdx.replace(/\s+/g, '')) &&
        /^\d{12,13}$/.test(candidateFromRight.replace(/\s+/g, ''))
      ) {
        // Merge the extra columns into productName (or the column before barkod)
        const mergeTargetIdx = Math.max(1, headers.indexOf('productname'));
        const mergedSegment = alignedValues.slice(mergeTargetIdx, mergeTargetIdx + extraCols + 1).join(', ');
        alignedValues = [
          ...alignedValues.slice(0, mergeTargetIdx),
          mergedSegment,
          ...alignedValues.slice(mergeTargetIdx + extraCols + 1),
        ];
      }
    }

    const entryData: Record<string, string> = {};
    headers.forEach((header, idx) => {
      entryData[header] = (alignedValues[idx] ?? '').replace(/^"|"$/g, '').trim();
    });

    // Secondary fallback: if barkod is still empty or non-numeric due to column shift, scan row for a 13-digit EAN
    if (!/^\d{12,13}$/.test((entryData.barkod || '').replace(/\s+/g, ''))) {
      for (let i = alignedValues.length - 1; i >= 1; i--) {
        if (i === createDateIdx) continue;
        const candidate = (alignedValues[i] || '').replace(/^['"]+|['"]+$/g, '').replace(/\s+/g, '');
        if (/^\d{12,13}$/.test(candidate)) {
          entryData.barkod = candidate;
          break;
        }
      }
    }

    const { barcode, wasAutoFixed } = normalizeImportedBarcode(entryData.barkod || '');
    if (wasAutoFixed) {
      autoFixedFormatCount++;
    }

    const isValid = validateEan13(barcode);
    if (isValid) {
      validEanCount++;
    } else {
      invalidEanCount++;
    }

    const fallbackRowId = (rowIndex + 1).toString();

    entries.push({
      id: `${Date.now()}-${rowIndex}-${Math.random().toString(36).slice(2, 8)}`,
      rowId: entryData.rowid || fallbackRowId,
      productType: entryData.producttype || '',
      productName: entryData.productname || `(Row ${entryData.rowid || fallbackRowId})`,
      colorComponent: entryData.colorcomponent || '',
      productCode: entryData.productcode || '',
      packageInfo: entryData.package || '',
      barcode: barcode,
      createDate: entryData.createdate || new Date().toISOString(),
    });
  });

  return {
    entries,
    report: {
      totalRowsRead: dataRows.length,
      importedCount: entries.length,
      validEanCount,
      invalidEanCount,
      autoFixedFormatCount,
      skippedEmptyRows,
    },
  };
};

/**
 * Parses XML text into BarcodeEntry items without silently dropping rows.
 */
export const parseXmlToEntries = (
  text: string
): { entries: BarcodeEntry[]; report: ImportReport } => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, 'application/xml');
  const parserError = xmlDoc.getElementsByTagName('parsererror');
  if (parserError.length > 0) {
    throw new Error('Invalid XML format.');
  }

  const entryNodes = xmlDoc.getElementsByTagName('BarcodeEntry');
  const entries: BarcodeEntry[] = [];
  let validEanCount = 0;
  let invalidEanCount = 0;
  let autoFixedFormatCount = 0;

  for (let i = 0; i < entryNodes.length; i++) {
    const entryNode = entryNodes[i];
    const getTagValue = (tagName: string) =>
      entryNode.getElementsByTagName(tagName)[0]?.textContent?.trim() || '';

    const rawBarcode = getTagValue('Barkod') || getTagValue('Barcode');
    const { barcode, wasAutoFixed } = normalizeImportedBarcode(rawBarcode);
    if (wasAutoFixed) autoFixedFormatCount++;

    if (validateEan13(barcode)) {
      validEanCount++;
    } else {
      invalidEanCount++;
    }

    const rowId = getTagValue('RowID') || (i + 1).toString();

    entries.push({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      rowId,
      productType: getTagValue('ProductType'),
      productName: getTagValue('ProductName') || `(Row ${rowId})`,
      colorComponent: getTagValue('ColorComponent'),
      productCode: getTagValue('ProductCode'),
      packageInfo: getTagValue('Package'),
      barcode,
      createDate: getTagValue('CreateDate') || new Date().toISOString(),
    });
  }

  return {
    entries,
    report: {
      totalRowsRead: entryNodes.length,
      importedCount: entries.length,
      validEanCount,
      invalidEanCount,
      autoFixedFormatCount,
      skippedEmptyRows: 0,
    },
  };
};
