/**
 * Calculates the EAN-13 check digit for a 12-digit base.
 * @param base12 A string containing 12 digits.
 * @returns The calculated check digit as a number.
 */
export const calculateCheckDigit = (base12: string): number => {
  if (base12.length !== 12 || !/^\d+$/.test(base12)) {
    throw new Error("Input must be a 12-digit string.");
  }

  const digits = base12.split('').map(Number);

  // AL-001, AL-002: Sum digits at even positions (2, 4, ...) and multiply by 3
  let sumEven = 0;
  for (let i = 1; i < 12; i += 2) {
    sumEven += digits[i];
  }
  const resultB = sumEven * 3;

  // AL-003: Sum digits at odd positions (1, 3, ...)
  let sumOdd = 0;
  for (let i = 0; i < 12; i += 2) {
    sumOdd += digits[i];
  }
  const resultC = sumOdd;

  // AL-004: Total sum
  const totalSum = resultB + resultC;

  // AL-005, AL-006: Calculate check digit
  const checkDigit = (10 - (totalSum % 10)) % 10;
  
  return checkDigit;
};

/**
 * Validates a full 13-digit EAN-13 barcode.
 * @param barcode A string containing 13 digits.
 * @returns True if the barcode is valid, false otherwise.
 */
export const validateEan13 = (barcode: string): boolean => {
  if (barcode.length !== 13 || !/^\d+$/.test(barcode)) {
    return false;
  }
  const base12 = barcode.substring(0, 12);
  const providedCheckDigit = Number(barcode.charAt(12));
  const calculatedCheckDigit = calculateCheckDigit(base12);
  return providedCheckDigit === calculatedCheckDigit;
};

/**
 * Increments a 12-digit barcode base by one.
 * Uses BigInt to handle large numbers safely.
 * @param base12 A string containing 12 digits.
 * @returns The incremented 12-digit base as a string, padded with leading zeros.
 */
export const incrementBarcodeBase = (base12: string): string => {
  if (base12.length !== 12 || !/^\d+$/.test(base12)) {
    throw new Error("Input must be a 12-digit string.");
  }
  
  const nextValue = BigInt(base12) + 1n;
  
  return nextValue.toString().padStart(12, '0');
};
