/**
 * Core type definitions for vCard v4 (RFC 6350)
 */

// ── Value Types ────────────────────────────────────────────────────────────

/** All value types defined in RFC 6350 section 4 */
export type ValueType =
  | 'text'
  | 'uri'
  | 'date'
  | 'time'
  | 'date-time'
  | 'date-and-or-time'
  | 'timestamp'
  | 'boolean'
  | 'integer'
  | 'float'
  | 'utc-offset'
  | 'language-tag';

/** Well-known TYPE parameter values */
export type TypeValue =
  // address/email/phone
  | 'work' | 'home'
  // telephone
  | 'voice' | 'fax' | 'cell' | 'video' | 'pager' | 'textphone' | 'text'
  // related
  | 'contact' | 'acquaintance' | 'friend' | 'met'
  | 'co-worker' | 'colleague' | 'co-resident' | 'neighbor'
  | 'child' | 'parent' | 'sibling' | 'spouse' | 'kin'
  | 'muse' | 'crush' | 'date' | 'sweetheart' | 'me' | 'agent' | 'emergency'
  | string;

/** KIND property values */
export type KindValue = 'individual' | 'group' | 'org' | 'location' | string;

/** GENDER sex component */
export type GenderSex = 'M' | 'F' | 'O' | 'N' | 'U' | '';

// ── Structured Value Types ─────────────────────────────────────────────────

/**
 * Partial date representation (RFC 6350 section 4.3.1).
 * Supports reduced accuracy: year-only, year-month, or full date.
 * Also supports omitted year (month-day only) for birthdays where year is unknown.
 */
export interface PartialDate {
  year?: number;
  month?: number;
  day?: number;
}

/** Time-of-day representation */
export interface TimeValue {
  hour?: number;
  minute?: number;
  second?: number;
  /** UTC offset: '+HH:MM', '-HH:MM', or 'Z' */
  utcOffset?: string;
}

/** Combined date-and-or-time value */
export interface DateAndOrTime extends PartialDate, TimeValue {
  hasTime: boolean;
}

/** Structured name (N property) — RFC 6350 section 6.2.2 */
export interface StructuredName {
  familyNames: string[];
  givenNames: string[];
  additionalNames: string[];
  honorificPrefixes: string[];
  honorificSuffixes: string[];
}

/** Postal address (ADR property) — RFC 6350 section 6.3.1 */
export interface Address {
  postOfficeBox: string;
  extendedAddress: string;
  streetAddress: string;
  locality: string;
  region: string;
  postalCode: string;
  countryName: string;
}

/** Organization (ORG property) — RFC 6350 section 6.6.4 */
export interface Organization {
  name: string;
  units: string[];
}

/** Gender value — RFC 6350 section 6.2.7 */
export interface Gender {
  sex: GenderSex;
  identity?: string;
}

/** CLIENTPIDMAP value — RFC 6350 section 6.7.7 */
export interface ClientPidMap {
  pid: number;
  uri: string;
}

/** Geographic position — URI format: geo:lat,lon */
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

// ── Parameter Map ──────────────────────────────────────────────────────────

/** Raw parameter storage: parameter name → value or list of values */
export type ParameterMap = Map<string, string | string[]>;

// ── Raw Property (pre-typed parsing) ──────────────────────────────────────

/**
 * A property as parsed from text, before type-specific value interpretation.
 * Useful for round-tripping unknown properties.
 */
export interface RawProperty {
  group?: string;
  name: string;
  parameters: ParameterMap;
  value: string;
}

// ── Validation ─────────────────────────────────────────────────────────────

/** A validation error with context */
export interface ValidationError {
  property: string;
  message: string;
}

/** Result of vCard validation */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
