import React from 'react';

interface ArtworkSvgProps {
  className?: string;
  width?: number;
  height?: number;
}

export function GoldenHourPrintSvg({ className = "", width = 400, height = 300 }: ArtworkSvgProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 400 300" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sunGradient" cx="80%" cy="20%">
          <stop offset="0%" stopColor="#FFF9C4" />
          <stop offset="40%" stopColor="#FFE082" />
          <stop offset="80%" stopColor="#FFB74D" />
          <stop offset="100%" stopColor="#FF8A65" />
        </radialGradient>
        <linearGradient id="landscapeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#81C784" />
          <stop offset="100%" stopColor="#388E3C" />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill="url(#sunGradient)" />
      <circle cx="320" cy="60" r="30" fill="#FFF59D" opacity="0.9" />
      <path d="M0 160 Q100 140 200 160 Q300 140 400 160 L400 300 L0 300 Z" fill="url(#landscapeGradient)" />
      <path d="M0 180 Q150 160 300 180 Q350 170 400 180 L400 300 L0 300 Z" fill="#4CAF50" opacity="0.8" />
      <ellipse cx="80" cy="170" rx="15" ry="25" fill="#2E7D32" />
      <ellipse cx="150" cy="165" rx="12" ry="20" fill="#2E7D32" />
      <ellipse cx="280" cy="172" rx="18" ry="30" fill="#2E7D32" />
      <path d="M320 60 L100 180" stroke="#FFF9C4" strokeWidth="2" opacity="0.4" />
      <path d="M320 60 L150 200" stroke="#FFF9C4" strokeWidth="1.5" opacity="0.3" />
      <path d="M320 60 L250 190" stroke="#FFF9C4" strokeWidth="2" opacity="0.4" />
      <rect x="10" y="10" width="380" height="280" fill="none" stroke="#E0E0E0" strokeWidth="2" />
      <text x="20" y="290" fontSize="8" fill="#666" opacity="0.7">Limited Edition 23/50</text>
    </svg>
  );
}
