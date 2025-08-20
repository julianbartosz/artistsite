import React from 'react';

interface ArtworkSvgProps {
  className?: string;
  width?: number;
  height?: number;
}

export function CustomPortraitSvg({ className = "", width = 400, height = 300 }: ArtworkSvgProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 400 300" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="portraitBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F3E5F5" />
          <stop offset="100%" stopColor="#E1BEE7" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#portraitBg)" />
      <rect x="80" y="50" width="240" height="200" fill="#FFF" stroke="#E0E0E0" strokeWidth="2" />
      <ellipse cx="200" cy="130" rx="50" ry="65" fill="#FFDBCB" stroke="#D7CCC8" strokeWidth="1" />
      <ellipse cx="185" cy="115" rx="8" ry="5" fill="#5D4037" />
      <ellipse cx="215" cy="115" rx="8" ry="5" fill="#5D4037" />
      <circle cx="185" cy="115" r="2" fill="#FFF" />
      <circle cx="215" cy="115" r="2" fill="#FFF" />
      <path d="M200 125 L195 135 L200 140 L205 135 Z" fill="#EFEBE9" stroke="#D7CCC8" strokeWidth="0.5" />
      <path d="M190 150 Q200 155 210 150" stroke="#8D6E63" strokeWidth="2" fill="none" />
      <path d="M150 100 Q200 80 250 100 Q240 120 200 110 Q160 120 150 100" fill="#6D4C41" />
      <path d="M120 220 Q200 200 280 220 L280 250 L120 250 Z" fill="#424242" />
      <rect x="20" y="20" width="120" height="40" fill="#FFF" stroke="#E0E0E0" strokeWidth="1" rx="5" />
      <text x="30" y="35" fontSize="10" fill="#424242" fontWeight="bold">Custom Portrait</text>
      <text x="30" y="50" fontSize="8" fill="#666">Your photo → Art</text>
      <text x="340" y="280" fontSize="8" fill="#666">Oil • Acrylic • Charcoal</text>
    </svg>
  );
}
