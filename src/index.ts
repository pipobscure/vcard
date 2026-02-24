/**
 * @pipobscure/vcard — A fully featured vCard v4 (RFC 6350) library
 *
 * Provides tolerant parsing and strict generation of vCard data,
 * designed for use with CardDAV.
 *
 * @example
 * ```ts
 * import { VCard, FNProperty, EmailProperty } from '@pipobscure/vcard';
 *
 * // Parse
 * const [contact] = VCard.parse(vcardText);
 * console.log(contact.displayName);    // 'Alice Example'
 * console.log(contact.primaryEmail);   // 'alice@example.com'
 *
 * // Build
 * const vc = new VCard();
 * vc.fn.push(new FNProperty('Bob Builder'));
 * vc.email.push(new EmailProperty('bob@example.com'));
 * const text = vc.toString();          // strict RFC 6350 output
 * ```
 */

// ── Main class ─────────────────────────────────────────────────────────────
export { VCard, VCardError } from './vcard.js';

// ── All property classes ───────────────────────────────────────────────────
export {
  // Base
  Property,

  // Text properties
  TextProperty,
  TextListProperty,
  UriProperty,

  // Identification (RFC 6350 §6.2)
  FNProperty,
  NProperty,
  NicknameProperty,
  PhotoProperty,
  BDayProperty,
  AnniversaryProperty,
  GenderProperty,

  // Delivery addressing (RFC 6350 §6.3)
  AdrProperty,

  // Communications (RFC 6350 §6.4)
  TelProperty,
  EmailProperty,
  IMPPProperty,
  LangProperty,

  // Geographic (RFC 6350 §6.5)
  TZProperty,
  GeoProperty,

  // Organizational (RFC 6350 §6.6)
  TitleProperty,
  RoleProperty,
  LogoProperty,
  OrgProperty,
  MemberProperty,
  RelatedProperty,

  // Explanatory (RFC 6350 §6.7)
  CategoriesProperty,
  NoteProperty,
  ProdIDProperty,
  RevProperty,
  SoundProperty,
  UIDProperty,
  ClientPidMapProperty,
  URLProperty,

  // Security (RFC 6350 §6.8)
  KeyProperty,

  // Calendar (RFC 6350 §6.9)
  FBURLProperty,
  CALADRURIProperty,
  CALURIProperty,

  // General (RFC 6350 §6.1)
  KindProperty,
  XMLProperty,
  SourceProperty,

  // Unknown / extended
  UnknownProperty,

  // Date helpers
  parseDateAndOrTime,
  formatDateAndOrTime,
} from './property.js';

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  ValueType,
  TypeValue,
  KindValue,
  GenderSex,
  PartialDate,
  TimeValue,
  DateAndOrTime,
  StructuredName,
  Address,
  Organization,
  Gender,
  ClientPidMap,
  GeoCoordinates,
  ParameterMap,
  RawProperty,
  ValidationResult,
  ValidationError,
} from './types.js';

// ── Escape utilities (for advanced usage) ──────────────────────────────────
export {
  escapeText,
  escapeStructuredComponent,
  unescapeText,
  parseStructured,
  parseList,
  parseStructuredList,
  needsParamQuoting,
  quoteParamValue,
  unquoteParamValue,
  splitStructured,
  splitList,
} from './escape.js';

// ── Parser ─────────────────────────────────────────────────────────────────
export {
  unfoldLines,
  parseContentLine,
  instantiateProperty,
  parseVCardText,
} from './parser.js';
export type { ParseWarning, ParseResult, RawVCard } from './parser.js';

// ── Generator ──────────────────────────────────────────────────────────────
export { foldLine, serializeParameters, serializeProperty, serializeVCard } from './generator.js';
export type { GenerateOptions } from './generator.js';

// ── Convenience functions ──────────────────────────────────────────────────

import { VCard } from './vcard.js';

/**
 * Parse vCard text and return all vCards found.
 * Tolerant: never throws, silently accepts malformed input.
 */
export function parse(text: string): VCard[] {
  return VCard.parse(text);
}

/**
 * Parse vCard text and return the first vCard.
 * @throws Error if no vCard is found
 */
export function parseOne(text: string): VCard {
  return VCard.parseOne(text);
}

/**
 * Serialize a VCard (or array of VCards) to RFC 6350 text.
 * @throws VCardError if the vCard is invalid
 */
export function stringify(vcard: VCard | VCard[]): string {
  if (Array.isArray(vcard)) {
    return vcard.map(vc => vc.toString()).join('');
  }
  return vcard.toString();
}
