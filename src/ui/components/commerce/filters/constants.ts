export const CATEGORIES = [
  'Paintings',
  'Sculptures',
  'Prints',
  'Digital Art',
  'Mixed Media',
  'Photography'
];

export const MEDIUMS = [
  'Oil',
  'Acrylic',
  'Watercolor',
  'Digital',
  'Bronze',
  'Marble',
  'Canvas',
  'Paper'
];

export const DIMENSIONS = [
  { label: 'Small (under 12")', value: 'small' },
  { label: 'Medium (12" - 24")', value: 'medium' },
  { label: 'Large (over 24")', value: 'large' }
];

export const PRICE_RANGES = [
  { label: 'Under $500', min: 0, max: 500 },
  { label: '$500 - $1,000', min: 500, max: 1000 },
  { label: '$1,000 - $2,500', min: 1000, max: 2500 },
  { label: '$2,500 - $5,000', min: 2500, max: 5000 },
  { label: 'Over $5,000', min: 5000, max: 50000 }
];
