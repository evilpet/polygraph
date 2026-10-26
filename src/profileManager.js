/**
 * ProfileManager - Handles Export, Import, and Shareable URL Links for PolyGraph Profiles.
 */

/**
 * Sanitizes an untrusted profile payload (shared-URL import / JSON import) against
 * the app's current parameter schema (key names + value types from defaults).
 *
 * Only keys present in the schema are accepted: numbers must coerce to finite
 * numbers, booleans are coerced, and strings must already be strings. Anything
 * else (unknown keys, HTML strings in numeric fields, __proto__/constructor/
 * prototype, arrays, objects) is dropped. This stops crafted share links from
 * injecting markup into downstream sinks (graph labels -> innerHTML) or from
 * polluting object prototypes.
 *
 * @param {object|null|undefined} imported - untrusted parsed JSON value
 * @param {object} schema - object whose own keys/types define what is allowed
 * @returns {object} clean subset of `imported`
 */
export function sanitizeProfileParams(imported, schema) {
  const clean = {};
  if (!imported || typeof imported !== 'object' || Array.isArray(imported)) return clean;
  if (!schema || typeof schema !== 'object') return clean;
  for (const key of Object.keys(schema)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (!Object.prototype.hasOwnProperty.call(imported, key)) continue;
    const value = imported[key];
    const defaultType = typeof schema[key];
    if (defaultType === 'number') {
      const num = Number(value);
      if (Number.isFinite(num)) clean[key] = num;
    } else if (defaultType === 'boolean') {
      clean[key] = Boolean(value);
    } else if (defaultType === 'string' && typeof value === 'string') {
      clean[key] = value;
    }
  }
  return clean;
}

export class ProfileManager {
  constructor(appController) {
    this.app = appController;
  }

  /**
   * Generates a clean profile export payload object.
   */
  getExportPayload(profileName = 'PolyGraph Shared Profile') {
    return {
      version: '1.0.0',
      title: profileName,
      exportedAt: new Date().toISOString(),
      params: { ...this.app.params },
      prophylactics: { ...this.app.prophylactics }
    };
  }

  /**
   * Downloads the current profile as a formatted JSON file.
   */
  exportToFile(filename = 'polygraph_profile.json') {
    const payload = this.getExportPayload();
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Parses and validates JSON profile input and applies it to the app state.
   */
  importFromJSON(jsonText) {
    try {
      const data = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid JSON structure.');
      }

      const importedParams = data.params || data;
      const importedProphylactics = data.prophylactics || {};

      // Validate imported parameters against the app's parameter schema before
      // merging (untrusted file content -> prevents HTML injection + prototype pollution).
      const cleanParams = sanitizeProfileParams(importedParams, this.app.params);
      const cleanProphylactics = sanitizeProfileParams(importedProphylactics, this.app.prophylactics);

      // Merge imported parameters into app state
      this.app.params = { ...this.app.params, ...cleanParams };
      this.app.prophylactics = { ...this.app.prophylactics, ...cleanProphylactics };

      // Update UI & Storage
      this.app.syncUIWithParams();
      this.app.saveToLocalStorage();
      this.app.updateAll();

      return { success: true, message: 'Profile imported successfully!' };
    } catch (err) {
      console.error('Import error:', err);
      return { success: false, message: `Import failed: ${err.message}` };
    }
  }

  /**
   * Generates a compressed shareable URL link for the current profile.
   */
  generateShareableURL() {
    const payload = this.getExportPayload();
    const jsonStr = JSON.stringify({ p: payload.params, pr: payload.prophylactics });
    const b64 = encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#profile=${b64}`;
  }

  /**
   * Copies the shareable URL to clipboard.
   */
  async copyShareableURLToClipboard() {
    const url = this.generateShareableURL();
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (err) {
      console.warn('Clipboard write failed, using execCommand fallback:', err);
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      return true;
    }
  }

  /**
   * Checks window URL hash/search on page initialization and loads shared profile if present.
   */
  loadFromURLIfPresent() {
    try {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const source = hash.includes('profile=') ? hash : search;
      
      if (!source.includes('profile=')) return false;

      const match = source.match(/profile=([^&]+)/);
      if (!match || !match[1]) return false;

      const rawParam = match[1];
      const jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(rawParam))));
      const data = JSON.parse(jsonStr);

      const params = data.p || data.params;
      const prophylactics = data.pr || data.prophylactics;

      // Validate untrusted import against the app's parameter schema before
      // merging (prevents HTML injection via crafted share links + prototype pollution).
      if (params) {
        const cleanParams = sanitizeProfileParams(params, this.app.params);
        if (Object.keys(cleanParams).length > 0) {
          this.app.params = { ...this.app.params, ...cleanParams };
        }
      }
      if (prophylactics) {
        const cleanProphylactics = sanitizeProfileParams(prophylactics, this.app.prophylactics);
        if (Object.keys(cleanProphylactics).length > 0) {
          this.app.prophylactics = { ...this.app.prophylactics, ...cleanProphylactics };
        }
      }

      this.app.currentPresetKey = 'me';
      this.app.presetConfigs.me = { ...this.app.params, ...this.app.prophylactics };
      this.app.saveToLocalStorage();
      this.app.syncUIWithParams();
      this.app.updateAll();

      // Clean query string and hash from browser URL bar cleanly after params load
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', cleanUrl);
      }

      return true;
    } catch (err) {
      console.error('Error loading shared profile from URL:', err);
      return false;
    }
  }
}
