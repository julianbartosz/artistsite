import React from 'react';

interface ArtworkSvgProps {
  className?: string;
  width?: number;
  height?: number;
}

export function GenericArtworkSvg({ className = "", width = 400, height = 300 }: ArtworkSvgProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 400 300" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#F5F5F5" stroke="#E0E0E0" strokeWidth="2" />
      <circle cx="150" cy="100" r="40" fill="#2196F3" opacity="0.7" />
      <rect x="220" y="80" width="60" height="60" fill="#FF9800" opacity="0.6" transform="rotate(15 250 110)" />
      <polygon points="100,200 150,160 200,200 150,240" fill="#4CAF50" opacity="0.8" />
      <path d="M50 50 Q200 100 350 50" stroke="#9C27B0" strokeWidth="8" fill="none" opacity="0.5" />
      <path d="M350 250 Q200 200 50 250" stroke="#E91E63" strokeWidth="6" fill="none" opacity="0.6" />
      <circle cx="350" cy="50" r="20" fill="#FFF" stroke="#E0E0E0" strokeWidth="1" />
      <circle cx="345" cy="45" r="3" fill="#F44336" />
      <circle cx="355" cy="45" r="3" fill="#2196F3" />
      <circle cx="345" cy="55" r="3" fill="#FFEB3B" />
      <circle cx="355" cy="55" r="3" fill="#4CAF50" />
      <text x="320" y="280" fontSize="12" fill="#666" fontStyle="italic">Original Art</text>
    </svg>
  );
}
