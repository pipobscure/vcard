# @pipobscure/vcard

A fully featured, RFC 6350-compliant vCard v4 library for Node.js and TypeScript.

Designed for use with CardDAV servers and clients. The parser is deliberately tolerant — it handles vCard v2.1, v3.0, and v4.0 input, Apple Contacts exports, QUOTED-PRINTABLE encoding, and various real-world quirks without throwing. The generator is deliberately strict — it produces RFC 6350-compliant output with CRLF line endings, UTF-8 byte-accurate line folding, and full validation.

---

## Installation

```sh
npm install @pipobscure/vcard
```

Requires Node.js 18 or later (uses `Buffer`, ES modules).

---

## Quick Start

```ts
import { VCard, FNProperty, EmailProperty, TelProperty, NProperty } from '@pipobscure/vcard';

// --- Parse ---
const vcards = VCard.parse(rawText);
const vc = vcards[0];
console.log(vc.displayName);   // 'Alice Example'
console.log(vc.primaryEmail);  // 'alice@example.com'

// --- Build ---
const vc = new VCard();
vc.fn.push(new FNProperty('Alice Example'));
vc.n = new NProperty({
  familyNames: ['Example'],
  givenNames:  ['Alice'],
  additionalNames: [],
  honorificPrefixes: [],
  honorificSuffixes: [],
});
vc.email.push(new EmailProperty('alice@example.com'));

const text = vc.toString();
// BEGIN:VCARD\r\n
// VERSION:4.0\r\n
// FN:Alice Example\r\n
// ...
// END:VCARD\r\n
```

---

## Table of Contents

- [Parsing](#parsing)
- [Generating](#generating)
- [The VCard class](#the-vcard-class)
- [Property classes](#property-classes)
  - [Common parameter accessors](#common-parameter-accessors)
  - [Identification properties](#identification-properties)
  - [Delivery addressing](#delivery-addressing)
  - [Communications](#communications)
  - [Geographic](#geographic)
  - [Organizational](#organizational)
  - [Explanatory](#explanatory)
  - [Security](#security)
  - [Calendar](#calendar)
  - [General](#general)
  - [Unknown and extended properties](#unknown-and-extended-properties)
- [Date and time values](#date-and-time-values)
- [Escaping utilities](#escaping-utilities)
- [Validation](#validation)
- [RFC compliance notes](#rfc-compliance-notes)

---

## Parsing

### `VCard.parse(text: string): VCard[]`

Parse one or more vCards from a string. Returns an array (empty if no vCards are found). Never throws — malformed input is handled tolerantly and a list of `parseWarnings` is attached to each resulting `VCard`.

```ts
import { VCard } from '@pipobscure/vcard';

const vcards = VCard.parse(text);
for (const vc of vcards) {
  if (vc.parseWarnings.length > 0) {
    console.warn('Parse warnings:', vc.parseWarnings);
  }
  console.log(vc.displayName);
}
```

### `VCard.parseOne(text: string): VCard`

Parse exactly one vCard. Throws `Error` if the input contains no vCards.

```ts
const vc = VCard.parseOne(text);
```

### Convenience functions

```ts
import { parse, parseOne } from '@pipobscure/vcard';

const vcards = parse(text);       // same as VCard.parse()
const vc     = parseOne(text);    // same as VCard.parseOne()
```

### Parsing tolerance

The parser handles all of the following without throwing:

- vCard versions 2.1, 3.0, and 4.0
- LF-only line endings (in addition to RFC-required CRLF)
- Mixed line endings within a single file
- Folded content lines (CRLF + whitespace continuation)
- `ENCODING=QUOTED-PRINTABLE` with multi-byte UTF-8 sequences (v2.1/v3.0)
- `ENCODING=b` (base64) parameter flag (v3.0 syntax)
- Case-insensitive property names and parameter names
- Comma-separated `TYPE` values (`TYPE=WORK,VOICE`)
- Quoted parameter values with commas (`TYPE="work,voice"`)
- Item-grouped properties (`item1.EMAIL`, `item1.X-ABLabel`)
- Unknown / proprietary properties (stored verbatim as `UnknownProperty`)
- Multiple vCards in a single string
- Content before `BEGIN:VCARD` and between vCards
- Missing `END:VCARD` (parsed with a warning)
- Properties with empty values

### `ParseWarning`

Each parsed `VCard` has a `parseWarnings: ParseWarning[]` field.

```ts
interface ParseWarning {
  line?:    number;   // 1-based line number in the input, if known
  message:  string;
}
```

---

## Generating

### `vcard.toString(options?: GenerateOptions): string`

Serialize the vCard to RFC 6350-compliant text. Throws `VCardError` if the card fails validation.

```ts
const text = vc.toString();
```

### `vcard.toStringLenient(): string`

Serialize without validation. Useful for inspecting or debugging partial/draft cards.

```ts
const text = vc.toStringLenient();
```

### `stringify(vcard: VCard | VCard[]): string`

Serialize one or multiple vCards to a single string.

```ts
import { stringify } from '@pipobscure/vcard';

const text = stringify([vc1, vc2]);
```

### `GenerateOptions`

```ts
interface GenerateOptions {
  validate?: boolean;  // default: true — throw VCardError on invalid cards
}
```

### Output guarantees

- Line endings are always `\r\n` (CRLF) per RFC 6350 §3.2.
- Lines are folded at 75 octets (UTF-8 byte count), not 75 characters. Continuation lines begin with a single space.
- `VERSION:4.0` is always the first property after `BEGIN:VCARD`.
- All text values are escaped (`\`, `,`, `;`, newline) per RFC 6350 §3.4.
- Parameter values that contain `:`, `;`, `,`, or `"` are automatically quoted.
- Properties are emitted in a consistent, human-readable order.

---

## The VCard class

```ts
class VCard {
  // Accumulates warnings from parsing; empty for programmatically built cards
  parseWarnings: ParseWarning[];

  // Version string from input (always '4.0' in generated output)
  parsedVersion: string;

  // ── Required (RFC cardinality 1*) ──────────────────────────────────────
  fn:           FNProperty[];          // at least one required

  // ── Optional singular (RFC cardinality *1) ─────────────────────────────
  n?:           NProperty;
  bday?:        BDayProperty;
  anniversary?: AnniversaryProperty;
  gender?:      GenderProperty;
  prodid?:      ProdIDProperty;
  rev?:         RevProperty;
  uid?:         UIDProperty;
  kind?:        KindProperty;

  // ── Optional multiple (RFC cardinality *) ──────────────────────────────
  nickname:     NicknameProperty[];
  photo:        PhotoProperty[];
  adr:          AdrProperty[];
  tel:          TelProperty[];
  email:        EmailProperty[];
  impp:         IMPPProperty[];
  lang:         LangProperty[];
  tz:           TZProperty[];
  geo:          GeoProperty[];
  title:        TitleProperty[];
  role:         RoleProperty[];
  logo:         LogoProperty[];
  org:          OrgProperty[];
  member:       MemberProperty[];
  related:      RelatedProperty[];
  categories:   CategoriesProperty[];
  note:         NoteProperty[];
  sound:        SoundProperty[];
  clientpidmap: ClientPidMapProperty[];
  url:          URLProperty[];
  key:          KeyProperty[];
  fburl:        FBURLProperty[];
  caladruri:    CALADRURIProperty[];
  caluri:       CALURIProperty[];
  source:       SourceProperty[];
  xml:          XMLProperty[];

  // Unknown / extended / vendor properties (X-, unrecognised IANA)
  extended:     UnknownProperty[];
}
```

### Convenience accessors

```ts
vc.displayName   // string — value of the most-preferred FN property
vc.primaryEmail  // string | undefined — most-preferred email address
vc.primaryTel    // string | undefined — most-preferred telephone
```

"Most preferred" means the property with the lowest `PREF` parameter value (1 = highest preference). If no `PREF` is set, the first property in the list is used.

### `VCard.create(fn: string): VCard`

Quick-create a valid vCard with a single formatted name.

```ts
const vc = VCard.create('Bob Builder');
vc.email.push(new EmailProperty('bob@example.com'));
```

### `vcard.addProperty(prop: Property): void`

Add any property to the correct typed field on the VCard.

```ts
vc.addProperty(new EmailProperty('alice@example.com'));
// equivalent to: vc.email.push(new EmailProperty('alice@example.com'))
```

### `vcard.allProperties(): Property[]`

Return all properties as a flat array in logical order. Used internally by `toString()`.

### `vcard.validate(): ValidationResult`

Validate without throwing.

```ts
const result = vc.validate();
if (!result.valid) {
  for (const err of result.errors) {
    console.error(`${err.property}: ${err.message}`);
  }
}
```

### `vcard.clone(): VCard`

Deep-clone by round-tripping through serialization. Always produces a clean v4 vCard.

### `vcard.toJSON(): Record<string, unknown>`

Simplified JSON representation (not full jCard / RFC 7095).

---

## Property classes

Every property class extends `Property` and exposes:

- `name: string` — uppercase property name (e.g. `'FN'`)
- `group?: string` — optional group label (e.g. `'item1'` in Apple exports)
- `params: ParameterMap` — raw parameter map (`Map<string, string | string[]>`)
- `toContentLine(): string` — serializes the value portion (used by the generator)

### Common parameter accessors

All property classes inherit these convenience getters/setters:

```ts
prop.type      // string[] — TYPE parameter values, lowercased
prop.pref      // number | undefined — PREF parameter (1–100, 1 = most preferred)
prop.language  // string | undefined — LANGUAGE parameter (BCP 47 tag)
prop.altid     // string | undefined — ALTID parameter
prop.pid       // string | undefined — PID parameter
prop.valueType // string | undefined — VALUE parameter (e.g. 'uri', 'text')
```

Setting a value to `undefined` removes the parameter:

```ts
prop.type = ['work', 'voice'];
prop.pref = 1;
prop.language = 'en';
prop.language = undefined;  // removes LANGUAGE parameter
```

---

### Identification properties

#### `FNProperty` — Formatted Name (RFC 6350 §6.2.1)

Cardinality: `1*` (required, one or more)

```ts
class FNProperty extends TextProperty {
  value: string;
}

new FNProperty('Alice Example')
new FNProperty('Alice Example', params, group)
```

A vCard must have at least one `FN`. Multiple `FN` properties may be given to provide alternate language versions using `ALTID` and `LANGUAGE` parameters:

```ts
const fn1 = new FNProperty('山田太郎');
fn1.altid    = '1';
fn1.language = 'ja';

const fn2 = new FNProperty('Yamada Taro');
fn2.altid    = '1';
fn2.language = 'en';
```

#### `NProperty` — Structured Name (RFC 6350 §6.2.2)

Cardinality: `*1` (optional, at most one)

```ts
class NProperty extends Property {
  value: StructuredName;
}

interface StructuredName {
  familyNames:      string[];   // e.g. ['Smith']
  givenNames:       string[];   // e.g. ['John']
  additionalNames:  string[];   // e.g. ['Q.']
  honorificPrefixes: string[];  // e.g. ['Dr.']
  honorificSuffixes: string[];  // e.g. ['Jr.', 'PhD']
}
```

Each component is a list to support multiple values (e.g. compound surnames). The `SORT-AS` parameter provides a sort key:

```ts
const n = new NProperty({
  familyNames:       ['van der Berg'],
  givenNames:        ['Jan'],
  additionalNames:   [],
  honorificPrefixes: [],
  honorificSuffixes: [],
});
n.params.set('SORT-AS', 'Berg,Jan');
```

#### `NicknameProperty` — Nickname (RFC 6350 §6.2.3)

Cardinality: `*`

```ts
class NicknameProperty extends TextListProperty {
  values: string[];
}

new NicknameProperty(['Johnny', 'The Genius'])
```

#### `PhotoProperty` — Photo (RFC 6350 §6.2.4)

Cardinality: `*`

The value is a URI. In v4, inline data is expressed as a `data:` URI.

```ts
class PhotoProperty extends UriProperty {
  value: string;
  mediatype?: string;  // MEDIATYPE parameter
}

new PhotoProperty('https://example.com/alice.jpg')
new PhotoProperty('data:image/jpeg;base64,/9j/4AA...')
```

#### `BDayProperty` — Birthday (RFC 6350 §6.2.5)

Cardinality: `*1`

```ts
class BDayProperty extends Property {
  dateValue: DateAndOrTime | null;  // parsed date, or null if VALUE=text
  textValue?: string;               // present when VALUE=text
}

// Parsed from a date string
BDayProperty.fromText('19900315')     // full date
BDayProperty.fromText('--0315')       // month+day, no year
BDayProperty.fromText('1990')         // year only

// VALUE=text for approximate dates
BDayProperty.fromText('circa 1800', new Map([['VALUE', 'text']]))

// From a typed value
new BDayProperty({ year: 1990, month: 3, day: 15, hasTime: false })
new BDayProperty('circa 1800')  // stores as textValue
```

#### `AnniversaryProperty` — Anniversary (RFC 6350 §6.2.6)

Cardinality: `*1`. Identical structure to `BDayProperty`.

#### `GenderProperty` — Gender (RFC 6350 §6.2.7)

Cardinality: `*1`

```ts
class GenderProperty extends Property {
  value: Gender;
}

interface Gender {
  sex:       GenderSex;     // 'M' | 'F' | 'O' | 'N' | 'U' | ''
  identity?: string;        // free-form identity text
}

new GenderProperty({ sex: 'M' })
new GenderProperty({ sex: 'O', identity: 'non-binary' })
new GenderProperty({ sex: '', identity: 'it/its' })
```

Sex values per RFC 6350:

| Value | Meaning |
|-------|---------|
| `M`   | Male |
| `F`   | Female |
| `O`   | Other |
| `N`   | None or not applicable |
| `U`   | Unknown |
| `''`  | Not specified (use with identity text) |

---

### Delivery addressing

#### `AdrProperty` — Address (RFC 6350 §6.3.1)

Cardinality: `*`

```ts
class AdrProperty extends Property {
  value: Address;
  label?: string;   // LABEL parameter — delivery label text
  cc?: string;      // CC parameter — ISO 3166-1 country code
}

interface Address {
  postOfficeBox:   string;
  extendedAddress: string;
  streetAddress:   string;
  locality:        string;  // city
  region:          string;  // state/province
  postalCode:      string;
  countryName:     string;
}

const adr = new AdrProperty({
  postOfficeBox:   '',
  extendedAddress: 'Suite 100',
  streetAddress:   '1 Infinite Loop',
  locality:        'Cupertino',
  region:          'CA',
  postalCode:      '95014',
  countryName:     'USA',
});
adr.type  = ['work'];
adr.label = '1 Infinite Loop\nCupertino, CA 95014\nUSA';
```

---

### Communications

#### `TelProperty` — Telephone (RFC 6350 §6.4.1)

Cardinality: `*`

In v4, telephone values should be URIs (using `tel:` or `sip:` schemes). Plain text values are also accepted for compatibility.

```ts
class TelProperty extends Property {
  value:  string;
  isUri:  boolean;  // true when value is a URI
}

new TelProperty('tel:+1-555-123-4567')      // URI (recommended)
new TelProperty('+1 555 123 4567')          // text (tolerated)
```

Well-known TYPE values: `voice`, `fax`, `cell`, `video`, `pager`, `textphone`, `text`, `work`, `home`.

#### `EmailProperty` — Email (RFC 6350 §6.4.2)

Cardinality: `*`

```ts
class EmailProperty extends TextProperty {
  value: string;
}

const email = new EmailProperty('alice@example.com');
email.type = ['work'];
email.pref = 1;
```

#### `IMPPProperty` — Instant Messaging (RFC 6350 §6.4.3)

Cardinality: `*`. Value is a URI (e.g. `xmpp:alice@example.com`, `sip:alice@example.com`).

#### `LangProperty` — Language (RFC 6350 §6.4.4)

Cardinality: `*`. Value is a BCP 47 language tag.

```ts
const lang = new LangProperty('fr');
lang.pref = 1;
```

---

### Geographic

#### `TZProperty` — Time Zone (RFC 6350 §6.5.1)

Cardinality: `*`

```ts
class TZProperty extends Property {
  value:     string;
  valueKind: 'utc-offset' | 'uri' | 'text';
}

TZProperty.fromText('-0500')                 // UTC offset → valueKind: 'utc-offset'
TZProperty.fromText('-05:00')                // colon format UTC offset
TZProperty.fromText('America/New_York',      // IANA name → valueKind: 'text'
  new Map([['VALUE', 'text']]))
TZProperty.fromText('https://...', ...)      // URI → valueKind: 'uri'
```

#### `GeoProperty` — Geographic Position (RFC 6350 §6.5.2)

Cardinality: `*`. Value is a `geo:` URI.

```ts
class GeoProperty extends Property {
  uri: string;
  readonly coordinates: { latitude: number; longitude: number } | undefined;
}

// From coordinates
const geo = GeoProperty.fromCoordinates(37.386013, -122.082932);
// geo.uri === 'geo:37.386013,-122.082932'

// From URI string
const geo = new GeoProperty('geo:51.5074,-0.1278');
console.log(geo.coordinates);  // { latitude: 51.5074, longitude: -0.1278 }
```

---

### Organizational

#### `TitleProperty` / `RoleProperty`

Cardinality: `*`. Both are text properties.

```ts
new TitleProperty('Software Engineer')
new RoleProperty('Lead Developer')
```

#### `LogoProperty`

Cardinality: `*`. URI value (same as `PhotoProperty`).

#### `OrgProperty` — Organization (RFC 6350 §6.6.4)

Cardinality: `*`

```ts
class OrgProperty extends Property {
  value: Organization;
}

interface Organization {
  name:  string;
  units: string[];  // organizational units (zero or more)
}

new OrgProperty({ name: 'Acme Corp', units: [] })
new OrgProperty({ name: 'Acme Corp', units: ['Engineering', 'Platform'] })
```

The `SORT-AS` parameter provides a sort key for the name and units.

#### `MemberProperty` — Group Member (RFC 6350 §6.6.5)

Cardinality: `*`. URI value. Used in `KIND:group` cards to list members.

```ts
new MemberProperty('urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6')
new MemberProperty('mailto:bob@example.com')
```

#### `RelatedProperty` — Related Entity (RFC 6350 §6.6.6)

Cardinality: `*`. May be a URI or text (`VALUE=text`).

```ts
class RelatedProperty extends Property {
  value:  string;
  isUri:  boolean;
}

RelatedProperty.fromText('urn:uuid:...', params)        // URI
RelatedProperty.fromText('Jane Doe',                    // text
  new Map([['VALUE', 'text'], ['TYPE', 'spouse']]))
```

Well-known TYPE values: `contact`, `acquaintance`, `friend`, `met`, `co-worker`, `colleague`, `co-resident`, `neighbor`, `child`, `parent`, `sibling`, `spouse`, `kin`, `muse`, `crush`, `date`, `sweetheart`, `me`, `agent`, `emergency`.

---

### Explanatory

#### `CategoriesProperty` — Categories (RFC 6350 §6.7.1)

Cardinality: `*`. Value is a comma-separated list of text tags.

```ts
new CategoriesProperty(['friend', 'colleague', 'vip'])
```

#### `NoteProperty` — Note (RFC 6350 §6.7.2)

Cardinality: `*`. Text value; newlines are encoded as `\n` in the vCard text.

#### `ProdIDProperty` — Product Identifier (RFC 6350 §6.7.3)

Cardinality: `*1`. Should identify the software that created the vCard.

```ts
vc.prodid = new ProdIDProperty('-//My App//My App 1.0//EN');
```

#### `RevProperty` — Revision Timestamp (RFC 6350 §6.7.4)

Cardinality: `*1`. Stored as a JavaScript `Date`, or a raw string if parsing failed.

```ts
class RevProperty extends Property {
  value: Date | string;
}

vc.rev = new RevProperty(new Date());
// Serialized as: REV:20240615T103000Z
```

#### `SoundProperty` — Sound (RFC 6350 §6.7.5)

Cardinality: `*`. URI value.

#### `UIDProperty` — Unique Identifier (RFC 6350 §6.7.6)

Cardinality: `*1`. Typically a `urn:uuid:` URI, but may be any URI or text.

```ts
vc.uid = new UIDProperty('urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6');
```

When the value looks like a URI (has a scheme), it is serialized without text escaping.

#### `ClientPidMapProperty` — Client PID Map (RFC 6350 §6.7.7)

Cardinality: `*`. Used for synchronisation between CardDAV clients. The value is a semicolon-separated pair of a PID number and a URI.

```ts
class ClientPidMapProperty extends Property {
  value: ClientPidMap;
}

interface ClientPidMap {
  pid: number;
  uri: string;
}

new ClientPidMapProperty({ pid: 1, uri: 'urn:uuid:...' })
```

#### `URLProperty` — URL (RFC 6350 §6.7.8)

Cardinality: `*`. URI value.

---

### Security

#### `KeyProperty` — Public Key (RFC 6350 §6.8.1)

Cardinality: `*`. May be a URI or inline base64-encoded data.

```ts
class KeyProperty extends Property {
  value:  string;
  isUri:  boolean;
}

KeyProperty.fromText('http://example.com/key.pgp',
  new Map([['VALUE', 'uri'], ['TYPE', 'work']]))
```

---

### Calendar

#### `FBURLProperty` — Free/Busy URL (RFC 6350 §6.9.1)

Cardinality: `*`. URI value.

#### `CALADRURIProperty` — Calendar User Address URI (RFC 6350 §6.9.2)

Cardinality: `*`. URI value. Used to schedule meetings with the contact.

#### `CALURIProperty` — Calendar URI (RFC 6350 §6.9.3)

Cardinality: `*`. URI value.

---

### General

#### `KindProperty` — Kind (RFC 6350 §6.1.4)

Cardinality: `*1`. Classifies the vCard object.

```ts
vc.kind = new KindProperty('individual');  // default
vc.kind = new KindProperty('group');       // distribution list
vc.kind = new KindProperty('org');         // organisation
vc.kind = new KindProperty('location');    // place
```

#### `SourceProperty` — Source (RFC 6350 §6.1.3)

Cardinality: `*`. URI indicating where the vCard data can be fetched.

#### `XMLProperty` — XML (RFC 6350 §6.1.5)

Cardinality: `*`. Extends vCard with XML data. The value is escaped text containing XML.

---

### Unknown and extended properties

Any property not listed in RFC 6350 — including `X-` vendor extensions, proprietary Apple/Google/Outlook properties, and unknown IANA properties — is stored as an `UnknownProperty` in `vcard.extended`. This ensures round-trip fidelity.

```ts
class UnknownProperty extends Property {
  rawValue: string;  // the raw, uninterpreted value string
}

// Example: Apple-specific X-ABLabel grouped with an email
// item1.EMAIL:john@example.com
// item1.X-ABLabel:Work
const label = vc.extended.find(p => p.name === 'X-ABLABEL' && p.group === 'item1');
console.log(label?.rawValue);  // 'Work'
```

Unknown properties are serialized back verbatim, preserving groups and parameters.

---

## Date and time values

RFC 6350 §4.3 defines several date/time formats. The library uses the `DateAndOrTime` interface for structured representation.

```ts
interface DateAndOrTime {
  year?:      number;
  month?:     number;
  day?:       number;
  hour?:      number;
  minute?:    number;
  second?:    number;
  utcOffset?: string;  // 'Z', '+HH:MM', '-HH:MM', '+HHMM', etc.
  hasTime:    boolean;
}
```

### `parseDateAndOrTime(value: string): DateAndOrTime | null`

Parse any RFC 6350 date/time string.

```ts
import { parseDateAndOrTime } from '@pipobscure/vcard';

parseDateAndOrTime('19900315')
// { year: 1990, month: 3, day: 15, hasTime: false }

parseDateAndOrTime('--0315')
// { year: undefined, month: 3, day: 15, hasTime: false }
// (birthday where year is not known)

parseDateAndOrTime('1990')
// { year: 1990, hasTime: false }

parseDateAndOrTime('20090808T1430-0500')
// { year: 2009, month: 8, day: 8, hour: 14, minute: 30, utcOffset: '-0500', hasTime: true }

parseDateAndOrTime('20240101T120000Z')
// { year: 2024, month: 1, day: 1, hour: 12, minute: 0, second: 0, utcOffset: 'Z', hasTime: true }
```

Returns `null` if the string is empty or completely unparseable.

### `formatDateAndOrTime(dt: DateAndOrTime): string`

Serialize a `DateAndOrTime` back to RFC 6350 text.

---

## Escaping utilities

These are exported for advanced use; the library handles them automatically during parsing and generation.

```ts
import {
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
} from '@pipobscure/vcard';
```

### Text escaping (RFC 6350 §3.4)

```ts
escapeText('Smith, John; Jr.')
// 'Smith\\, John\\; Jr.'

unescapeText('Smith\\, John\\; Jr.')
// 'Smith, John; Jr.'

unescapeText('Line one\\nLine two')
// 'Line one\nLine two'
```

### Structured value splitting

Splitting respects backslash escapes, so an escaped delimiter is not treated as a component boundary.

```ts
// Semicolon-separated (N, ADR, ORG, GENDER)
parseStructured('Smith;John;Q.;Dr.;')
// ['Smith', 'John', 'Q.', 'Dr.', '']

// Comma-separated (NICKNAME, CATEGORIES)
parseList('friend,colleague,vip')
// ['friend', 'colleague', 'vip']

// Structured-with-lists (N honorific-suffixes: "ing. jr,M.Sc.")
parseStructuredList('Smith;Simon;;;ing. jr,M.Sc.')
// [['Smith'], ['Simon'], [], [], ['ing. jr', 'M.Sc.']]
```

### Parameter quoting

```ts
needsParamQuoting('work,voice')   // true
needsParamQuoting('work')         // false

quoteParamValue('work,voice')     // '"work,voice"'
quoteParamValue('work')           // 'work'

unquoteParamValue('"work,voice"') // 'work,voice'
```

---

## Validation

### `VCardError`

Thrown by `vcard.toString()` when the card fails strict validation. Has an optional `property` field naming the offending property.

```ts
import { VCardError } from '@pipobscure/vcard';

try {
  const text = vc.toString();
} catch (err) {
  if (err instanceof VCardError) {
    console.error(`Validation failed on ${err.property}: ${err.message}`);
  }
}
```

### Validation rules (enforced on generation)

| Rule | Detail |
|------|--------|
| `FN` required | At least one `FN` property must be present (cardinality `1*`). |
| `PREF` range | PREF parameter must be an integer between 1 and 100 inclusive. |
| `GENDER` sex | Must be one of `M`, `F`, `O`, `N`, `U`, or empty string. |
| `REV` validity | If a `Date` object is stored, it must not be `NaN`. |

### `vcard.validate(): ValidationResult`

Non-throwing alternative to `toString()` for checking validity.

```ts
interface ValidationResult {
  valid:  boolean;
  errors: ValidationError[];
}

interface ValidationError {
  property: string;
  message:  string;
}
```

---

## RFC compliance notes

### vCard 4.0 (RFC 6350)

This library targets RFC 6350. All properties defined in §6 are implemented as typed classes with correct cardinality semantics, value type parsing, and serialization.

### Line folding (RFC 6350 §3.2)

Lines are folded at **75 octets** (UTF-8 bytes), not 75 characters. This is significant for non-ASCII content: a line of 25 three-byte characters (e.g. CJK) reaches the limit even though it is only 25 characters long.

The fold indicator (a single space on the continuation line) is stripped during unfolding. To preserve a word boundary across a fold, include the space as the last character of the preceding segment:

```
FN:A very long name that spans \r\n
 multiple lines\r\n
```

After unfolding: `A very long name that spans multiple lines`.

### Text escaping (RFC 6350 §3.4)

In `TEXT` value types, the following characters are escaped on output and unescaped on input:

| Sequence | Meaning |
|----------|---------|
| `\\`     | Literal backslash |
| `\n` or `\N` | Newline (U+000A) |
| `\,`     | Literal comma |
| `\;`     | Literal semicolon |

Note that colons do **not** need escaping in property values (the parser finds the first colon to split name from value).

### Multi-valued parameters

The `TYPE` parameter may be specified in two equivalent ways, both of which are handled:

```
TEL;TYPE=work;TYPE=voice:...
TEL;TYPE="work,voice":...
TEL;TYPE=WORK,VOICE:...    (v3 style — tolerated)
```

All three produce `prop.type === ['work', 'voice']`.

### vCard 3.0 and 2.1 compatibility

The parser accepts v3.0 and v2.1 input:

- `ENCODING=QUOTED-PRINTABLE` values are decoded (with correct multi-byte UTF-8 support).
- `ENCODING=b` (base64) is stripped; the value is stored as-is.
- `CHARSET` parameters are accepted and ignored (the library assumes UTF-8 throughout).
- The `LABEL` property (removed in v4) is stored as an `UnknownProperty`.
- Bare type tokens without `=` (`TEL;WORK;VOICE:...`) are interpreted as `TYPE` values.

### Property groups (Apple Contacts)

Apple Contacts uses a grouping mechanism to associate related properties:

```
item1.EMAIL;type=INTERNET:john@example.com
item1.X-ABLabel:Work
```

The `group` field on the property is set to `'item1'`. Grouped properties are preserved on round-trip.

---

## Types reference

```ts
// Value types
type ValueType = 'text' | 'uri' | 'date' | 'time' | 'date-time' |
                 'date-and-or-time' | 'timestamp' | 'boolean' |
                 'integer' | 'float' | 'utc-offset' | 'language-tag';

type TypeValue  = 'work' | 'home' | 'voice' | 'fax' | 'cell' | 'video' |
                  'pager' | 'textphone' | 'text' | 'contact' | 'friend' |
                  'spouse' | 'child' | 'parent' | /* ... */ | string;

type KindValue  = 'individual' | 'group' | 'org' | 'location' | string;
type GenderSex  = 'M' | 'F' | 'O' | 'N' | 'U' | '';

// Structured values
interface StructuredName  { familyNames, givenNames, additionalNames,
                            honorificPrefixes, honorificSuffixes }
interface Address         { postOfficeBox, extendedAddress, streetAddress,
                            locality, region, postalCode, countryName }
interface Organization    { name, units }
interface Gender          { sex, identity? }
interface ClientPidMap    { pid, uri }
interface DateAndOrTime   { year?, month?, day?, hour?, minute?, second?,
                            utcOffset?, hasTime }

// Parameter map
type ParameterMap = Map<string, string | string[]>;
```

---

## License

MIT
