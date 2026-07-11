/**
 * Shared utility functions for the Anum Vista frontend.
 */

/**
 * Escapes HTML special characters to prevent XSS in dynamically generated HTML.
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
