/**
 * VCard — the main vCard v4 container class (RFC 6350)
 *
 * Provides typed access to all RFC 6350 properties, plus methods for
 * parsing and generating vCard text.
 */

import type { ValidationResult, ValidationError } from './types.js';
import {
  Property,
  VCardError,
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
  UnknownProperty,
} from './property.js';
import { parseVCardText, type ParseWarning } from './parser.js';
import { serializeVCard, type GenerateOptions } from './generator.js';

// ── VCard class ────────────────────────────────────────────────────────────

/**
 * A vCard v4 object.
 *
 * Properties with cardinality `1*` are arrays that must have at least one
 * element before generating. Properties with cardinality `*1` are single
 * optional values. Properties with cardinality `*` are arrays.
 *
 * Usage:
 * ```ts
 * // Parse
 * const [vcard] = VCard.parse(text);
 *
 * // Build
 * const vcard = new VCard();
 * vcard.fn.push(new FNProperty('Alice Example'));
 * vcard.email.push(new EmailProperty('alice@example.com'));
 * console.log(vcard.toString());
 * ```
 */
export class VCard {
  // ── Parsed version ─────────────────────────────────────────────────────
  /** vCard version string (from parsing — always '4.0' when generating) */
  parsedVersion: string = '4.0';

  /** Warnings accumulated during parsing */
  parseWarnings: ParseWarning[] = [];

  // ── Required: cardinality 1* ────────────────────────────────────────────
  /** Formatted Name — required, at least one (RFC 6350 §6.2.1) */
  fn: FNProperty[] = [];

  // ── Optional singular: cardinality *1 ──────────────────────────────────
  /** Structured Name (RFC 6350 §6.2.2) */
  n?: NProperty;
  /** Birthday (RFC 6350 §6.2.5) */
  bday?: BDayProperty;
  /** Anniversary (RFC 6350 §6.2.6) */
  anniversary?: AnniversaryProperty;
  /** Gender (RFC 6350 §6.2.7) */
  gender?: GenderProperty;
  /** Product Identifier (RFC 6350 §6.7.3) */
  prodid?: ProdIDProperty;
  /** Revision timestamp (RFC 6350 §6.7.4) */
  rev?: RevProperty;
  /** Unique Identifier (RFC 6350 §6.7.6) */
  uid?: UIDProperty;
  /** Kind (RFC 6350 §6.1.4) */
  kind?: KindProperty;

  // ── Optional multiple: cardinality * ───────────────────────────────────
  /** Nicknames (RFC 6350 §6.2.3) */
  nickname: NicknameProperty[] = [];
  /** Photos (RFC 6350 §6.2.4) */
  photo: PhotoProperty[] = [];
  /** Addresses (RFC 6350 §6.3.1) */
  adr: AdrProperty[] = [];
  /** Telephone numbers (RFC 6350 §6.4.1) */
  tel: TelProperty[] = [];
  /** Email addresses (RFC 6350 §6.4.2) */
  email: EmailProperty[] = [];
  /** Instant Messaging (RFC 6350 §6.4.3) */
  impp: IMPPProperty[] = [];
  /** Languages (RFC 6350 §6.4.4) */
  lang: LangProperty[] = [];
  /** Time zones (RFC 6350 §6.5.1) */
  tz: TZProperty[] = [];
  /** Geographic positions (RFC 6350 §6.5.2) */
  geo: GeoProperty[] = [];
  /** Titles (RFC 6350 §6.6.1) */
  title: TitleProperty[] = [];
  /** Roles (RFC 6350 §6.6.2) */
  role: RoleProperty[] = [];
  /** Logos (RFC 6350 §6.6.3) */
  logo: LogoProperty[] = [];
  /** Organizations (RFC 6350 §6.6.4) */
  org: OrgProperty[] = [];
  /** Group members (RFC 6350 §6.6.5) */
  member: MemberProperty[] = [];
  /** Related entities (RFC 6350 §6.6.6) */
  related: RelatedProperty[] = [];
  /** Categories (RFC 6350 §6.7.1) */
  categories: CategoriesProperty[] = [];
  /** Notes (RFC 6350 §6.7.2) */
  note: NoteProperty[] = [];
  /** Sounds (RFC 6350 §6.7.5) */
  sound: SoundProperty[] = [];
  /** Client PID maps (RFC 6350 §6.7.7) */
  clientpidmap: ClientPidMapProperty[] = [];
  /** URLs (RFC 6350 §6.7.8) */
  url: URLProperty[] = [];
  /** Public keys (RFC 6350 §6.8.1) */
  key: KeyProperty[] = [];
  /** Free/Busy URLs (RFC 6350 §6.9.1) */
  fburl: FBURLProperty[] = [];
  /** Calendar User Address URIs (RFC 6350 §6.9.2) */
  caladruri: CALADRURIProperty[] = [];
  /** Calendar URIs (RFC 6350 §6.9.3) */
  caluri: CALURIProperty[] = [];
  /** Source URIs (RFC 6350 §6.1.3) */
  source: SourceProperty[] = [];
  /** XML properties (RFC 6350 §6.1.5) */
  xml: XMLProperty[] = [];

  /** Unknown / extended / vendor properties (stored for round-tripping) */
  extended: UnknownProperty[] = [];

  // ── Factory methods ─────────────────────────────────────────────────────

  /**
   * Parse one or more vCards from text.
   * Tolerant: never throws, collects warnings instead.
   *
   * @returns Array of VCard instances (may be empty if input has no vCards)
   */
  static parse(text: string): VCard[] {
    const { rawVCards } = parseVCardText(text);
    return rawVCards.map(raw => VCard.fromRaw(raw.properties, raw.warnings, raw.version));
  }

  /**
   * Parse exactly one vCard from text.
   * @throws Error if zero vCards are found
   */
  static parseOne(text: string): VCard {
    const vcards = VCard.parse(text);
    if (vcards.length === 0) throw new Error('No vCard found in input');
    return vcards[0]!;
  }

  /**
   * Quick-create a vCard with just a formatted name.
   * Useful for programmatic construction.
   */
  static create(fn: string): VCard {
    const vc = new VCard();
    vc.fn.push(new FNProperty(fn));
    return vc;
  }

  /** Construct a VCard from a flat list of Property instances */
  private static fromRaw(
    properties: Property[],
    warnings: ParseWarning[],
    version: string,
  ): VCard {
    const vc = new VCard();
    vc.parsedVersion = version;
    vc.parseWarnings = warnings;

    for (const prop of properties) {
      vc.addProperty(prop);
    }

    return vc;
  }

  // ── Property management ─────────────────────────────────────────────────

  /**
   * Add a property to this vCard, routing it to the appropriate typed field.
   * Unknown properties go to `extended`.
   */
  addProperty(prop: Property): void {
    switch (prop.name) {
      case 'FN':         this.fn.push(prop as FNProperty); break;
      case 'N':          this.n = prop as NProperty; break;
      case 'NICKNAME':   this.nickname.push(prop as NicknameProperty); break;
      case 'PHOTO':      this.photo.push(prop as PhotoProperty); break;
      case 'BDAY':       this.bday = prop as BDayProperty; break;
      case 'ANNIVERSARY': this.anniversary = prop as AnniversaryProperty; break;
      case 'GENDER':     this.gender = prop as GenderProperty; break;
      case 'ADR':        this.adr.push(prop as AdrProperty); break;
      case 'TEL':        this.tel.push(prop as TelProperty); break;
      case 'EMAIL':      this.email.push(prop as EmailProperty); break;
      case 'IMPP':       this.impp.push(prop as IMPPProperty); break;
      case 'LANG':       this.lang.push(prop as LangProperty); break;
      case 'TZ':         this.tz.push(prop as TZProperty); break;
      case 'GEO':        this.geo.push(prop as GeoProperty); break;
      case 'TITLE':      this.title.push(prop as TitleProperty); break;
      case 'ROLE':       this.role.push(prop as RoleProperty); break;
      case 'LOGO':       this.logo.push(prop as LogoProperty); break;
      case 'ORG':        this.org.push(prop as OrgProperty); break;
      case 'MEMBER':     this.member.push(prop as MemberProperty); break;
      case 'RELATED':    this.related.push(prop as RelatedProperty); break;
      case 'CATEGORIES': this.categories.push(prop as CategoriesProperty); break;
      case 'NOTE':       this.note.push(prop as NoteProperty); break;
      case 'PRODID':     this.prodid = prop as ProdIDProperty; break;
      case 'REV':        this.rev = prop as RevProperty; break;
      case 'SOUND':      this.sound.push(prop as SoundProperty); break;
      case 'UID':        this.uid = prop as UIDProperty; break;
      case 'CLIENTPIDMAP': this.clientpidmap.push(prop as ClientPidMapProperty); break;
      case 'URL':        this.url.push(prop as URLProperty); break;
      case 'KEY':        this.key.push(prop as KeyProperty); break;
      case 'FBURL':      this.fburl.push(prop as FBURLProperty); break;
      case 'CALADRURI':  this.caladruri.push(prop as CALADRURIProperty); break;
      case 'CALURI':     this.caluri.push(prop as CALURIProperty); break;
      case 'KIND':       this.kind = prop as KindProperty; break;
      case 'XML':        this.xml.push(prop as XMLProperty); break;
      case 'SOURCE':     this.source.push(prop as SourceProperty); break;
      default:           this.extended.push(prop as UnknownProperty); break;
    }
  }

  /**
   * Get all properties as a flat array, in logical order.
   * Includes all typed properties and extended properties.
   */
  allProperties(): Property[] {
    const all: Property[] = [];

    // Singular optional
    const addOpt = (p: Property | undefined) => { if (p) all.push(p); };

    // Multiple
    const addMany = (arr: Property[]) => all.push(...arr);

    addMany(this.fn);
    addOpt(this.n);
    addMany(this.nickname);
    addMany(this.photo);
    addOpt(this.bday);
    addOpt(this.anniversary);
    addOpt(this.gender);
    addMany(this.adr);
    addMany(this.tel);
    addMany(this.email);
    addMany(this.impp);
    addMany(this.lang);
    addMany(this.tz);
    addMany(this.geo);
    addMany(this.title);
    addMany(this.role);
    addMany(this.logo);
    addMany(this.org);
    addMany(this.member);
    addMany(this.related);
    addMany(this.categories);
    addMany(this.note);
    addOpt(this.prodid);
    addOpt(this.rev);
    addMany(this.sound);
    addOpt(this.uid);
    addMany(this.clientpidmap);
    addMany(this.url);
    addMany(this.key);
    addMany(this.fburl);
    addMany(this.caladruri);
    addMany(this.caluri);
    addOpt(this.kind);
    addMany(this.xml);
    addMany(this.source);
    addMany(this.extended);

    return all;
  }

  // ── Convenience accessors ───────────────────────────────────────────────

  /**
   * Get the primary (most preferred or first) formatted name string.
   */
  get displayName(): string {
    const sorted = [...this.fn].sort((a, b) => (a.pref ?? 100) - (b.pref ?? 100));
    return sorted[0]?.value ?? '';
  }

  /**
   * Get the primary email address string.
   */
  get primaryEmail(): string | undefined {
    const sorted = [...this.email].sort((a, b) => (a.pref ?? 100) - (b.pref ?? 100));
    return sorted[0]?.value;
  }

  /**
   * Get the primary telephone string.
   */
  get primaryTel(): string | undefined {
    const sorted = [...this.tel].sort((a, b) => (a.pref ?? 100) - (b.pref ?? 100));
    return sorted[0]?.value;
  }

  // ── Generation ──────────────────────────────────────────────────────────

  /**
   * Generate RFC 6350-compliant vCard text.
   * Uses strict CRLF line endings and 75-octet line folding.
   *
   * @throws VCardError if the vCard is invalid (e.g. missing FN)
   */
  toString(options?: GenerateOptions): string {
    return serializeVCard(this.allProperties(), options);
  }

  /**
   * Generate without validation (useful for partial/draft vCards).
   * Use with caution — output may not be RFC-compliant.
   */
  toStringLenient(): string {
    return serializeVCard(this.allProperties(), { validate: false });
  }

  // ── Validation ──────────────────────────────────────────────────────────

  /**
   * Validate this vCard against RFC 6350 requirements.
   * Returns a result object rather than throwing.
   */
  validate(): ValidationResult {
    const errors: ValidationError[] = [];

    if (this.fn.length === 0) {
      errors.push({ property: 'FN', message: 'Missing required property: FN (cardinality 1*)' });
    }

    for (const prop of this.allProperties()) {
      const pref = prop.pref;
      if (pref !== undefined && (pref < 1 || pref > 100 || !Number.isInteger(pref))) {
        errors.push({
          property: prop.name,
          message: `PREF parameter must be an integer 1–100, got: ${pref}`,
        });
      }
    }

    if (this.gender) {
      const valid = ['M', 'F', 'O', 'N', 'U', ''];
      if (!valid.includes(this.gender.value.sex)) {
        errors.push({
          property: 'GENDER',
          message: `Invalid sex component: ${this.gender.value.sex}`,
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ── Cloning ─────────────────────────────────────────────────────────────

  /**
   * Deep-clone by round-tripping through text serialization.
   * Produces a clean v4 vCard from whatever version was parsed.
   */
  clone(): VCard {
    return VCard.parseOne(this.toString({ validate: false }));
  }

  // ── JSON ────────────────────────────────────────────────────────────────

  /**
   * Convert to a plain object suitable for JSON serialization (jCard-ish).
   * This is a simplified representation, not full jCard (RFC 7095).
   */
  toJSON(): Record<string, unknown> {
    return {
      version: '4.0',
      fn: this.fn.map(p => p.value),
      n: this.n ? this.n.value : undefined,
      nickname: this.nickname.flatMap(p => p.values),
      email: this.email.map(p => ({ value: p.value, type: p.type, pref: p.pref })),
      tel: this.tel.map(p => ({ value: p.value, type: p.type, pref: p.pref })),
      adr: this.adr.map(p => ({ value: p.value, type: p.type, label: p.label })),
      org: this.org.map(p => p.value),
      title: this.title.map(p => p.value),
      role: this.role.map(p => p.value),
      url: this.url.map(p => p.value),
      note: this.note.map(p => p.value),
      categories: this.categories.flatMap(p => p.values),
      bday: this.bday?.dateValue ?? this.bday?.textValue,
      anniversary: this.anniversary?.dateValue ?? this.anniversary?.textValue,
      gender: this.gender?.value,
      uid: this.uid?.value,
      rev: this.rev?.value instanceof Date ? this.rev.value.toISOString() : this.rev?.value,
    };
  }
}

// Re-export VCardError for convenience
export { VCardError };
