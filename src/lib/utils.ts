import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Resolves `path` against `base`; returns `path` unchanged when `base` is empty or not a valid URL. */
export function absoluteUrl(path: string, base: string): string {
  if (!base) return path;
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

/** Parses a same-site path such as `/shop?x=1#y`; returns null for anything that could point off-site. */
export function parseInternalPath(raw: string): URL | null {
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  const base = 'http://internal.local';
  try {
    const parsed = new URL(raw, base);
    return parsed.origin === base ? parsed : null;
  } catch {
    return null;
  }
}
