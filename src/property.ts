/**
 * vCard v4 property classes — RFC 6350
 *
 * Each property class corresponds to a vCard property defined in RFC 6350.
 * Properties hold typed values for clean programmatic access.
 *
 * Cardinality (per RFC 6350 section 6):
 *   '1'   = exactly one (required, singular)
 *   '*1'  = zero or one (optional, singular)
 *   '1*'  = one or more (required, multiple)
 *   '*'   = zero or more (optional, multiple)
 */

import type {
  ParameterMap,
  Address,
  StructuredName,
  Organization,
  Gender,
  GenderSex,
  ClientPidMap,
  DateAndOrTime,
  PartialDate,
  TimeValue,
  TypeValue,
} from './types.js';
import {
  escapeText,
  escapeStructuredComponent,
  parseStructured,
  parseList,
  parseStructuredList,
  parseStructured as splitStruct,
  unescapeText,
} from './escape.js';

// ── VCard Error ────────────────────────────────────────────────────────────

/** Thrown on strict validation failures during generation */
export class VCardError extends Error {
  constructor(
    message: string,
    public readonly property?: string,
  ) {
    super(message);
    this.name = 'VCardError';
  }
}

// ── Base Property ──────────────────────────────────────────────────────────

/** Base class for all vCard properties */
export abstract class Property {
  /** Optional group name (e.g. 'item1') */
  group?: string;
  /** Property name (always uppercase) */
  readonly name: string;
  /** Raw parameters */
  params: ParameterMap;

  constructor(name: string, params?: ParameterMap, group?: string) {
    this.name = name.toUpperCase();
    this.params = params ?? new Map();
    if (group !== undefined) this.group = group;
  }

  // ── Convenience parameter accessors ──────────────────────────────────

  /** TYPE parameter values (lowercased) */
  get type(): string[] {
    const v = this.params.get('TYPE');
    if (!v) return [];
    const vals = Array.isArray(v) ? v : [v];
    return vals.flatMap(s => s.split(',').map(x => x.toLowerCase().trim()));
  }

  set type(values: string[]) {
    if (values.length === 0) {
      this.params.delete('TYPE');
    } else {
      this.params.set('TYPE', values.length === 1 ? (values[0] ?? '') : values);
    }
  }

  /** PREF parameter (1–100, where 1 = most preferred) */
  get pref(): number | undefined {
    const v = this.params.get('PREF');
    if (!v || Array.isArray(v)) return undefined;
    const n = parseInt(v, 10);
    return isNaN(n) ? undefined : n;
  }

  set pref(value: number | undefined) {
    if (value === undefined) {
      this.params.delete('PREF');
    } else {
      this.params.set('PREF', String(value));
    }
  }

  /** LANGUAGE parameter */
  get language(): string | undefined {
    const v = this.params.get('LANGUAGE');
    return Array.isArray(v) ? v[0] : v;
  }

  set language(value: string | undefined) {
    if (value === undefined) {
      this.params.delete('LANGUAGE');
    } else {
      this.params.set('LANGUAGE', value);
    }
  }

  /** ALTID parameter */
  get altid(): string | undefined {
    const v = this.params.get('ALTID');
    return Array.isArray(v) ? v[0] : v;
  }

  set altid(value: string | undefined) {
    if (value === undefined) {
      this.params.delete('ALTID');
    } else {
      this.params.set('ALTID', value);
    }
  }

  /** PID parameter (may be a list of pid-values like "1.1,2") */
  get pid(): string | undefined {
    const v = this.params.get('PID');
    return Array.isArray(v) ? v[0] : v;
  }

  /** VALUE parameter */
  get valueType(): string | undefined {
    const v = this.params.get('VALUE');
    return Array.isArray(v) ? v[0] : v;
  }

  set valueType(value: string | undefined) {
    if (value === undefined) {
      this.params.delete('VALUE');
    } else {
      this.params.set('VALUE', value);
    }
  }

  /** Serialize to string (for generator use) */
  abstract toContentLine(): string;
}

// ── Text Property ──────────────────────────────────────────────────────────

/** Property with a single TEXT value */
export class TextProperty extends Property {
  value: string;

  constructor(
    name: string,
    value: string,
    params?: ParameterMap,
    group?: string,
  ) {
    super(name, params, group);
    this.value = value;
  }

  toContentLine(): string {
    return escapeText(this.value);
  }
}

/** Property with a list of TEXT values (comma-separated) */
export class TextListProperty extends Property {
  values: string[];

  constructor(
    name: string,
    values: string[],
    params?: ParameterMap,
    group?: string,
  ) {
    super(name, params, group);
    this.values = values;
  }

  toContentLine(): string {
    return this.values.map(v => escapeText(v)).join(',');
  }
}

// ── URI Property ──────────────────────────────────────────────────────────

/** Property with a URI value (unescaped, no text escaping applied) */
export class UriProperty extends Property {
  value: string;

  constructor(
    name: string,
    value: string,
    params?: ParameterMap,
    group?: string,
  ) {
    super(name, params, group);
    this.value = value;
  }

  toContentLine(): string {
    return this.value;
  }
}

// ── Specific Text Properties ──────────────────────────────────────────────

/** FN — Formatted Name (RFC 6350 §6.2.1) — cardinality: 1* */
export class FNProperty extends TextProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('FN', value, params, group);
  }
}

/** NICKNAME — Nickname (RFC 6350 §6.2.3) — cardinality: * */
export class NicknameProperty extends TextListProperty {
  constructor(values: string[], params?: ParameterMap, group?: string) {
    super('NICKNAME', values, params, group);
  }
}

/** NOTE — Note (RFC 6350 §6.7.2) — cardinality: * */
export class NoteProperty extends TextProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('NOTE', value, params, group);
  }
}

/** TITLE — Job Title (RFC 6350 §6.6.1) — cardinality: * */
export class TitleProperty extends TextProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('TITLE', value, params, group);
  }
}

/** ROLE — Role (RFC 6350 §6.6.2) — cardinality: * */
export class RoleProperty extends TextProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('ROLE', value, params, group);
  }
}

/** PRODID — Product Identifier (RFC 6350 §6.7.3) — cardinality: *1 */
export class ProdIDProperty extends TextProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('PRODID', value, params, group);
  }
}

/** UID — Unique Identifier (RFC 6350 §6.7.6) — cardinality: *1
 *  May be a URI or text (see valueType param). */
export class UIDProperty extends TextProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('UID', value, params, group);
    // If value looks like a URI, set VALUE=uri implicitly on generation
  }

  override toContentLine(): string {
    // UID is often a URI — don't escape if value type is URI
    if (this.valueType === 'uri' || looksLikeUri(this.value)) {
      return this.value;
    }
    return escapeText(this.value);
  }
}

/** KIND — Type of object (RFC 6350 §6.1.4) — cardinality: *1 */
export class KindProperty extends TextProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('KIND', value, params, group);
  }
}

/** XML — XML data (RFC 6350 §6.1.5) — cardinality: * */
export class XMLProperty extends TextProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('XML', value, params, group);
  }
}

/** SOURCE — Source URI (RFC 6350 §6.1.3) — cardinality: * */
export class SourceProperty extends UriProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('SOURCE', value, params, group);
  }
}

/** CATEGORIES — Categories (RFC 6350 §6.7.1) — cardinality: * */
export class CategoriesProperty extends TextListProperty {
  constructor(values: string[], params?: ParameterMap, group?: string) {
    super('CATEGORIES', values, params, group);
  }
}

/** URL — URI (RFC 6350 §6.7.8) — cardinality: * */
export class URLProperty extends UriProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('URL', value, params, group);
  }
}

/** PHOTO — Photo URI (RFC 6350 §6.2.4) — cardinality: * */
export class PhotoProperty extends UriProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('PHOTO', value, params, group);
  }

  /** MEDIATYPE parameter */
  get mediatype(): string | undefined {
    const v = this.params.get('MEDIATYPE');
    return Array.isArray(v) ? v[0] : v;
  }

  set mediatype(value: string | undefined) {
    if (value === undefined) {
      this.params.delete('MEDIATYPE');
    } else {
      this.params.set('MEDIATYPE', value);
    }
  }
}

/** LOGO — Logo URI (RFC 6350 §6.6.3) — cardinality: * */
export class LogoProperty extends UriProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('LOGO', value, params, group);
  }
}

/** SOUND — Sound URI (RFC 6350 §6.7.5) — cardinality: * */
export class SoundProperty extends UriProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('SOUND', value, params, group);
  }
}

/** IMPP — Instant Messaging URI (RFC 6350 §6.4.3) — cardinality: * */
export class IMPPProperty extends UriProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('IMPP', value, params, group);
  }
}

/** MEMBER — Group Member URI (RFC 6350 §6.6.5) — cardinality: * */
export class MemberProperty extends UriProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('MEMBER', value, params, group);
  }
}

/** FBURL — Free/Busy URL (RFC 6350 §6.9.1) — cardinality: * */
export class FBURLProperty extends UriProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('FBURL', value, params, group);
  }
}

/** CALADRURI — Calendar User Address URI (RFC 6350 §6.9.2) — cardinality: * */
export class CALADRURIProperty extends UriProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('CALADRURI', value, params, group);
  }
}

/** CALURI — Calendar URI (RFC 6350 §6.9.3) — cardinality: * */
export class CALURIProperty extends UriProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('CALURI', value, params, group);
  }
}

// ── Email Property ─────────────────────────────────────────────────────────

/** EMAIL — Email Address (RFC 6350 §6.4.2) — cardinality: * */
export class EmailProperty extends TextProperty {
  constructor(value: string, params?: ParameterMap, group?: string) {
    super('EMAIL', value, params, group);
  }
}

// ── Language Property ──────────────────────────────────────────────────────

/** LANG — Language (RFC 6350 §6.4.4) — cardinality: * */
export class LangProperty extends Property {
  /** BCP 47 language tag (e.g. 'en', 'fr', 'zh-Hant') */
  value: string;

  constructor(value: string, params?: ParameterMap, group?: string) {
    super('LANG', params, group);
    this.value = value;
  }

  toContentLine(): string {
    return this.value;
  }
}

// ── Telephone Property ────────────────────────────────────────────────────

/**
 * TEL — Telephone Number (RFC 6350 §6.4.1) — cardinality: *
 *
 * In v4, TEL values SHOULD be URIs (tel: or sip:).
 * Text values are also accepted for tolerance.
 */
export class TelProperty extends Property {
  value: string;
  /** Whether this is a URI value (tel:, sip:, etc.) or plain text */
  isUri: boolean;

  constructor(
    value: string,
    params?: ParameterMap,
    group?: string,
  ) {
    super('TEL', params, group);
    this.value = value;
    this.isUri = looksLikeUri(value) || (params?.get('VALUE') === 'uri');
  }

  toContentLine(): string {
    return this.isUri ? this.value : escapeText(this.value);
  }
}

// ── Structured Name ────────────────────────────────────────────────────────

/**
 * N — Structured Name (RFC 6350 §6.2.2) — cardinality: *1
 *
 * Components (each may be a comma-separated list):
 *   family-name ; given-name ; additional-names ; honorific-prefixes ; honorific-suffixes
 */
export class NProperty extends Property {
  value: StructuredName;

  constructor(value: StructuredName, params?: ParameterMap, group?: string) {
    super('N', params, group);
    this.value = value;
  }

  /** Create from a text value (tolerant parsing) */
  static fromText(text: string, params?: ParameterMap, group?: string): NProperty {
    const components = parseStructuredList(text);
    return new NProperty(
      {
        familyNames: components[0] ?? [],
        givenNames: components[1] ?? [],
        additionalNames: components[2] ?? [],
        honorificPrefixes: components[3] ?? [],
        honorificSuffixes: components[4] ?? [],
      },
      params,
      group,
    );
  }

  toContentLine(): string {
    const { familyNames, givenNames, additionalNames, honorificPrefixes, honorificSuffixes } =
      this.value;
    return [
      familyNames.map(escapeStructuredComponent).join(','),
      givenNames.map(escapeStructuredComponent).join(','),
      additionalNames.map(escapeStructuredComponent).join(','),
      honorificPrefixes.map(escapeStructuredComponent).join(','),
      honorificSuffixes.map(escapeStructuredComponent).join(','),
    ].join(';');
  }

  /** SORT-AS parameter */
  get sortAs(): string[] {
    const v = this.params.get('SORT-AS');
    if (!v) return [];
    const s = Array.isArray(v) ? v[0] ?? '' : v;
    return parseList(s);
  }
}

// ── Address ────────────────────────────────────────────────────────────────

/**
 * ADR — Address (RFC 6350 §6.3.1) — cardinality: *
 *
 * Components:
 *   post-office-box ; extended-address ; street-address ;
 *   locality ; region ; postal-code ; country-name
 */
export class AdrProperty extends Property {
  value: Address;

  constructor(value: Address, params?: ParameterMap, group?: string) {
    super('ADR', params, group);
    this.value = value;
  }

  static fromText(text: string, params?: ParameterMap, group?: string): AdrProperty {
    const c = parseStructured(text);
    return new AdrProperty(
      {
        postOfficeBox: c[0] ?? '',
        extendedAddress: c[1] ?? '',
        streetAddress: c[2] ?? '',
        locality: c[3] ?? '',
        region: c[4] ?? '',
        postalCode: c[5] ?? '',
        countryName: c[6] ?? '',
      },
      params,
      group,
    );
  }

  toContentLine(): string {
    const { postOfficeBox, extendedAddress, streetAddress, locality, region, postalCode, countryName } =
      this.value;
    return [
      escapeStructuredComponent(postOfficeBox),
      escapeStructuredComponent(extendedAddress),
      escapeStructuredComponent(streetAddress),
      escapeStructuredComponent(locality),
      escapeStructuredComponent(region),
      escapeStructuredComponent(postalCode),
      escapeStructuredComponent(countryName),
    ].join(';');
  }

  /** LABEL parameter (delivery address label) */
  get label(): string | undefined {
    const v = this.params.get('LABEL');
    return Array.isArray(v) ? v[0] : v;
  }

  set label(value: string | undefined) {
    if (value === undefined) {
      this.params.delete('LABEL');
    } else {
      this.params.set('LABEL', value);
    }
  }

  /** CC (country code) parameter */
  get cc(): string | undefined {
    const v = this.params.get('CC');
    return Array.isArray(v) ? v[0] : v;
  }
}

// ── Organization ──────────────────────────────────────────────────────────

/**
 * ORG — Organization (RFC 6350 §6.6.4) — cardinality: *
 *
 * Semicolon-separated: org-name ; unit1 ; unit2 ; ...
 */
export class OrgProperty extends Property {
  value: Organization;

  constructor(value: Organization, params?: ParameterMap, group?: string) {
    super('ORG', params, group);
    this.value = value;
  }

  static fromText(text: string, params?: ParameterMap, group?: string): OrgProperty {
    const parts = parseStructured(text);
    return new OrgProperty(
      {
        name: parts[0] ?? '',
        units: parts.slice(1).filter(s => s !== ''),
      },
      params,
      group,
    );
  }

  toContentLine(): string {
    const parts = [this.value.name, ...this.value.units];
    return parts.map(escapeStructuredComponent).join(';');
  }

  get sortAs(): string[] {
    const v = this.params.get('SORT-AS');
    if (!v) return [];
    const s = Array.isArray(v) ? v[0] ?? '' : v;
    return parseList(s);
  }
}

// ── Gender ─────────────────────────────────────────────────────────────────

/**
 * GENDER — Gender (RFC 6350 §6.2.7) — cardinality: *1
 *
 * Value: sex ; identity-text
 * Sex: M | F | O | N | U | (empty)
 */
export class GenderProperty extends Property {
  value: Gender;

  constructor(value: Gender, params?: ParameterMap, group?: string) {
    super('GENDER', params, group);
    this.value = value;
  }

  static fromText(text: string, params?: ParameterMap, group?: string): GenderProperty {
    const semi = text.indexOf(';');
    if (semi === -1) {
      return new GenderProperty({ sex: text.toUpperCase() as GenderSex }, params, group);
    }
    const sex = text.slice(0, semi).toUpperCase() as GenderSex;
    const identity = unescapeText(text.slice(semi + 1));
    return new GenderProperty({ sex, identity: identity || undefined }, params, group);
  }

  toContentLine(): string {
    const { sex, identity } = this.value;
    if (!identity) return sex;
    return `${sex};${escapeStructuredComponent(identity)}`;
  }
}

// ── Geographic ────────────────────────────────────────────────────────────

/**
 * GEO — Geographic Position (RFC 6350 §6.5.2) — cardinality: *
 * Value: URI (e.g. geo:37.386013,-122.082932)
 */
export class GeoProperty extends Property {
  /** The raw URI value */
  uri: string;

  constructor(uri: string, params?: ParameterMap, group?: string) {
    super('GEO', params, group);
    this.uri = uri;
  }

  /** Parse latitude/longitude from a geo: URI */
  get coordinates(): { latitude: number; longitude: number } | undefined {
    const m = this.uri.match(/^geo:([+-]?\d+\.?\d*),([+-]?\d+\.?\d*)/i);
    if (!m) return undefined;
    return { latitude: parseFloat(m[1]!), longitude: parseFloat(m[2]!) };
  }

  /** Build a GeoProperty from coordinates */
  static fromCoordinates(
    lat: number,
    lon: number,
    params?: ParameterMap,
    group?: string,
  ): GeoProperty {
    return new GeoProperty(`geo:${lat},${lon}`, params, group);
  }

  toContentLine(): string {
    return this.uri;
  }
}

/**
 * TZ — Time Zone (RFC 6350 §6.5.1) — cardinality: *
 * May be: UTC offset (+HH:MM), URI, or text (IANA timezone name)
 */
export class TZProperty extends Property {
  value: string;
  valueKind: 'utc-offset' | 'uri' | 'text';

  constructor(
    value: string,
    valueKind: 'utc-offset' | 'uri' | 'text' = 'text',
    params?: ParameterMap,
    group?: string,
  ) {
    super('TZ', params, group);
    this.value = value;
    this.valueKind = valueKind;
  }

  static fromText(text: string, params?: ParameterMap, group?: string): TZProperty {
    const valType = params?.get('VALUE');
    const vt = Array.isArray(valType) ? valType[0] : valType;

    if (vt === 'uri' || looksLikeUri(text)) {
      return new TZProperty(text, 'uri', params, group);
    }
    if (/^[+-]\d{2}:\d{2}$/.test(text) || /^[+-]\d{4}$/.test(text)) {
      return new TZProperty(text, 'utc-offset', params, group);
    }
    return new TZProperty(unescapeText(text), 'text', params, group);
  }

  toContentLine(): string {
    if (this.valueKind === 'uri' || this.valueKind === 'utc-offset') {
      return this.value;
    }
    return escapeText(this.value);
  }
}

// ── Date/Time Properties ──────────────────────────────────────────────────

/**
 * Parse an RFC 6350 date-and-or-time value into a structured object.
 *
 * Supported formats (RFC 6350 §4.3):
 *   YYYY, YYYYMM, YYYYMMDD, --MMDD, --MM, ---DD
 *   THH, THHMM, THHMMSS, THHMMSSZ, THHMMSS+HHMM
 *   YYYYMMDDTHHMMSS, etc.
 *   Extended (with dashes/colons): YYYY-MM-DD, HH:MM:SS, etc.
 */
export function parseDateAndOrTime(value: string): DateAndOrTime | null {
  if (!value) return null;
  const v = value.replace(/\s/g, '');

  let hasTime = false;
  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;
  let hour: number | undefined;
  let minute: number | undefined;
  let second: number | undefined;
  let utcOffset: string | undefined;

  // Split date/time parts on T (case-insensitive)
  const tIndex = v.toUpperCase().indexOf('T');
  const datePart = tIndex === -1 ? v : v.slice(0, tIndex);
  const timePart = tIndex === -1 ? '' : v.slice(tIndex + 1);

  if (timePart) hasTime = true;

  // Parse date part
  if (datePart) {
    // --MMDD or --MM-DD
    if (datePart.startsWith('--')) {
      const d = datePart.slice(2).replace(/-/g, '');
      if (d.length >= 2) month = parseInt(d.slice(0, 2), 10);
      if (d.length >= 4) day = parseInt(d.slice(2, 4), 10);
    }
    // ---DD
    else if (datePart.startsWith('---')) {
      day = parseInt(datePart.slice(3), 10);
    }
    // YYYY, YYYY-MM, YYYYMM, YYYY-MM-DD, YYYYMMDD
    else {
      const clean = datePart.replace(/-/g, '');
      if (clean.length >= 4) year = parseInt(clean.slice(0, 4), 10);
      if (clean.length >= 6) month = parseInt(clean.slice(4, 6), 10);
      if (clean.length >= 8) day = parseInt(clean.slice(6, 8), 10);
    }
  }

  // Parse time part
  if (timePart) {
    // Extract UTC offset suffix: Z, +HH:MM, -HH:MM, +HHMM, -HHMM
    let tp = timePart;
    const offsetMatch = tp.match(/([Zz]|[+-]\d{2}:?\d{2})$/);
    if (offsetMatch) {
      utcOffset = offsetMatch[1]!.toUpperCase();
      tp = tp.slice(0, tp.length - offsetMatch[1]!.length);
    }
    const clean = tp.replace(/:/g, '');
    if (clean.length >= 2) hour = parseInt(clean.slice(0, 2), 10);
    if (clean.length >= 4) minute = parseInt(clean.slice(2, 4), 10);
    if (clean.length >= 6) second = parseInt(clean.slice(4, 6), 10);
  }

  return { year, month, day, hour, minute, second, utcOffset, hasTime };
}

/** Format a DateAndOrTime back to RFC 6350 text */
export function formatDateAndOrTime(dt: DateAndOrTime): string {
  let datePart = '';
  let timePart = '';

  if (dt.year !== undefined || dt.month !== undefined || dt.day !== undefined) {
    if (dt.year === undefined && dt.month !== undefined) {
      // --MMDD or --MM
      datePart = '--' + String(dt.month).padStart(2, '0') + (dt.day !== undefined ? String(dt.day).padStart(2, '0') : '');
    } else if (dt.year === undefined && dt.day !== undefined) {
      datePart = '---' + String(dt.day).padStart(2, '0');
    } else {
      datePart = dt.year !== undefined ? String(dt.year).padStart(4, '0') : '';
      if (dt.month !== undefined) datePart += String(dt.month).padStart(2, '0');
      if (dt.day !== undefined) datePart += String(dt.day).padStart(2, '0');
    }
  }

  if (dt.hasTime && (dt.hour !== undefined || dt.minute !== undefined || dt.second !== undefined)) {
    timePart = 'T';
    timePart += dt.hour !== undefined ? String(dt.hour).padStart(2, '0') : '';
    if (dt.minute !== undefined) timePart += String(dt.minute).padStart(2, '0');
    if (dt.second !== undefined) timePart += String(dt.second).padStart(2, '0');
    if (dt.utcOffset) timePart += dt.utcOffset;
  }

  return datePart + timePart;
}

/**
 * BDAY — Birthday (RFC 6350 §6.2.5) — cardinality: *1
 * Value: date-and-or-time or text
 */
export class BDayProperty extends Property {
  /** Parsed date/time value, or null if text or unparseable */
  dateValue: DateAndOrTime | null;
  /** Raw text value (for VALUE=text or unparseable) */
  textValue?: string;

  constructor(
    value: DateAndOrTime | string,
    params?: ParameterMap,
    group?: string,
  ) {
    super('BDAY', params, group);
    if (typeof value === 'string') {
      this.textValue = value;
      this.dateValue = null;
    } else {
      this.dateValue = value;
    }
  }

  static fromText(text: string, params?: ParameterMap, group?: string): BDayProperty {
    const vt = params?.get('VALUE');
    if (vt === 'text' || Array.isArray(vt) && vt[0] === 'text') {
      return new BDayProperty(unescapeText(text), params, group);
    }
    const dt = parseDateAndOrTime(text);
    if (dt) return new BDayProperty(dt, params, group);
    return new BDayProperty(text, params, group);
  }

  toContentLine(): string {
    if (this.textValue !== undefined) return escapeText(this.textValue);
    if (this.dateValue) return formatDateAndOrTime(this.dateValue);
    return '';
  }
}

/**
 * ANNIVERSARY — Anniversary (RFC 6350 §6.2.6) — cardinality: *1
 * Value: date-and-or-time or text
 */
export class AnniversaryProperty extends Property {
  dateValue: DateAndOrTime | null;
  textValue?: string;

  constructor(
    value: DateAndOrTime | string,
    params?: ParameterMap,
    group?: string,
  ) {
    super('ANNIVERSARY', params, group);
    if (typeof value === 'string') {
      this.textValue = value;
      this.dateValue = null;
    } else {
      this.dateValue = value;
    }
  }

  static fromText(text: string, params?: ParameterMap, group?: string): AnniversaryProperty {
    const vt = params?.get('VALUE');
    if (vt === 'text' || (Array.isArray(vt) && vt[0] === 'text')) {
      return new AnniversaryProperty(unescapeText(text), params, group);
    }
    const dt = parseDateAndOrTime(text);
    if (dt) return new AnniversaryProperty(dt, params, group);
    return new AnniversaryProperty(text, params, group);
  }

  toContentLine(): string {
    if (this.textValue !== undefined) return escapeText(this.textValue);
    if (this.dateValue) return formatDateAndOrTime(this.dateValue);
    return '';
  }
}

/**
 * REV — Revision timestamp (RFC 6350 §6.7.4) — cardinality: *1
 * Value: timestamp (YYYYMMDDTHHMMSSZ)
 */
export class RevProperty extends Property {
  /** Parsed as a Date object, or raw string if unparseable */
  value: Date | string;

  constructor(value: Date | string, params?: ParameterMap, group?: string) {
    super('REV', params, group);
    this.value = value;
  }

  static fromText(text: string, params?: ParameterMap, group?: string): RevProperty {
    // Try parsing as ISO timestamp
    const dt = parseDateAndOrTime(text);
    if (dt && dt.year !== undefined && dt.hasTime) {
      // Construct a Date
      const d = new Date(Date.UTC(
        dt.year,
        (dt.month ?? 1) - 1,
        dt.day ?? 1,
        dt.hour ?? 0,
        dt.minute ?? 0,
        dt.second ?? 0,
      ));
      if (!isNaN(d.getTime())) return new RevProperty(d, params, group);
    }
    return new RevProperty(text, params, group);
  }

  toContentLine(): string {
    if (this.value instanceof Date) {
      const d = this.value;
      const pad = (n: number, w = 2) => String(n).padStart(w, '0');
      return (
        pad(d.getUTCFullYear(), 4) +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        'T' +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()) +
        'Z'
      );
    }
    return this.value;
  }
}

// ── Key ───────────────────────────────────────────────────────────────────

/**
 * KEY — Public Key (RFC 6350 §6.8.1) — cardinality: *
 * Value: URI or inline text (base64-encoded)
 */
export class KeyProperty extends Property {
  value: string;
  isUri: boolean;

  constructor(value: string, isUri = false, params?: ParameterMap, group?: string) {
    super('KEY', params, group);
    this.value = value;
    this.isUri = isUri;
  }

  static fromText(text: string, params?: ParameterMap, group?: string): KeyProperty {
    const vt = params?.get('VALUE');
    const isUri = vt === 'uri' || (Array.isArray(vt) && vt[0] === 'uri') || looksLikeUri(text);
    return new KeyProperty(text, isUri, params, group);
  }

  toContentLine(): string {
    return this.value; // URI or opaque inline data
  }
}

// ── Related ────────────────────────────────────────────────────────────────

/**
 * RELATED — Related Entity (RFC 6350 §6.6.6) — cardinality: *
 * Value: URI or text
 */
export class RelatedProperty extends Property {
  value: string;
  isUri: boolean;

  constructor(value: string, isUri = true, params?: ParameterMap, group?: string) {
    super('RELATED', params, group);
    this.value = value;
    this.isUri = isUri;
  }

  static fromText(text: string, params?: ParameterMap, group?: string): RelatedProperty {
    const vt = params?.get('VALUE');
    const isUri = vt === 'uri' || (Array.isArray(vt) && vt[0] === 'uri') || looksLikeUri(text);
    const v = isUri ? text : unescapeText(text);
    return new RelatedProperty(v, isUri, params, group);
  }

  toContentLine(): string {
    return this.isUri ? this.value : escapeText(this.value);
  }
}

// ── CLIENTPIDMAP ──────────────────────────────────────────────────────────

/**
 * CLIENTPIDMAP — Client PID Map (RFC 6350 §6.7.7) — cardinality: *
 * Value: pid-number ; URI
 */
export class ClientPidMapProperty extends Property {
  value: ClientPidMap;

  constructor(value: ClientPidMap, params?: ParameterMap, group?: string) {
    super('CLIENTPIDMAP', params, group);
    this.value = value;
  }

  static fromText(text: string, params?: ParameterMap, group?: string): ClientPidMapProperty {
    const semi = text.indexOf(';');
    if (semi === -1) {
      return new ClientPidMapProperty({ pid: parseInt(text, 10) || 1, uri: '' }, params, group);
    }
    const pid = parseInt(text.slice(0, semi), 10) || 1;
    const uri = text.slice(semi + 1);
    return new ClientPidMapProperty({ pid, uri }, params, group);
  }

  toContentLine(): string {
    return `${this.value.pid};${this.value.uri}`;
  }
}

// ── Unknown / Extended Properties ─────────────────────────────────────────

/**
 * An unrecognized IANA or X- property, stored verbatim for round-tripping.
 */
export class UnknownProperty extends Property {
  rawValue: string;

  constructor(
    name: string,
    rawValue: string,
    params?: ParameterMap,
    group?: string,
  ) {
    super(name, params, group);
    this.rawValue = rawValue;
  }

  toContentLine(): string {
    return this.rawValue;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Heuristic check: does this string look like a URI? */
function looksLikeUri(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(value);
}
