/**
 * safeMerge - prototype-pollution-safe object merge for untrusted JSON.
 *
 * Object.assign/`{...src}` semantics are unsafe for attacker-controlled data:
 * an own `__proto__` key (as produced by JSON.parse('{"__proto__":{...}}'))
 * triggers the prototype setter and replaces the target's prototype.
 * safeMerge copies own enumerable keys while skipping the dangerous keys.
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Merge own properties of `source` into `target`, skipping keys that could
 * alter the target's prototype chain. Returns `target`.
 *
 * @param {object} target - object to merge into
 * @param {object|null|undefined} source - untrusted object to merge from
 * @returns {object} target
 */
export function safeMerge(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
  for (const key of Object.keys(source)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    target[key] = source[key];
  }
  return target;
}
