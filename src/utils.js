/**
 * Small pure DOM-escaping helpers.
 *
 * These keep HTML construction safe when untrusted values (e.g. CSV column
 * values supplied by the user) are interpolated into innerHTML. Keeping the
 * logic pure (no DOM access) makes it directly unit-testable.
 */

/**
 * HTML-encode a value so it can be interpolated safely into innerHTML.
 * Non-string values are coerced; null/undefined become an empty string.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build the escaped HTML rows for the STI reference table.
 * Mirrors the column layout used by AppController.populateSTIRawTable.
 */
export function buildStiTableRows(pathogens) {
  return (pathogens || [])
    .slice(0, 15)
    .map(p => `
      <tr>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${escapeHtml(p.category)}</td>
        <td>${escapeHtml(p.curable)}</td>
        <td>${escapeHtml(p.sfHighRiskGroup || 'General')}</td>
        <td>${escapeHtml(p.condomTypicalEfficacy)}%</td>
      </tr>
    `)
    .join('');
}
