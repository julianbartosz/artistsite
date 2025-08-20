import React from 'react';

interface ArtworkSvgProps {
  className?: string;
  width?: number;
  height?: number;
}

export function UrbanConvergenceSvg({ className = "", width = 400, height = 300 }: ArtworkSvgProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 400 300" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="energyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF5722" />
          <stop offset="30%" stopColor="#FF9800" />
          <stop offset="60%" stopColor="#FFC107" />
          <stop offset="100%" stopColor="#4CAF50" />
        </linearGradient>
        <pattern id="collagePattern" patternUnits="userSpaceOnUse" width="50" height="50">
          <rect width="50" height="50" fill="#E3F2FD" />
          <circle cx="25" cy="25" r="10" fill="#1976D2" opacity="0.3" />
        </pattern>
      </defs>
      <rect width="400" height="300" fill="url(#collagePattern)" />
      <polygon points="50,50 150,80 120,180 20,150" fill="url(#energyGradient)" opacity="0.8" />
      <polygon points="200,30 350,60 320,120 180,90" fill="#E91E63" opacity="0.7" />
      <polygon points="250,150 380,180 350,250 220,220" fill="#673AB7" opacity="0.6" />
      <circle cx="100" cy="200" r="20" fill="#CFD8DC" stroke="#90A4AE" strokeWidth="2" />
      <rect x="280" y="100" width="30" height="30" fill="#ECEFF1" stroke="#B0BEC5" strokeWidth="1" transform="rotate(45 295 115)" />
      <circle cx="80" cy="120" r="15" fill="#FF5722" opacity="0.6" />
      <circle cx="320" cy="180" r="12" fill="#4CAF50" opacity="0.7" />
      <circle cx="180" cy="250" r="18" fill="#FF9800" opacity="0.5" />
      <path d="M0 0 Q200 150 400 0" stroke="#FFC107" strokeWidth="3" fill="none" opacity="0.8" />
      <path d="M0 300 Q200 150 400 300" stroke="#FF5722" strokeWidth="2" fill="none" opacity="0.6" />
      <rect width="400" height="300" fill="none" stroke="#000" strokeWidth="1" opacity="0.1" strokeDasharray="5,5" />
    </svg>
  );
}
