/**
 * vCard v4 generator — RFC 6350
 *
 * Strict output:
 *   - CRLF line endings (§3.2)
 *   - Line folding at 75 octets (§3.2)
 *   - VERSION:4.0 first property after BEGIN:VCARD
 *   - Proper text escaping
 *   - Parameter values quoted when necessary
 */

import type { ParameterMap } from './types.js';
import { quoteParamValue } from './escape.js';
import { Property, VCardError } from './property.js';

// ── Line folding ──────────────────────────────────────────────────────────

const MAX_LINE_OCTETS = 75;

/**
 * Fold a content line to at most 75 octets per line (RFC 6350 §3.2).
 * Continuation lines begin with a single space.
 * Counts UTF-8 bytes, not characters.
 */
export function foldLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= MAX_LINE_OCTETS) {
    return line + '\r\n';
  }

  const parts: string[] = [];
  let start = 0;
  // First segment: 75 octets max.
  // Continuation segments: 74 octets of content + 1-byte leading space = 75.
  let maxBytes = MAX_LINE_OCTETS;

  while (start < line.length) {
    let end = start;
    let octetCount = 0;

    // Advance character by character, counting UTF-8 bytes
    while (end < line.length) {
      const cp = line.codePointAt(end)!;
      const charBytes = cp > 0xffff ? 4 : cp > 0x7ff ? 3 : cp > 0x7f ? 2 : 1;
      if (octetCount + charBytes > maxBytes) break;
      octetCount += charBytes;
      end += cp > 0xffff ? 2 : 1; // surrogate pair awareness
    }

    if (end === start) {
      // Force-include at least one character to avoid infinite loop
      end = start + 1;
    }

    parts.push(line.slice(start, end));
    start = end;
    maxBytes = MAX_LINE_OCTETS - 1; // subsequent lines lose 1 byte to leading space
  }

  return parts.join('\r\n ') + '\r\n';
}

// ── Parameter serialization ───────────────────────────────────────────────

/**
 * Serialize a ParameterMap to string (without leading semicolon).
 * Multiple values for the same parameter are joined with commas.
 * Values containing special characters are quoted.
 */
export function serializeParameters(params: ParameterMap): string {
  const parts: string[] = [];

  for (const [name, value] of params) {
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      // Multiple values: emit as single NAME=val1,val2 or individual NAME=val for each
      // RFC 6350 §5.1 allows multi-value params
      const joined = value.map(quoteParamValue).join(',');
      parts.push(`${name}=${joined}`);
    } else {
      parts.push(`${name}=${quoteParamValue(value)}`);
    }
  }

  return parts.join(';');
}

// ── Content line serialization ────────────────────────────────────────────

/**
 * Serialize a single Property to a folded content line string (with CRLF).
 */
export function serializeProperty(prop: Property): string {
  const namePart = prop.group ? `${prop.group}.${prop.name}` : prop.name;
  const paramStr = serializeParameters(prop.params);
  const separator = paramStr ? `;${paramStr}` : '';
  const value = prop.toContentLine();

  const line = `${namePart}${separator}:${value}`;
  return foldLine(line);
}

// ── Generation options ────────────────────────────────────────────────────

export interface GenerateOptions {
  /**
   * Whether to validate the vCard before generating.
   * Default: true
   */
  validate?: boolean;

  /**
   * Whether to include a PRODID property.
   * If a string is provided, it is used as the PRODID value.
   * Default: false
   */
  prodid?: boolean | string;
}

// ── VCard serialization ───────────────────────────────────────────────────

/**
 * Serialize a list of properties to a vCard string.
 * Handles VERSION insertion and ordering.
 *
 * @throws VCardError if validation is enabled and the vCard is invalid
 */
export function serializeVCard(
  properties: Property[],
  options: GenerateOptions = {},
): string {
  const validate = options.validate !== false;

  if (validate) {
    validateForGeneration(properties);
  }

  let output = 'BEGIN:VCARD\r\n';
  output += 'VERSION:4.0\r\n';

  // Properties to emit (skip VERSION — already emitted above)
  // Order: structural first (FN, N), then everything else
  const ordered = orderProperties(properties.filter(p => p.name !== 'VERSION'));

  for (const prop of ordered) {
    output += serializeProperty(prop);
  }

  output += 'END:VCARD\r\n';
  return output;
}

// ── Property ordering ─────────────────────────────────────────────────────

/** Preferred property output order (for readability) */
const PROPERTY_ORDER: Record<string, number> = {
  FN: 1,
  N: 2,
  NICKNAME: 3,
  GENDER: 4,
  BDAY: 5,
  ANNIVERSARY: 6,
  ORG: 7,
  TITLE: 8,
  ROLE: 9,
  EMAIL: 10,
  TEL: 11,
  ADR: 12,
  URL: 13,
  IMPP: 14,
  LANG: 15,
  TZ: 16,
  GEO: 17,
  PHOTO: 18,
  LOGO: 19,
  SOUND: 20,
  NOTE: 21,
  CATEGORIES: 22,
  SOURCE: 23,
  XML: 24,
  KEY: 25,
  FBURL: 26,
  CALADRURI: 27,
  CALURI: 28,
  MEMBER: 29,
  RELATED: 30,
  UID: 31,
  REV: 32,
  PRODID: 33,
  KIND: 34,
  CLIENTPIDMAP: 35,
};

function orderProperties(properties: Property[]): Property[] {
  return [...properties].sort((a, b) => {
    const oa = PROPERTY_ORDER[a.name] ?? 100;
    const ob = PROPERTY_ORDER[b.name] ?? 100;
    return oa - ob;
  });
}

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate a property list for strict vCard v4 generation.
 * @throws VCardError on first validation failure
 */
function validateForGeneration(properties: Property[]): void {
  // FN is required (cardinality 1*)
  const fnProps = properties.filter(p => p.name === 'FN');
  if (fnProps.length === 0) {
    throw new VCardError('Missing required property: FN', 'FN');
  }

  // PREF values must be 1–100
  for (const prop of properties) {
    const pref = prop.pref;
    if (pref !== undefined && (pref < 1 || pref > 100 || !Number.isInteger(pref))) {
      throw new VCardError(
        `PREF parameter on ${prop.name} must be an integer between 1 and 100, got: ${pref}`,
        prop.name,
      );
    }
  }

  // GENDER sex must be one of M, F, O, N, U, or empty
  for (const prop of properties) {
    if (prop.name === 'GENDER') {
      // GenderProperty has a value field
      const gp = prop as import('./property.js').GenderProperty;
      const validSex = ['M', 'F', 'O', 'N', 'U', ''];
      if (!validSex.includes(gp.value.sex)) {
        throw new VCardError(
          `Invalid GENDER sex value: ${gp.value.sex}. Must be one of M, F, O, N, U`,
          'GENDER',
        );
      }
    }
  }

  // REV must be a valid timestamp
  for (const prop of properties) {
    if (prop.name === 'REV') {
      const rp = prop as import('./property.js').RevProperty;
      if (rp.value instanceof Date && isNaN(rp.value.getTime())) {
        throw new VCardError('REV property contains invalid date', 'REV');
      }
    }
  }
}
