import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarcodeEntry } from './types';
import { validateEan13, incrementBarcodeBase, calculateCheckDigit } from './utils/ean13';
import { parseCsvToEntries, parseXmlToEntries, ImportReport } from './utils/csvParser';
import { useLocalStorage } from './hooks/useLocalStorage';
import BarcodeIcon from './components/BarcodeIcon';
import Barcode from './components/Barcode';
import DownloadIcon from './components/DownloadIcon';
import ClipboardIcon from './components/ClipboardIcon';
import ImportIcon from './components/ImportIcon';
import ExportIcon from './components/ExportIcon';
import ImageModal from './components/ImageModal';
import SearchIcon from './components/SearchIcon';
import DetailsModal from './components/DetailsModal';
import InfoIcon from './components/InfoIcon';
import EditModal from './components/EditModal';
import EditIcon from './components/EditIcon';
import DeleteIcon from './components/DeleteIcon';


const initialProductDetailsState = {
    productType: '',
    productName: '',
    colorComponent: '',
    productCode: '',
    packageInfo: '',
};

const App: React.FC = () => {
  const [barcodeHistory, setBarcodeHistory] = useLocalStorage<BarcodeEntry[]>('barcodeHistory', []);
  const [lastBarcode, setLastBarcode] = useLocalStorage<string | null>('lastBarcode', null);

  const [initialBarcode, setInitialBarcode] = useState('');
  const [productDetails, setProductDetails] = useState(initialProductDetailsState);
  
  const [error, setError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<{ message: string; report: ImportReport } | null>(null);
  const [copiedStatus, setCopiedStatus] = useState<Record<string, boolean>>({});
  
  const [selectedBarcode, setSelectedBarcode] = useState<BarcodeEntry | null>(null);
  const [detailsEntry, setDetailsEntry] = useState<BarcodeEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<BarcodeEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [validityFilter, setValidityFilter] = useState<'all' | 'valid' | 'invalid'>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // State for row selection
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // State for button feedback
  const [isTableCopied, setIsTableCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // State for in-app confirmations (replacing window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // State for Check-Digit Calculator
  const [checkDigitInput, setCheckDigitInput] = useState('');
  const [calculateMode, setCalculateMode] = useState(false);
  const [checkDigitResult, setCheckDigitResult] = useState<{message: string; type: 'success' | 'error' | 'info'} | null>(null);


  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProductDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEan13(initialBarcode)) {
      setError('Invalid EAN-13 barcode. Please enter a valid 13-digit barcode.');
      return;
    }
    if (!productDetails.productName.trim()) {
      setError('Product name cannot be empty.');
      return;
    }

    const newEntry: BarcodeEntry = {
      id: new Date().toISOString() + Math.random(),
      rowId: '1',
      barcode: initialBarcode,
      productName: productDetails.productName.trim(),
      productType: productDetails.productType.trim(),
      colorComponent: productDetails.colorComponent.trim(),
      productCode: productDetails.productCode.trim(),
      packageInfo: productDetails.packageInfo.trim(),
      createDate: new Date().toISOString(),
    };

    setBarcodeHistory([newEntry]);
    setLastBarcode(initialBarcode);
    setInitialBarcode('');
    setProductDetails(initialProductDetailsState);
  };

  const handleGenerateNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!lastBarcode) {
      setError('Cannot generate barcode. No initial barcode set.');
      return;
    }
    if (!productDetails.productName.trim()) {
      setError('Product name cannot be empty.');
      return;
    }

    try {
      const base12 = lastBarcode.replace(/\D/g, '').substring(0, 12);
      const nextBase12 = incrementBarcodeBase(base12);
      const nextCheckDigit = calculateCheckDigit(nextBase12);
      const nextBarcode = `${nextBase12}${nextCheckDigit}`;
      
      const maxRowId = barcodeHistory.reduce((max, entry) => {
        const currentId = parseInt(entry.rowId, 10);
        return isNaN(currentId) ? max : Math.max(max, currentId);
      }, 0);

      const newEntry: BarcodeEntry = {
        id: new Date().toISOString() + Math.random(),
        rowId: (maxRowId + 1).toString(),
        barcode: nextBarcode,
        productName: productDetails.productName.trim(),
        productType: productDetails.productType.trim(),
        colorComponent: productDetails.colorComponent.trim(),
        productCode: productDetails.productCode.trim(),
        packageInfo: productDetails.packageInfo.trim(),
        createDate: new Date().toISOString(),
      };

      setBarcodeHistory(prev => [newEntry, ...prev]);
      setLastBarcode(nextBarcode);
      setProductDetails(initialProductDetailsState);
    } catch (err) {
      if (err instanceof Error) {
        setError(`Error generating barcode: ${err.message}`);
      } else {
        setError('An unknown error occurred.');
      }
    }
  };

  const sortedHistory = useMemo(() => {
    return [...barcodeHistory].sort((a, b) => {
      const numA = parseInt(a.rowId, 10);
      const numB = parseInt(b.rowId, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA;
      }
      return String(b.rowId).localeCompare(String(a.rowId), undefined, { numeric: true });
    });
  }, [barcodeHistory]);

  const invalidBarcodeCount = useMemo(() => {
    return barcodeHistory.filter(entry => !validateEan13(entry.barcode)).length;
  }, [barcodeHistory]);

  const filteredHistory = useMemo(() => {
    const lowercasedQuery = searchQuery.toLowerCase().trim();
    return sortedHistory.filter(entry => {
      if (validityFilter === 'valid' && !validateEan13(entry.barcode)) return false;
      if (validityFilter === 'invalid' && validateEan13(entry.barcode)) return false;

      if (!lowercasedQuery) return true;
      return (
        entry.barcode.toLowerCase().includes(lowercasedQuery) ||
        entry.productName.toLowerCase().includes(lowercasedQuery) ||
        entry.productCode.toLowerCase().includes(lowercasedQuery) ||
        entry.colorComponent.toLowerCase().includes(lowercasedQuery) ||
        entry.productType.toLowerCase().includes(lowercasedQuery) ||
        entry.rowId.toLowerCase().includes(lowercasedQuery)
      );
    });
  }, [sortedHistory, searchQuery, validityFilter]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredHistory.length / itemsPerPage);
  }, [filteredHistory, itemsPerPage]);

  const paginatedHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredHistory, currentPage, itemsPerPage]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage, validityFilter]);

  // Selection Logic
  const isAllVisibleSelected = useMemo(() => {
    return paginatedHistory.length > 0 && paginatedHistory.every(item => selectedRowIds.has(item.id));
  }, [paginatedHistory, selectedRowIds]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelected = new Set(selectedRowIds);
    if (e.target.checked) {
        paginatedHistory.forEach(item => newSelected.add(item.id));
    } else {
        paginatedHistory.forEach(item => newSelected.delete(item.id));
    }
    setSelectedRowIds(newSelected);
  };

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedRowIds);
    if (newSelected.has(id)) {
        newSelected.delete(id);
    } else {
        newSelected.add(id);
    }
    setSelectedRowIds(newSelected);
  };

  const handleReset = () => {
    setConfirmDialog({
      title: 'Reset Application',
      message: 'Are you sure you want to delete all data and start over? This cannot be undone.',
      confirmLabel: 'Delete All Data',
      onConfirm: () => {
        setBarcodeHistory([]);
        setLastBarcode(null);
        setError(null);
        setImportNotice(null);
        setSelectedRowIds(new Set());
        setConfirmDialog(null);
      },
    });
  };

  const escapeCsvField = (field: string) => `"${(field ?? '').replace(/"/g, '""')}"`;
  
  const handleExportCSV = () => {
    if (sortedHistory.length === 0) {
        setError("No barcodes to export.");
        return;
    }

    const headers = ["RowID", "ProductType", "ProductName", "ColorComponent", "ProductCode", "Package", "Barkod", "CreateDate"].map(escapeCsvField).join(',');
    
    const csvRows = sortedHistory.map(entry => [
        entry.rowId,
        entry.productType,
        entry.productName,
        entry.colorComponent,
        entry.productCode,
        entry.packageInfo,
        entry.barcode,
        entry.createDate
    ].map(escapeCsvField).join(','));

    // Include UTF-8 BOM for proper Turkish character rendering in Excel
    const csvString = `\uFEFF${headers}\n${csvRows.join('\n')}`;

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `barcodes_export_${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSelectedExcel = () => {
    const selectedEntries = barcodeHistory.filter(entry => selectedRowIds.has(entry.id));
    if (selectedEntries.length === 0) return;

    setIsExporting(true);

    setTimeout(() => {
        const headers = ["RowID", "ProductType", "ProductName", "ColorComponent", "ProductCode", "Package", "Barkod", "CreateDate"].map(escapeCsvField).join(',');
        
        const csvRows = selectedEntries.map(entry => [
            entry.rowId,
            entry.productType,
            entry.productName,
            entry.colorComponent,
            entry.productCode,
            entry.packageInfo,
            entry.barcode,
            entry.createDate
        ].map(escapeCsvField).join(','));

        // BOM for Excel compatibility with UTF-8
        const csvString = `\uFEFF${headers}\n${csvRows.join('\n')}`;

        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        const date = new Date().toISOString().split('T')[0];
        // Use .csv extension as Excel opens it by default
        link.setAttribute("download", `selected_barcodes_${date}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setIsExporting(false);
    }, 500);
  };

  const handleCopyAsTable = async () => {
    const selectedEntries = barcodeHistory.filter(entry => selectedRowIds.has(entry.id));
    if (selectedEntries.length === 0) return;

    const headers = ["Row ID", "Barcode", "Product Name", "Product Code", "Color", "Product Type", "Package", "Created Date"];
    
    // Create HTML Table string with inline styles for better paste support in Excel/Word
    let tableHTML = `<table border="1" style="border-collapse: collapse; width: 100%;">
        <thead>
            <tr>${headers.map(h => `<th style="background-color: #f2f2f2; border: 1px solid #000; padding: 8px; text-align: left;">${h}</th>`).join('')}</tr>
        </thead>
        <tbody>`;
        
    selectedEntries.forEach(entry => {
        tableHTML += `<tr>
            <td style="border: 1px solid #000; padding: 8px;">${entry.rowId}</td>
            <td style="border: 1px solid #000; padding: 8px; mso-number-format:'\\@'">${entry.barcode}</td>
            <td style="border: 1px solid #000; padding: 8px;">${entry.productName}</td>
            <td style="border: 1px solid #000; padding: 8px;">${entry.productCode}</td>
            <td style="border: 1px solid #000; padding: 8px;">${entry.colorComponent}</td>
            <td style="border: 1px solid #000; padding: 8px;">${entry.productType}</td>
            <td style="border: 1px solid #000; padding: 8px;">${entry.packageInfo}</td>
            <td style="border: 1px solid #000; padding: 8px;">${entry.createDate}</td>
        </tr>`;
    });
    tableHTML += '</tbody></table>';

    try {
        const blobHtml = new Blob([tableHTML], { type: "text/html" });
        const blobText = new Blob([selectedEntries.map(e => [e.rowId, e.barcode, e.productName, e.productCode, e.colorComponent, e.productType, e.packageInfo, e.createDate].join('\t')).join('\n')], {type: 'text/plain'});
        
        // @ts-ignore
        const data = [new ClipboardItem({ 
            ["text/html"]: blobHtml,
            ["text/plain"]: blobText
        })];
        
        await navigator.clipboard.write(data);
        setIsTableCopied(true);
        setTimeout(() => setIsTableCopied(false), 2000);
    } catch (err) {
        console.error("Copy failed", err);
        const tsv = [headers.join('\t'), ...selectedEntries.map(e => [e.rowId, e.barcode, e.productName, e.productCode, e.colorComponent, e.productType, e.packageInfo, e.createDate].join('\t'))].join('\n');
        navigator.clipboard.writeText(tsv).then(() => {
            setIsTableCopied(true);
            setTimeout(() => setIsTableCopied(false), 2000);
        }).catch(() => setError("Failed to copy table to clipboard."));
    }
  };

  const handleExportXML = () => {
    if (sortedHistory.length === 0) {
      setError("No barcodes to export.");
      return;
    }

    const escapeXml = (text: string) => (text ?? '').replace(/[<>&'"]/g, c => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });

    let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n<BarcodeData>\n';
    sortedHistory.forEach(entry => {
        xmlString += '  <BarcodeEntry>\n';
        xmlString += `    <RowID>${escapeXml(entry.rowId)}</RowID>\n`;
        xmlString += `    <ProductType>${escapeXml(entry.productType)}</ProductType>\n`;
        xmlString += `    <ProductName>${escapeXml(entry.productName)}</ProductName>\n`;
        xmlString += `    <ColorComponent>${escapeXml(entry.colorComponent)}</ColorComponent>\n`;
        xmlString += `    <ProductCode>${escapeXml(entry.productCode)}</ProductCode>\n`;
        xmlString += `    <Package>${escapeXml(entry.packageInfo)}</Package>\n`;
        xmlString += `    <Barkod>${escapeXml(entry.barcode)}</Barkod>\n`;
        xmlString += `    <CreateDate>${escapeXml(entry.createDate)}</CreateDate>\n`;
        xmlString += '  </BarcodeEntry>\n';
    });
    xmlString += '</BarcodeData>';

    const blob = new Blob([xmlString], { type: 'application/xml;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `barcodes_export_${date}.xml`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

  const handleDownloadBarcode = (entry: BarcodeEntry) => {
    const svgNode = document.getElementById(`barcode-${entry.id}`);
    if (!svgNode || svgNode.tagName.toLowerCase() !== 'svg') {
      console.error('Could not find valid SVG node for barcode', entry.barcode);
      setError('Could not download barcode image. Ensure the barcode is a 13-digit EAN-13 number.');
      return;
    }

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgNode);

    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${entry.productName.replace(/\s/g, '_')}-${entry.barcode}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyBarcode = (barcode: string, id: string) => {
    navigator.clipboard.writeText(barcode).then(() => {
      setCopiedStatus({ [id]: true });
      setTimeout(() => {
        setCopiedStatus(prev => {
          const newState = { ...prev };
          delete newState[id];
          return newState;
        });
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      setError('Could not copy barcode to clipboard.');
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const processImportedData = (importedEntries: BarcodeEntry[], report: ImportReport) => {
    if (importedEntries.length === 0) {
      setError("No barcode entries found in the imported file.");
      return;
    }

    let lastEntry: BarcodeEntry | undefined;

    // Prefer entries that have both a numeric rowId and at least 12 digits in barcode
    const numericEntriesWithValidBase = importedEntries.filter(
      e => !isNaN(parseInt(e.rowId, 10)) && /^\d{12,13}$/.test(e.barcode)
    );
    const numericEntries =
      numericEntriesWithValidBase.length > 0
        ? numericEntriesWithValidBase
        : importedEntries.filter(e => !isNaN(parseInt(e.rowId, 10)));

    if (numericEntries.length > 0) {
      lastEntry = numericEntries.reduce((max, current) =>
        parseInt(current.rowId, 10) > parseInt(max.rowId, 10) ? current : max
      );
    }

    let newLastBarcode: string | null = null;
    let sequenceNote = '';

    if (lastEntry && /^\d{12,13}$/.test(lastEntry.barcode)) {
      const base12 = lastEntry.barcode.substring(0, 12);
      const validDigit = calculateCheckDigit(base12);
      newLastBarcode = `${base12}${validDigit}`;
      sequenceNote = `Sequence continues from Row ID ${lastEntry.rowId} (${newLastBarcode}).`;
    } else {
      const validBaseEntries = importedEntries.filter(e => /^\d{12,13}$/.test(e.barcode));
      const sortedByBarcode = [...(validBaseEntries.length > 0 ? validBaseEntries : importedEntries)].sort(
        (a, b) => b.barcode.localeCompare(a.barcode)
      );
      const highestBarcodeEntry = sortedByBarcode[0];
      if (highestBarcodeEntry) {
        if (/^\d{12,13}$/.test(highestBarcodeEntry.barcode)) {
          const base12 = highestBarcodeEntry.barcode.substring(0, 12);
          newLastBarcode = `${base12}${calculateCheckDigit(base12)}`;
        } else {
          newLastBarcode = highestBarcodeEntry.barcode;
        }
        sequenceNote = `Sequence continues from highest barcode (${newLastBarcode}).`;
      }
    }

    if (newLastBarcode) {
      setBarcodeHistory(importedEntries);
      setLastBarcode(newLastBarcode);
      setSelectedRowIds(new Set());
      setValidityFilter('all');
      setError(null);
      setImportNotice({
        message: `Successfully imported all ${importedEntries.length} rows. ${sequenceNote}`,
        report,
      });
    } else {
      setError("Could not determine the starting barcode from the imported file.");
    }
  };

  const executeFileParse = (fileName: string, text: string) => {
    try {
      if (fileName.toLowerCase().endsWith('.csv')) {
        const { entries, report } = parseCsvToEntries(text);
        processImportedData(entries, report);
      } else if (fileName.toLowerCase().endsWith('.xml')) {
        const { entries, report } = parseXmlToEntries(text);
        processImportedData(entries, report);
      } else {
        setError("Unsupported file type. Please upload a .csv or .xml file.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file. Please check its format.");
      console.error(err);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setError("Could not read the file.");
        return;
      }

      if (lastBarcode && barcodeHistory.length > 0) {
        setConfirmDialog({
          title: 'Import & Overwrite Data',
          message: `Importing "${file.name}" will replace your current ${barcodeHistory.length} barcode entries. Do you want to continue?`,
          confirmLabel: 'Import & Overwrite',
          onConfirm: () => {
            setConfirmDialog(null);
            executeFileParse(file.name, text);
          },
        });
      } else {
        executeFileParse(file.name, text);
      }
    };
    reader.onerror = () => {
      setError("Error reading file.");
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleFixSingleBarcode = (entry: BarcodeEntry) => {
    const digits = entry.barcode.replace(/\D/g, '');
    if (digits.length < 12) {
      setEditingEntry(entry);
      return;
    }
    const base12 = digits.substring(0, 12);
    const checkDigit = calculateCheckDigit(base12);
    const fixedBarcode = `${base12}${checkDigit}`;
    setBarcodeHistory(prev =>
      prev.map(item => (item.id === entry.id ? { ...item, barcode: fixedBarcode } : item))
    );
  };

  const handleFixAllInvalidCheckDigits = () => {
    let fixedCount = 0;
    setBarcodeHistory(prev =>
      prev.map(entry => {
        if (validateEan13(entry.barcode)) return entry;
        const digits = entry.barcode.replace(/\D/g, '');
        if (digits.length >= 12) {
          const base12 = digits.substring(0, 12);
          const checkDigit = calculateCheckDigit(base12);
          fixedCount++;
          return { ...entry, barcode: `${base12}${checkDigit}` };
        }
        return entry;
      })
    );
    if (fixedCount > 0 && importNotice) {
      setImportNotice(prev =>
        prev
          ? {
              ...prev,
              message: `${prev.message} (${fixedCount} check digits auto-corrected.)`,
              report: {
                ...prev.report,
                validEanCount: prev.report.validEanCount + fixedCount,
                invalidEanCount: Math.max(0, prev.report.invalidEanCount - fixedCount),
              },
            }
          : null
      );
    }
    if (validityFilter === 'invalid') {
      setValidityFilter('all');
    }
  };

  const handleCheckDigitInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCheckDigitInput(e.target.value.replace(/\D/g, ''));
    setCheckDigitResult(null); 
  };

  const handleCalculateModeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCalculateMode(e.target.checked);
    setCheckDigitInput(''); 
    setCheckDigitResult(null); 
  };

  const handleCheckDigitSubmit = () => {
    if (calculateMode) {
      if (checkDigitInput.length !== 12) {
        setCheckDigitResult({ message: 'Please enter exactly 12 digits.', type: 'error' });
        return;
      }
      try {
        const checkDigit = calculateCheckDigit(checkDigitInput);
        setCheckDigitResult({ message: `Calculated Check Digit: ${checkDigit}`, type: 'info' });
      } catch (err) {
        setCheckDigitResult({ message: 'Invalid input.', type: 'error' });
      }
    } else {
      if (checkDigitInput.length !== 13) {
        setCheckDigitResult({ message: 'Please enter a 13-digit barcode.', type: 'error' });
        return;
      }
      const isValid = validateEan13(checkDigitInput);
      if (isValid) {
        setCheckDigitResult({ message: 'Valid Barcode ✔️', type: 'success' });
      } else {
        try {
          const expectedDigit = calculateCheckDigit(checkDigitInput.substring(0, 12));
          setCheckDigitResult({ message: `Invalid Check Digit. Expected: ${expectedDigit}`, type: 'error' });
        } catch (err) {
           setCheckDigitResult({ message: 'Invalid barcode format.', type: 'error' });
        }
      }
    }
  };
  
  const handleUpdateEntry = (updatedEntry: BarcodeEntry) => {
    setBarcodeHistory(prev =>
        prev.map(entry => (entry.id === updatedEntry.id ? updatedEntry : entry))
    );
    setEditingEntry(null); // Close modal on save
  };

  const handleDeleteEntry = (idToDelete: string) => {
    setConfirmDialog({
      title: 'Delete Entry',
      message: 'Are you sure you want to delete this barcode entry? This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        setBarcodeHistory(prev => prev.filter(entry => entry.id !== idToDelete));
        if (selectedRowIds.has(idToDelete)) {
          const newSelected = new Set(selectedRowIds);
          newSelected.delete(idToDelete);
          setSelectedRowIds(newSelected);
        }
        setConfirmDialog(null);
      },
    });
  };

  if (!lastBarcode) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-lg mx-auto">
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-8">
                <input
                    type="file" ref={fileInputRef} onChange={handleFileChange}
                    accept=".csv,.xml" className="hidden"
                />
                <div className="flex flex-col items-center mb-6">
                    <BarcodeIcon className="w-12 h-12 text-indigo-400 mb-3" />
                    <h1 className="text-2xl font-bold text-center text-gray-100">Setup Initial Barcode</h1>
                    <p className="text-center text-gray-400 mt-2">Enter details for the first barcode or import a CSV/XML file.</p>
                </div>

                {error && <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative mb-4 text-sm" role="alert">{error}</div>}

                <form onSubmit={handleInitialSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <label htmlFor="initialBarcode" className="block text-sm font-medium text-gray-300 mb-1">Starting Barcode (EAN-13)</label>
                           <input id="initialBarcode" type="text" value={initialBarcode} onChange={(e) => setInitialBarcode(e.target.value.replace(/\D/g, ''))} maxLength={13} placeholder="13 digits" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"/>
                        </div>
                        <div>
                           <label htmlFor="productName" className="block text-sm font-medium text-gray-300 mb-1">Product Name</label>
                           <input id="productName" name="productName" type="text" value={productDetails.productName} onChange={handleDetailsChange} placeholder="e.g. T-Shirt" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"/>
                        </div>
                         <div>
                           <label htmlFor="productCode" className="block text-sm font-medium text-gray-300 mb-1">Product Code</label>
                           <input id="productCode" name="productCode" type="text" value={productDetails.productCode} onChange={handleDetailsChange} placeholder="e.g. TS-001" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"/>
                        </div>
                        <div>
                           <label htmlFor="colorComponent" className="block text-sm font-medium text-gray-300 mb-1">Color</label>
                           <input id="colorComponent" name="colorComponent" type="text" value={productDetails.colorComponent} onChange={handleDetailsChange} placeholder="e.g. Blue" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"/>
                        </div>
                        <div>
                           <label htmlFor="productType" className="block text-sm font-medium text-gray-300 mb-1">Product Type</label>
                           <input id="productType" name="productType" type="text" value={productDetails.productType} onChange={handleDetailsChange} placeholder="e.g. Apparel" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"/>
                        </div>
                        <div>
                           <label htmlFor="packageInfo" className="block text-sm font-medium text-gray-300 mb-1">Package Info</label>
                           <input id="packageInfo" name="packageInfo" type="text" value={productDetails.packageInfo} onChange={handleDetailsChange} placeholder="e.g. Single Pack" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"/>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300">
                        Start Sequence
                    </button>
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-600"></div>
                        <span className="flex-shrink mx-4 text-gray-400 text-sm">Or</span>
                        <div className="flex-grow border-t border-gray-600"></div>
                    </div>
                     <button type="button" onClick={handleImportClick} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 flex items-center justify-center">
                        <ImportIcon className="w-5 h-5 mr-2"/>
                        Import from CSV / XML
                    </button>
                </form>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-6 lg:p-8">
       <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv,.xml" className="hidden"/>
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-6">
                 <div className="flex items-center mb-4">
                    <BarcodeIcon className="w-8 h-8 text-indigo-400 mr-3" />
                    <h2 className="text-xl font-bold text-gray-100">Barcode Generator</h2>
                </div>

                {error && <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative mb-4 text-sm" role="alert">{error}</div>}
                
                <div className="mb-6 bg-gray-900/50 p-4 rounded-lg">
                    <p className="text-sm text-gray-400">Next barcode will be generated from:</p>
                    <p className="font-mono text-lg text-green-400 break-all">{lastBarcode}</p>
                </div>
                
                <form onSubmit={handleGenerateNext} className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-200 border-b border-gray-700 pb-2">Next Product Details</h3>
                    <div>
                       <label htmlFor="next_productName" className="block text-sm font-medium text-gray-300 mb-1">Product Name</label>
                       <input id="next_productName" name="productName" type="text" value={productDetails.productName} onChange={handleDetailsChange} placeholder="Required" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"/>
                    </div>
                     <div>
                       <label htmlFor="next_productCode" className="block text-sm font-medium text-gray-300 mb-1">Product Code</label>
                       <input id="next_productCode" name="productCode" type="text" value={productDetails.productCode} onChange={handleDetailsChange} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"/>
                    </div>
                    <div>
                       <label htmlFor="next_colorComponent" className="block text-sm font-medium text-gray-300 mb-1">Color</label>
                       <input id="next_colorComponent" name="colorComponent" type="text" value={productDetails.colorComponent} onChange={handleDetailsChange} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"/>
                    </div>
                    <div>
                       <label htmlFor="next_productType" className="block text-sm font-medium text-gray-300 mb-1">Product Type</label>
                       <input id="next_productType" name="productType" type="text" value={productDetails.productType} onChange={handleDetailsChange} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"/>
                    </div>
                    <div>
                       <label htmlFor="next_packageInfo" className="block text-sm font-medium text-gray-300 mb-1">Package Info</label>
                       <input id="next_packageInfo" name="packageInfo" type="text" value={productDetails.packageInfo} onChange={handleDetailsChange} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"/>
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        Generate Next
                    </button>
                </form>
            </div>
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-6">
                <h2 className="text-lg font-bold text-gray-100 mb-3">Check-Digit Calculator</h2>
                <div className="space-y-4">
                    <div>
                    <label htmlFor="checkDigitInput" className="block text-sm font-medium text-gray-300 mb-1">
                        {calculateMode ? 'Enter 12 digits' : 'Enter 13-digit barcode'}
                    </label>
                    <input 
                        id="checkDigitInput"
                        type="text"
                        value={checkDigitInput}
                        onChange={handleCheckDigitInputChange}
                        maxLength={calculateMode ? 12 : 13}
                        placeholder={calculateMode ? 'e.g. 123456789012' : 'e.g. 1234567890128'}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                        aria-label={calculateMode ? 'Enter 12 digits to calculate check digit' : 'Enter 13-digit barcode to validate'}
                    />
                    </div>
                    <div className="flex items-center">
                        <input 
                            id="calculateMode"
                            type="checkbox"
                            checked={calculateMode}
                            onChange={handleCalculateModeChange}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="calculateMode" className="ml-2 block text-sm text-gray-300 select-none cursor-pointer">
                            Calculate check digit from 12 digits
                        </label>
                    </div>
                    <button onClick={handleCheckDigitSubmit} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">
                        Verify / Calculate
                    </button>
                    {checkDigitResult && (
                    <div className={`p-3 rounded-lg text-center font-medium text-sm ${checkDigitResult.type === 'success' ? 'bg-green-900/50 text-green-300' : checkDigitResult.type === 'error' ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'}`}>
                        {checkDigitResult.message}
                    </div>
                    )}
                </div>
            </div>
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-6">
                 <h2 className="text-lg font-bold text-gray-100 mb-3">Settings & Data</h2>
                 <div className="space-y-3">
                    <button onClick={handleImportClick} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center">
                         <ImportIcon className="w-5 h-5 mr-2"/> Import & Overwrite (CSV/XML)
                    </button>
                    <button onClick={handleExportCSV} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center">
                         <ExportIcon className="w-5 h-5 mr-2"/> Export to CSV
                    </button>
                     <button onClick={handleExportXML} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center">
                         <ExportIcon className="w-5 h-5 mr-2"/> Export to XML
                    </button>
                    <button onClick={handleReset} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg mt-4">
                        Reset Application
                    </button>
                 </div>
            </div>
        </div>

        <div className="lg:col-span-2 bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
           <div className="p-6 border-b border-gray-700 space-y-4">
             {importNotice && (
               <div className="bg-indigo-950/70 border border-indigo-700/80 text-indigo-100 px-4 py-3 rounded-xl text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                 <div>
                   <p className="font-semibold text-white">{importNotice.message}</p>
                   <p className="text-xs text-indigo-300 mt-0.5">
                     Total Rows: <span className="font-bold text-white">{importNotice.report.importedCount}</span>
                     {' · '}Valid EAN-13: <span className="font-bold text-green-400">{importNotice.report.validEanCount}</span>
                     {importNotice.report.autoFixedFormatCount > 0 && (
                       <> · Format Normalized: <span className="font-bold text-blue-300">{importNotice.report.autoFixedFormatCount}</span></>
                     )}
                     {importNotice.report.invalidEanCount > 0 && (
                       <> · Check-Digit Warnings: <span className="font-bold text-amber-400">{importNotice.report.invalidEanCount}</span></>
                     )}
                   </p>
                 </div>
                 <div className="flex items-center gap-2 shrink-0">
                   {invalidBarcodeCount > 0 && (
                     <button
                       onClick={handleFixAllInvalidCheckDigits}
                       className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition"
                     >
                       Fix All Invalid ({invalidBarcodeCount})
                     </button>
                   )}
                   <button
                     onClick={() => setImportNotice(null)}
                     className="text-indigo-300 hover:text-white p-1"
                     aria-label="Dismiss import notice"
                   >
                     ✕
                   </button>
                 </div>
               </div>
             )}

             <div className="flex justify-between items-center flex-wrap gap-3">
                 <div>
                    <h2 className="text-xl font-bold text-gray-100">Generated Barcodes History</h2>
                    <p className="text-gray-400 mt-1 text-sm">
                      Showing <span className="font-semibold text-gray-200">{filteredHistory.length}</span> of <span className="font-semibold text-gray-200">{barcodeHistory.length}</span> total barcodes
                    </p>
                 </div>
                 {selectedRowIds.size > 0 && (
                    <div className="flex items-center space-x-3">
                         <button 
                            onClick={handleExportSelectedExcel}
                            disabled={isExporting}
                            className={`${isExporting ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'} text-white font-bold py-2 px-4 rounded-lg flex items-center transition-all animate-scale-in shadow-lg`}
                        >
                            {isExporting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <ExportIcon className="w-5 h-5 mr-2" />
                                    Export as Excel ({selectedRowIds.size})
                                </>
                            )}
                        </button>
                         <button 
                            onClick={handleCopyAsTable}
                            disabled={isTableCopied}
                            className={`${isTableCopied ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-2 px-4 rounded-lg flex items-center transition-all animate-scale-in shadow-lg min-w-[160px] justify-center`}
                        >
                             {isTableCopied ? (
                                <>
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <ClipboardIcon className="w-5 h-5 mr-2" />
                                    Copy as table
                                </>
                            )}
                        </button>
                    </div>
                 )}
             </div>

             <div className="flex flex-col sm:flex-row gap-3">
               <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <SearchIcon className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by Barcode, Product Name, Code, Color, or Row ID..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-indigo-500 focus:border-indigo-500"
                  />
               </div>
               {invalidBarcodeCount > 0 && (
                 <div className="flex items-center gap-1.5 bg-gray-900/60 p-1 rounded-lg border border-gray-700 shrink-0">
                   <button
                     type="button"
                     onClick={() => setValidityFilter('all')}
                     className={`px-2.5 py-1.5 rounded text-xs font-medium transition ${
                       validityFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                     }`}
                   >
                     All ({barcodeHistory.length})
                   </button>
                   <button
                     type="button"
                     onClick={() => setValidityFilter('invalid')}
                     className={`px-2.5 py-1.5 rounded text-xs font-medium transition ${
                       validityFilter === 'invalid' ? 'bg-amber-600 text-white' : 'text-amber-400 hover:text-amber-300'
                     }`}
                   >
                     Invalid Digit ({invalidBarcodeCount})
                   </button>
                   <button
                     type="button"
                     onClick={handleFixAllInvalidCheckDigits}
                     className="px-2.5 py-1.5 rounded text-xs font-semibold bg-amber-600/20 text-amber-300 hover:bg-amber-600 hover:text-white border border-amber-600/40 transition"
                     title="Automatically recalculate and fix the 13th check digit for all invalid barcodes"
                   >
                     Fix All
                   </button>
                 </div>
               )}
             </div>
           </div>
           <div className="overflow-y-auto overflow-x-hidden flex-grow">
                {barcodeHistory.length > 0 ? (
                    <>
                    <table className="w-full text-sm text-left text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700/50 sticky top-0 z-10">
                            <tr>
                                <th scope="col" className="px-4 py-3 whitespace-nowrap w-24">
                                    <div className="flex items-center">
                                        <input 
                                            id="checkbox-all"
                                            type="checkbox" 
                                            className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2 mr-3 cursor-pointer"
                                            checked={isAllVisibleSelected}
                                            onChange={handleSelectAll}
                                        />
                                        <label htmlFor="checkbox-all" className="cursor-pointer">Row ID</label>
                                    </div>
                                </th>
                                <th scope="col" className="px-4 py-3 whitespace-nowrap w-48">Barcode</th>
                                <th scope="col" className="px-4 py-3">Product Name</th>
                                <th scope="col" className="px-4 py-3 whitespace-nowrap text-center w-36">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {paginatedHistory.map((entry) => {
                                const isValid = validateEan13(entry.barcode);
                                return (
                                <tr key={entry.id} className={`hover:bg-gray-700/50 ${selectedRowIds.has(entry.id) ? 'bg-gray-700/30' : ''}`}>
                                    <td className="px-4 py-4 font-bold whitespace-nowrap">
                                         <div className="flex items-center">
                                            <input 
                                                id={`checkbox-${entry.id}`}
                                                type="checkbox" 
                                                className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2 mr-3 cursor-pointer"
                                                checked={selectedRowIds.has(entry.id)}
                                                onChange={() => handleSelectRow(entry.id)}
                                            />
                                            <label htmlFor={`checkbox-${entry.id}`} className="cursor-pointer">{entry.rowId}</label>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                        <div 
                                            className="p-2 bg-white rounded-md shrink-0 cursor-pointer hover:scale-105 transition-transform self-start sm:self-center"
                                            onClick={() => setSelectedBarcode(entry)}
                                            title="Click to enlarge barcode"
                                            aria-label={`Enlarge barcode for ${entry.productName}`}
                                        >
                                          <Barcode value={entry.barcode} id={`barcode-${entry.id}`} />
                                        </div>
                                        <div className="flex flex-col">
                                            <div className={`flex items-center space-x-2 font-mono ${isValid ? 'text-green-400' : 'text-amber-400'}`}>
                                                <span>{entry.barcode || 'EMPTY'}</span>
                                                <div className="relative">
                                                    <button onClick={() => handleCopyBarcode(entry.barcode, entry.id)} className="text-gray-400 hover:text-white" title="Copy barcode number">
                                                      <ClipboardIcon className="w-5 h-5" />
                                                    </button>
                                                    {copiedStatus[entry.id] && <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 pointer-events-none animate-fade-out">Copied!</div>}
                                                </div>
                                            </div>
                                            {!isValid && (
                                              <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[11px] bg-amber-900/60 text-amber-300 border border-amber-700/60 px-1.5 py-0.5 rounded">
                                                  Check Digit Warning
                                                </span>
                                                {/^\d{12,13}$/.test(entry.barcode.replace(/\D/g, '')) && (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleFixSingleBarcode(entry)}
                                                    className="text-[11px] bg-amber-600 hover:bg-amber-500 text-white font-semibold px-2 py-0.5 rounded transition"
                                                    title="Recalculate and fix 13th check digit"
                                                  >
                                                    Fix Digit
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                            <button onClick={() => handleDownloadBarcode(entry)} className="text-xs text-gray-400 hover:text-white transition flex items-center space-x-1 mt-1" title="Download SVG">
                                                <DownloadIcon className="w-4 h-4" />
                                                <span>Download</span>
                                            </button>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 break-words">{entry.productName}</td>
                                    <td className="px-4 py-4 text-center whitespace-nowrap">
                                      <div className="flex items-center justify-center space-x-2">
                                        <button 
                                            onClick={() => setDetailsEntry(entry)} 
                                            className="text-gray-400 hover:text-indigo-400 p-2 rounded-full hover:bg-gray-700 transition"
                                            title="View details"
                                            aria-label={`View details for ${entry.productName}`}
                                        >
                                            <InfoIcon className="w-5 h-5"/>
                                        </button>
                                        <button 
                                            onClick={() => setEditingEntry(entry)} 
                                            className="text-gray-400 hover:text-green-400 p-2 rounded-full hover:bg-gray-700 transition"
                                            title="Edit entry"
                                            aria-label={`Edit entry for ${entry.productName}`}
                                        >
                                            <EditIcon className="w-5 h-5"/>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteEntry(entry.id)} 
                                            className="text-gray-400 hover:text-red-400 p-2 rounded-full hover:bg-gray-700 transition"
                                            title="Delete entry"
                                            aria-label={`Delete entry for ${entry.productName}`}
                                        >
                                            <DeleteIcon className="w-5 h-5"/>
                                        </button>
                                      </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredHistory.length === 0 && (
                         <div className="flex items-center justify-center h-full p-10">
                            <p className="text-gray-500">No barcodes found matching your search.</p>
                        </div>
                    )}
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full p-10">
                        <p className="text-gray-500">No barcodes generated yet.</p>
                    </div>
                )}
           </div>
            {filteredHistory.length > 0 && (
                <div className="p-4 border-t border-gray-700 flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <label htmlFor="items-per-page" className="text-sm text-gray-400 mr-2">Rows per page:</label>
                        <select
                            id="items-per-page"
                            value={itemsPerPage}
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            className="bg-gray-700 border border-gray-600 rounded-md p-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            aria-label="Number of rows per page"
                        >
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            aria-label="Go to previous page"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-400 font-medium">
                            Page {currentPage} of {totalPages || 1}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            aria-label="Go to next page"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
       <ImageModal 
            isOpen={!!selectedBarcode}
            onClose={() => setSelectedBarcode(null)}
            barcodeEntry={selectedBarcode}
        />
       <DetailsModal
            isOpen={!!detailsEntry}
            onClose={() => setDetailsEntry(null)}
            barcodeEntry={detailsEntry}
        />
       <EditModal
            isOpen={!!editingEntry}
            onClose={() => setEditingEntry(null)}
            onSave={handleUpdateEntry}
            barcodeEntry={editingEntry}
        />
       {confirmDialog && (
         <div
           className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4"
           onClick={() => setConfirmDialog(null)}
           aria-modal="true"
           role="dialog"
         >
           <div
             className="bg-gray-800 p-6 rounded-2xl shadow-xl relative max-w-md w-full animate-scale-in border border-gray-700"
             onClick={e => e.stopPropagation()}
           >
             <h3 className="text-xl font-bold text-white mb-2">{confirmDialog.title}</h3>
             <p className="text-gray-300 text-sm mb-6">{confirmDialog.message}</p>
             <div className="flex justify-end space-x-3">
               <button
                 type="button"
                 onClick={() => setConfirmDialog(null)}
                 className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-semibold transition text-sm"
               >
                 Cancel
               </button>
               <button
                 type="button"
                 onClick={confirmDialog.onConfirm}
                 className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition text-sm"
               >
                 {confirmDialog.confirmLabel}
               </button>
             </div>
           </div>
         </div>
       )}
    </div>
  );
};

export default App;