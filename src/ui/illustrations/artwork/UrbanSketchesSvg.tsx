import React from 'react';

interface ArtworkSvgProps {
  className?: string;
  width?: number;
  height?: number;
}

export function UrbanSketchesSvg({ className = "", width = 400, height = 300 }: ArtworkSvgProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 400 300" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#FAFAFA" stroke="#E0E0E0" strokeWidth="1" />
      <circle cx="30" cy="40" r="3" fill="none" stroke="#BDBDBD" strokeWidth="1" />
      <circle cx="30" cy="80" r="3" fill="none" stroke="#BDBDBD" strokeWidth="1" />
      <circle cx="30" cy="120" r="3" fill="none" stroke="#BDBDBD" strokeWidth="1" />
      <circle cx="30" cy="160" r="3" fill="none" stroke="#BDBDBD" strokeWidth="1" />
      <circle cx="30" cy="200" r="3" fill="none" stroke="#BDBDBD" strokeWidth="1" />
      <g stroke="#424242" strokeWidth="1.5" fill="none">
        <rect x="60" y="60" width="40" height="60" />
        <line x1="65" y1="70" x2="75" y2="70" />
        <line x1="65" y1="80" x2="75" y2="80" />
        <line x1="85" y1="70" x2="95" y2="70" />
        <line x1="85" y1="80" x2="95" y2="80" />
        <rect x="120" y="40" width="35" height="80" />
        <line x1="125" y1="50" x2="135" y2="50" />
        <line x1="125" y1="60" x2="135" y2="60" />
        <line x1="140" y1="50" x2="150" y2="50" />
        <circle cx="180" cy="90" r="8" />
        <line x1="180" y1="98" x2="180" y2="130" />
        <line x1="180" y1="110" x2="170" y2="120" />
        <line x1="180" y1="110" x2="190" y2="120" />
        <line x1="180" y1="130" x2="170" y2="150" />
        <line x1="180" y1="130" x2="190" y2="150" />
        <ellipse cx="250" cy="110" rx="30" ry="12" />
        <circle cx="235" cy="120" r="6" />
        <circle cx="265" cy="120" r="6" />
      </g>
      <text x="60" y="140" fontSize="8" fill="#666">morning light</text>
      <text x="180" y="170" fontSize="8" fill="#666">rush hour</text>
      <text x="220" y="140" fontSize="8" fill="#666">reflections</text>
      <text x="320" y="280" fontSize="10" fill="#424242" fontStyle="italic">J.B. →24</text>
    </svg>
  );
}
