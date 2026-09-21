'use client';

import { useEffect } from 'react';
import { themeCssVariables, type SiteTheme } from '@/lib/site-content-shared';

export function useLiveSiteTheme(theme: SiteTheme | undefined): void {
  useEffect(() => {
    if (!theme) return undefined;

    const variables = themeCssVariables(theme);
    const root = document.documentElement;
    const previous = new Map<string, string>();

    for (const [name, value] of Object.entries(variables)) {
      previous.set(name, root.style.getPropertyValue(name));
      root.style.setProperty(name, value);
    }

    return () => {
      for (const [name, prior] of previous.entries()) {
        if (prior) {
          root.style.setProperty(name, prior);
        } else {
          root.style.removeProperty(name);
        }
      }
    };
  }, [theme?.primaryColor, theme?.accentColor, theme?.fontPreset, theme?.cardStyle, theme?.spacingDensity]);
}
