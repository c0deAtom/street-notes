import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Assigns unique IDs to all <mark> tags in the given HTML string.
 * IDs will be in the form highlight-0, highlight-1, ...
 * @param html The HTML content string
 * @returns The HTML string with unique IDs on all <mark> tags
 */
export function assignUniqueIDsToMarks(html: string): string {
  if (!html) return html;
  let idx = 0;
  // Replace all <mark ...> tags (with or without attributes)
  return html.replace(/<mark(?![^>]*\bid=)[^>]*?>/g, (match) => {
    // Remove any existing id attribute
    let cleaned = match.replace(/id\s*=\s*(['\"]).*?\1/, '');
    // Add the new id attribute
    cleaned = cleaned.replace('<mark', `<mark id=\"highlight-${idx++}\"`);
    return cleaned;
  });
}
