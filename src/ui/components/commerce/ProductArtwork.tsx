// src/ui/components/commerce/ProductArtwork.tsx
import React from 'react';
import {
  UrbanTwilightSvg,
  WaterReflectionsSvg,
  UrbanConvergenceSvg,
  GoldenHourPrintSvg,
  UrbanSketchesSvg,
  CustomPortraitSvg,
  GenericArtworkSvg,
} from '@ui/illustrations/artwork';

export interface ProductArtworkProps {
  productId: string;
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
}

type ArtworkSvgProps = { className?: string; width?: number; height?: number };

type ArtworkSvgComponent = React.ComponentType<ArtworkSvgProps>;

const PRODUCT_SVG_MAP: Record<string, ArtworkSvgComponent> = {
  'oil-painting-urban-twilight': UrbanTwilightSvg,
  'charcoal-study-reflections': WaterReflectionsSvg,
  'mixed-media-convergence': UrbanConvergenceSvg,
  'print-limited-golden-hour': GoldenHourPrintSvg,
  'sketchbook-urban-studies': UrbanSketchesSvg,
  'commission-portrait-custom': CustomPortraitSvg,
};

export function ProductArtwork({
  productId,
  className = '',
  width = 400,
  height = 300,
  alt = 'Artwork',
}: ProductArtworkProps) {
  const SvgComponent = PRODUCT_SVG_MAP[productId] || GenericArtworkSvg;
  return (
    <div className={`artwork-image ${className}`} role="img" aria-label={alt}>
      <SvgComponent width={width} height={height} className="w-full h-full" />
    </div>
  );
}

export default ProductArtwork;