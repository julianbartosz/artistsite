'use client';

import React from 'react';
import { Printer } from 'lucide-react';

export default function CertificatePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
    >
      <Printer className="h-3.5 w-3.5" aria-hidden="true" />
      Print / Save PDF
    </button>
  );
}
