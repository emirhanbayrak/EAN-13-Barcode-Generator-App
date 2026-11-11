import React from 'react';

// EAN-13 encoding patterns
const L_CODES: { [key: string]: string } = {
  '0': '0001101', '1': '0011001', '2': '0010011', '3': '0111101', '4': '0100011',
  '5': '0110001', '6': '0101111', '7': '0111011', '8': '0110111', '9': '0001011',
};

const G_CODES: { [key: string]: string } = {
  '0': '0100111', '1': '0110011', '2': '0011011', '3': '0100001', '4': '0011101',
  '5': '0111001', '6': '0000101', '7': '0010001', '8': '0001001', '9': '0010111',
};

const R_CODES: { [key: string]: string } = {
  '0': '1110010', '1': '1100110', '2': '1101100', '3': '1000010', '4': '1011100',
  '5': '1001110', '6': '1010000', '7': '1000100', '8': '1001000', '9': '1110100',
};

// Parity patterns determine which encoding (L or G) to use for the left-hand side digits
const PARITY_PATTERNS: { [key: string]: string } = {
  '0': 'LLLLLL', '1': 'LLGLGG', '2': 'LLGGLG', '3': 'LLGGGL', '4': 'LGLLGG',
  '5': 'LGGLLG', '6': 'LGGGLL', '7': 'LGLGLG', '8': 'LGLGGL', '9': 'LGGLGL',
};

const Barcode: React.FC<{ value: string; id: string; width?: number; height?: number; }> = ({ value, id, width = 120, height = 60 }) => {
  if (!value || value.length !== 13 || !/^\d+$/.test(value)) {
    return (
      <div
        style={{ width, height }}
        className="flex flex-col items-center justify-center bg-red-50 text-red-700 border border-red-300 rounded text-[10px] font-mono px-1 text-center leading-tight"
        title={`Invalid EAN-13 length/format: "${value || 'Empty'}"`}
      >
        <span className="font-bold">INVALID EAN-13</span>
        <span className="truncate max-w-full">{value || 'BOŞ / EMPTY'}</span>
      </div>
    );
  }

  const firstDigit = value[0];
  const leftSideDigits = value.substring(1, 7);
  const rightSideDigits = value.substring(7);

  const parityPattern = PARITY_PATTERNS[firstDigit];
  if (!parityPattern) return null;

  let leftBinary = '';
  for (let i = 0; i < 6; i++) {
    const digit = leftSideDigits[i];
    const patternType = parityPattern[i];
    leftBinary += patternType === 'L' ? L_CODES[digit] : G_CODES[digit];
  }

  let rightBinary = '';
  for (let i = 0; i < 6; i++) {
    const digit = rightSideDigits[i];
    rightBinary += R_CODES[digit];
  }

  const fullBinary = `101${leftBinary}01010${rightBinary}101`;

  const BAR_WIDTH = 2;
  const DATA_BAR_HEIGHT = 80;
  const GUARD_BAR_HEIGHT = 90;
  const FONT_SIZE = 16;

  const bars = fullBinary.split('').map((bit, index) => {
    if (bit === '0') return null; // '0' is a space

    const isGuard = index < 3 || (index >= 45 && index < 50) || index >= 92;
    const height = isGuard ? GUARD_BAR_HEIGHT : DATA_BAR_HEIGHT;

    return (
      <rect
        key={index}
        x={index * BAR_WIDTH}
        y={0}
        width={BAR_WIDTH}
        height={height}
        fill="black"
      />
    );
  });

  const totalBarWidth = fullBinary.length * BAR_WIDTH;
  const svgWidth = totalBarWidth + (10 * BAR_WIDTH);
  const svgHeight = GUARD_BAR_HEIGHT + FONT_SIZE + 5;

  return (
    <svg
      id={id}
      width={width}
      height={height}
      viewBox={`-15 -5 ${svgWidth + 10} ${svgHeight + 5}`}
      fontFamily="ELMS SANS, monospace"
      role="img"
      aria-label={`EAN-13 barcode for ${value}`}
    >
      <title>EAN-13 barcode for {value}</title>
      <g transform={`translate(0, 0)`}>{bars}</g>
      <text x={-10} y={GUARD_BAR_HEIGHT + FONT_SIZE} fontSize={FONT_SIZE} textAnchor="middle">
        {firstDigit}
      </text>
      <text x={(3 + 42 / 2) * BAR_WIDTH} y={GUARD_BAR_HEIGHT + FONT_SIZE} fontSize={FONT_SIZE} textAnchor="middle" letterSpacing="5">
        {leftSideDigits}
      </text>
      <text x={(3 + 42 + 5 + 42 / 2) * BAR_WIDTH} y={GUARD_BAR_HEIGHT + FONT_SIZE} fontSize={FONT_SIZE} textAnchor="middle" letterSpacing="5">
        {rightSideDigits}
      </text>
    </svg>
  );
};

export default Barcode;