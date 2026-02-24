/**
 * vCard v4 parser — RFC 6350
 *
 * Design goals:
 *   - Tolerant: accept malformed input, mixed line endings, v3 quirks
 *   - Non-throwing: collect parse warnings, never discard data
 *   - Preserve unknown properties verbatim for round-tripping
 */

import type { ParameterMap, RawProperty } from './types.js';
import { unquoteParamValue } from './escape.js';
import {
  Property,
  UnknownProperty,
  FNProperty,
  NProperty,
  NicknameProperty,
  PhotoProperty,
  BDayProperty,
  AnniversaryProperty,
  GenderProperty,
  AdrProperty,
  TelProperty,
  EmailProperty,
  IMPPProperty,
  LangProperty,
  TZProperty,
  GeoProperty,
  TitleProperty,
  RoleProperty,
  LogoProperty,
  OrgProperty,
  MemberProperty,
  RelatedProperty,
  CategoriesProperty,
  NoteProperty,
  ProdIDProperty,
  RevProperty,
  SoundProperty,
  UIDProperty,
  ClientPidMapProperty,
  URLProperty,
  KeyProperty,
  FBURLProperty,
  CALADRURIProperty,
  CALURIProperty,
  KindProperty,
  XMLProperty,
  SourceProperty,
  TextProperty,
} from './property.js';

// ── Parse Warnings ─────────────────────────────────────────────────────────

export interface ParseWarning {
  line?: number;
  message: string;
}

// ── Line unfolding ─────────────────────────────────────────────────────────

/**
 * Unfold content lines per RFC 6350 §3.2.
 * Any CRLF or LF immediately followed by a space or tab is removed.
 * Tolerates LF-only line endings.
 */
export function unfoldLines(input: string): string[] {
  // Normalize line endings (CRLF → LF), then unfold
  const unfolded = input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, ''); // unfold continuation lines

  return unfolded.split('\n').filter(line => line.length > 0);
}

// ── Parameter parsing ──────────────────────────────────────────────────────

/**
 * Parse parameter string into a ParameterMap.
 * Handles:
 *   - NAME=VALUE
 *   - NAME="quoted value"
 *   - NAME=val1,val2  (multi-value)
 *   - TYPE=work;TYPE=home (duplicate → merged into array)
 *
 * Tolerant: silently ignores malformed params.
 */
function parseParameters(paramStr: string, warnings: ParseWarning[]): ParameterMap {
  const map: ParameterMap = new Map();
  if (!paramStr) return map;

  // Split on ; (not inside quotes)
  const parts = splitParamString(paramStr);

  for (const part of parts) {
    if (!part.trim()) continue;
    const eq = part.indexOf('=');
    if (eq === -1) {
      // Bare parameter name — tolerate (some v3 types like TYPE=WORK without =)
      // Try treating as TYPE value for backwards compat
      const upperPart = part.trim().toUpperCase();
      if (/^[A-Z0-9-]+$/.test(upperPart)) {
        const existing = map.get('TYPE');
        if (existing === undefined) {
          map.set('TYPE', upperPart.toLowerCase());
        } else if (Array.isArray(existing)) {
          existing.push(upperPart.toLowerCase());
        } else {
          map.set('TYPE', [existing, upperPart.toLowerCase()]);
        }
      } else {
        warnings.push({ message: `Ignoring malformed parameter: ${part}` });
      }
      continue;
    }

    const name = part.slice(0, eq).trim().toUpperCase();
    const rawValue = part.slice(eq + 1).trim();
    const value = unquoteParamValue(rawValue);

    // Merge duplicate parameter names into an array
    const existing = map.get(name);
    if (existing === undefined) {
      map.set(name, value);
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      map.set(name, [existing, value]);
    }
  }

  return map;
}

/** Split a parameter string on `;`, skipping quoted sections */
function splitParamString(s: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === ';' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// ── Content line parsing ───────────────────────────────────────────────────

/**
 * Parse a single content line into a RawProperty.
 * Returns null for BEGIN/END/VERSION lines (handled separately).
 *
 * Format: [group.]name[;param=value...]:value
 */
export function parseContentLine(
  line: string,
  warnings: ParseWarning[],
): RawProperty | null {
  // Find the first colon (not inside quotes) to split name+params from value
  let colonIdx = -1;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) {
      colonIdx = i;
      break;
    }
  }

  if (colonIdx === -1) {
    warnings.push({ message: `Skipping line with no colon: ${line.slice(0, 40)}` });
    return null;
  }

  const namePart = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);

  // Split name from parameters on first `;`
  const semiIdx = namePart.indexOf(';');
  const nameAndGroup = semiIdx === -1 ? namePart : namePart.slice(0, semiIdx);
  const paramStr = semiIdx === -1 ? '' : namePart.slice(semiIdx + 1);

  // Split group from name
  const dotIdx = nameAndGroup.indexOf('.');
  let group: string | undefined;
  let name: string;
  if (dotIdx !== -1) {
    group = nameAndGroup.slice(0, dotIdx).trim();
    name = nameAndGroup.slice(dotIdx + 1).trim().toUpperCase();
  } else {
    name = nameAndGroup.trim().toUpperCase();
  }

  if (!name) {
    warnings.push({ message: `Skipping line with empty property name` });
    return null;
  }

  const parameters = parseParameters(paramStr, warnings);

  return { group, name, parameters, value };
}

// ── v3 Compatibility ──────────────────────────────────────────────────────

/**
 * Handle v3/v2.1 QUOTED-PRINTABLE encoding (tolerant input).
 * Correctly decodes multi-byte UTF-8 sequences encoded as QP hex pairs.
 * Returns the decoded string, or the original if not encoded.
 */
function decodeQuotedPrintable(encoded: string): string {
  // Remove soft line breaks first (= followed by CRLF or LF)
  const noSoftBreaks = encoded.replace(/=\r?\n/g, '');

  // Collect raw bytes, then decode as UTF-8 via Buffer
  const bytes: number[] = [];
  let i = 0;
  while (i < noSoftBreaks.length) {
    const ch = noSoftBreaks[i]!;
    if (ch === '=' && i + 2 < noSoftBreaks.length) {
      const hex = noSoftBreaks.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 3;
        continue;
      }
    }
    // Plain ASCII character
    const code = ch.charCodeAt(0);
    if (code < 128) {
      bytes.push(code);
    } else {
      // Non-ASCII character in the encoded stream — encode as UTF-8 bytes
      const buf = Buffer.from(ch, 'utf8');
      for (const b of buf) bytes.push(b);
    }
    i++;
  }

  return Buffer.from(bytes).toString('utf8');
}

// ── Property instantiation ─────────────────────────────────────────────────

/**
 * Convert a RawProperty to a typed Property instance.
 * Unknown properties become UnknownProperty instances.
 */
export function instantiateProperty(
  raw: RawProperty,
  warnings: ParseWarning[],
): Property {
  const { name, value, parameters, group } = raw;

  // Decode QUOTED-PRINTABLE for v3 tolerance
  let v = value;
  const encoding = parameters.get('ENCODING');
  if (encoding === 'QUOTED-PRINTABLE' || encoding === 'quoted-printable') {
    v = decodeQuotedPrintable(v);
    parameters.delete('ENCODING');
  }

  // Map property name to typed class
  switch (name) {
    case 'FN':
      return new FNProperty(unescapeTextValue(v), parameters, group);

    case 'N':
      return NProperty.fromText(v, parameters, group);

    case 'NICKNAME':
      return new NicknameProperty(parseTextList(v), parameters, group);

    case 'PHOTO':
      return new PhotoProperty(v, parameters, group);

    case 'BDAY':
      return BDayProperty.fromText(v, parameters, group);

    case 'ANNIVERSARY':
      return AnniversaryProperty.fromText(v, parameters, group);

    case 'GENDER':
      return GenderProperty.fromText(v, parameters, group);

    case 'ADR':
      return AdrProperty.fromText(v, parameters, group);

    case 'TEL':
      return new TelProperty(v, parameters, group);

    case 'EMAIL':
      return new EmailProperty(unescapeTextValue(v), parameters, group);

    case 'IMPP':
      return new IMPPProperty(v, parameters, group);

    case 'LANG':
      return new LangProperty(v.trim(), parameters, group);

    case 'TZ':
      return TZProperty.fromText(v, parameters, group);

    case 'GEO':
      return new GeoProperty(v, parameters, group);

    case 'TITLE':
      return new TitleProperty(unescapeTextValue(v), parameters, group);

    case 'ROLE':
      return new RoleProperty(unescapeTextValue(v), parameters, group);

    case 'LOGO':
      return new LogoProperty(v, parameters, group);

    case 'ORG':
      return OrgProperty.fromText(v, parameters, group);

    case 'MEMBER':
      return new MemberProperty(v, parameters, group);

    case 'RELATED':
      return RelatedProperty.fromText(v, parameters, group);

    case 'CATEGORIES':
      return new CategoriesProperty(parseTextList(v), parameters, group);

    case 'NOTE':
      return new NoteProperty(unescapeTextValue(v), parameters, group);

    case 'PRODID':
      return new ProdIDProperty(unescapeTextValue(v), parameters, group);

    case 'REV':
      return RevProperty.fromText(v, parameters, group);

    case 'SOUND':
      return new SoundProperty(v, parameters, group);

    case 'UID':
      return new UIDProperty(v, parameters, group);

    case 'CLIENTPIDMAP':
      return ClientPidMapProperty.fromText(v, parameters, group);

    case 'URL':
      return new URLProperty(v, parameters, group);

    case 'KEY':
      return KeyProperty.fromText(v, parameters, group);

    case 'FBURL':
      return new FBURLProperty(v, parameters, group);

    case 'CALADRURI':
      return new CALADRURIProperty(v, parameters, group);

    case 'CALURI':
      return new CALURIProperty(v, parameters, group);

    case 'KIND':
      return new KindProperty(unescapeTextValue(v), parameters, group);

    case 'XML':
      return new XMLProperty(unescapeTextValue(v), parameters, group);

    case 'SOURCE':
      return new SourceProperty(v, parameters, group);

    // v3 compatibility: map to closest v4 equivalents
    case 'LABEL':
      // v3 ADR label — store as unknown for now
      return new UnknownProperty('LABEL', v, parameters, group);

    case 'MAILER':
    case 'CLASS':
    case 'PROFILE':
    case 'NAME':
      // v3 only properties — store verbatim
      return new UnknownProperty(name, v, parameters, group);

    default:
      if (!name.startsWith('X-') && !name.startsWith('VND.')) {
        warnings.push({
          message: `Unknown property: ${name} — stored verbatim`,
        });
      }
      return new UnknownProperty(name, v, parameters, group);
  }
}

// ── vCard block parsing ────────────────────────────────────────────────────

/** A raw parsed vCard block (list of content lines) */
export interface RawVCard {
  version: string;
  properties: Property[];
  warnings: ParseWarning[];
}

/**
 * Parse a sequence of unfolded content lines forming a single vCard.
 * Assumes BEGIN:VCARD and END:VCARD have already been identified.
 */
function parseVCardBlock(
  lines: string[],
  warnings: ParseWarning[],
): RawVCard {
  let version = '4.0';
  const properties: Property[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const upper = line.toUpperCase();

    if (upper.startsWith('VERSION:')) {
      version = line.slice(8).trim();
      continue;
    }

    const raw = parseContentLine(line, warnings);
    if (!raw) continue;

    // Skip VERSION again in case it has params
    if (raw.name === 'VERSION') {
      version = raw.value.trim();
      continue;
    }

    const prop = instantiateProperty(raw, warnings);
    properties.push(prop);
  }

  return { version, properties, warnings };
}

// ── Public parse API ───────────────────────────────────────────────────────

/** Result of parsing vCard text */
export interface ParseResult {
  rawVCards: RawVCard[];
  warnings: ParseWarning[];
}

/**
 * Parse vCard text into raw vCard blocks.
 * Tolerates:
 *   - Multiple vCards in one string
 *   - CRLF or LF line endings
 *   - Missing VERSION
 *   - Unknown properties
 *   - v3 syntax
 */
export function parseVCardText(input: string): ParseResult {
  const warnings: ParseWarning[] = [];
  const rawVCards: RawVCard[] = [];

  const lines = unfoldLines(input);
  let inVCard = false;
  let currentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const upper = line.toUpperCase().trim();

    if (upper === 'BEGIN:VCARD') {
      inVCard = true;
      currentLines = [];
      continue;
    }

    if (upper === 'END:VCARD') {
      if (!inVCard) {
        warnings.push({ line: i + 1, message: 'Unexpected END:VCARD without BEGIN:VCARD' });
        continue;
      }
      inVCard = false;
      const cardWarnings: ParseWarning[] = [];
      rawVCards.push(parseVCardBlock(currentLines, cardWarnings));
      warnings.push(...cardWarnings);
      currentLines = [];
      continue;
    }

    if (inVCard) {
      currentLines.push(line);
    }
    // Lines outside BEGIN/END are silently ignored (tolerant)
  }

  if (inVCard) {
    // Unclosed vCard — parse what we have
    const cardWarnings: ParseWarning[] = [];
    cardWarnings.push({ message: 'Unclosed vCard (missing END:VCARD) — parsing anyway' });
    rawVCards.push(parseVCardBlock(currentLines, cardWarnings));
    warnings.push(...cardWarnings);
  }

  return { rawVCards, warnings };
}

// ── Helpers ────────────────────────────────────────────────────────────────

import { parseList, unescapeText } from './escape.js';

function unescapeTextValue(v: string): string {
  return unescapeText(v);
}

function parseTextList(v: string): string[] {
  return parseList(v);
}
