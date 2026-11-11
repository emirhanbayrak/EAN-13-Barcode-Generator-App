import React from 'react';

const BarcodeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 5v14" />
    <path d="M6 5v14" />
    <path d="M10 5v14" />
    <path d="M14 5v14" />
    <path d="M18 5v14" />
    <path d="M21 5v14" />
  </svg>
);

export default BarcodeIcon;
