/**
 * htmlEscape - minimal HTML entity escaping for values interpolated into
 * innerHTML / HTML-formatted strings (tables, chart tooltips, graph tooltip).
 *
 * Escapes the five characters that are significant in HTML markup/attributes:
 * & < > " '
 */
const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * @param {unknown} value - any value (coerced with String())
 * @returns {string} escaped string safe to embed in HTML
 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}
