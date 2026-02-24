/**
 * Tests for @pipobscure/vcard
 * Uses Node.js built-in test runner.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  VCard,
  VCardError,
  FNProperty,
  NProperty,
  EmailProperty,
  TelProperty,
  AdrProperty,
  OrgProperty,
  BDayProperty,
  GenderProperty,
  GeoProperty,
  NicknameProperty,
  CategoriesProperty,
  RevProperty,
  UIDProperty,
  parse,
  parseOne,
  stringify,
  parseDateAndOrTime,
  formatDateAndOrTime,
  foldLine,
  unfoldLines,
} from '../index.js';

// ── Helper ─────────────────────────────────────────────────────────────────

/** Sample vCard v4 text for testing */
const SAMPLE_V4 = [
  'BEGIN:VCARD',
  'VERSION:4.0',
  'FN:Alice Example',
  'N:Example;Alice;Marie;;Dr.',
  'EMAIL;TYPE=work:alice@example.com',
  'EMAIL;TYPE=home;PREF=1:alice@personal.net',
  'TEL;VALUE=uri;TYPE=cell:tel:+1-555-123-4567',
  'ADR;TYPE=work:;;123 Main St;Springfield;IL;62701;USA',
  'ORG:Example Corp;Engineering',
  'TITLE:Software Engineer',
  'BDAY:19900315',
  'GENDER:F',
  'NICKNAME:Ali,Ally',
  'CATEGORIES:friend,colleague',
  'UID:urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
  'NOTE:This is a test\\nWith a newline',
  'REV:20240101T120000Z',
  'END:VCARD',
].join('\r\n');

/** Sample v3 vCard for tolerance testing */
const SAMPLE_V3 = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'FN:Bob Smith',
  'N:Smith;Bob;;;',
  'EMAIL;TYPE=INTERNET:bob@example.org',
  'TEL;TYPE=CELL:+44 7700 900000',
  'ADR;TYPE=HOME:;;456 Oak Ave;Portland;OR;97201;USA',
  'ORG:Acme Inc.',
  'END:VCARD',
].join('\r\n');

// ── Line folding ──────────────────────────────────────────────────────────

describe('Line folding', () => {
  test('short lines pass through unchanged', () => {
    const line = 'FN:Alice';
    assert.equal(foldLine(line), 'FN:Alice\r\n');
  });

  test('long lines are folded at 75 octets', () => {
    const long = 'NOTE:' + 'A'.repeat(80);
    const folded = foldLine(long);
    for (const l of folded.split('\r\n').filter(Boolean)) {
      assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `Line too long: "${l}"`);
    }
  });

  test('folded lines are unfolded correctly', () => {
    const long = 'NOTE:' + 'A'.repeat(80);
    const folded = foldLine(long);
    const unfolded = unfoldLines(folded);
    assert.equal(unfolded[0], long);
  });

  test('unicode is counted in bytes, not chars', () => {
    // Each emoji is 4 bytes — 18 emojis = 72 bytes + 'FN:' (3) = 75
    const line = 'FN:' + '😀'.repeat(18); // 3 + 72 = 75 bytes exactly
    const folded = foldLine(line);
    // Should not be split (exactly 75 bytes)
    assert.equal(folded, line + '\r\n');
  });
});

// ── Parsing ────────────────────────────────────────────────────────────────

describe('Parsing', () => {
  test('parse() returns an array of VCards', () => {
    const vcards = parse(SAMPLE_V4);
    assert.equal(vcards.length, 1);
  });

  test('FN is parsed correctly', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    assert.equal(vc.fn.length, 1);
    assert.equal(vc.fn[0]?.value, 'Alice Example');
    assert.equal(vc.displayName, 'Alice Example');
  });

  test('N (structured name) is parsed correctly', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc?.n);
    assert.deepEqual(vc.n.value.familyNames, ['Example']);
    assert.deepEqual(vc.n.value.givenNames, ['Alice']);
    assert.deepEqual(vc.n.value.additionalNames, ['Marie']);
    assert.deepEqual(vc.n.value.honorificSuffixes, ['Dr.']);
  });

  test('EMAIL properties are parsed with types', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    assert.equal(vc.email.length, 2);
    const workEmail = vc.email.find(e => e.type.includes('work'));
    assert.ok(workEmail);
    assert.equal(workEmail.value, 'alice@example.com');
  });

  test('primaryEmail returns most preferred email', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    // PREF=1 on home email → it's most preferred
    assert.equal(vc.primaryEmail, 'alice@personal.net');
  });

  test('TEL is parsed', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    assert.equal(vc.tel.length, 1);
    assert.equal(vc.tel[0]?.value, 'tel:+1-555-123-4567');
  });

  test('ADR is parsed as structured address', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    assert.equal(vc.adr.length, 1);
    assert.equal(vc.adr[0]?.value.streetAddress, '123 Main St');
    assert.equal(vc.adr[0]?.value.locality, 'Springfield');
    assert.equal(vc.adr[0]?.value.postalCode, '62701');
    assert.equal(vc.adr[0]?.value.countryName, 'USA');
  });

  test('ORG is parsed with units', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    assert.equal(vc.org[0]?.value.name, 'Example Corp');
    assert.deepEqual(vc.org[0]?.value.units, ['Engineering']);
  });

  test('BDAY is parsed as DateAndOrTime', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc?.bday?.dateValue);
    assert.equal(vc.bday.dateValue.year, 1990);
    assert.equal(vc.bday.dateValue.month, 3);
    assert.equal(vc.bday.dateValue.day, 15);
  });

  test('GENDER is parsed', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc?.gender);
    assert.equal(vc.gender.value.sex, 'F');
  });

  test('NICKNAME is parsed as list', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    assert.equal(vc.nickname.length, 1);
    assert.deepEqual(vc.nickname[0]?.values, ['Ali', 'Ally']);
  });

  test('CATEGORIES is parsed as list', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    const cats = vc.categories.flatMap(c => c.values);
    assert.ok(cats.includes('friend'));
    assert.ok(cats.includes('colleague'));
  });

  test('NOTE with escaped newline is unescaped', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    assert.equal(vc.note[0]?.value, 'This is a test\nWith a newline');
  });

  test('UID is parsed', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc?.uid);
    assert.ok(vc.uid.value.includes('f81d4fae'));
  });

  test('REV is parsed as Date', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc?.rev);
    assert.ok(vc.rev.value instanceof Date);
    assert.equal((vc.rev.value as Date).getUTCFullYear(), 2024);
  });

  test('v3 vCard is parsed tolerantly', () => {
    const vcards = parse(SAMPLE_V3);
    assert.equal(vcards.length, 1);
    const [vc] = vcards;
    assert.ok(vc);
    assert.equal(vc.fn[0]?.value, 'Bob Smith');
    assert.equal(vc.parsedVersion, '3.0');
    assert.equal(vc.email[0]?.value, 'bob@example.org');
  });

  test('multiple vCards in one string', () => {
    const multi = SAMPLE_V4 + '\r\n' + SAMPLE_V3;
    const vcards = parse(multi);
    assert.equal(vcards.length, 2);
  });

  test('LF-only line endings are accepted', () => {
    const lfOnly = SAMPLE_V4.replace(/\r\n/g, '\n');
    const vcards = parse(lfOnly);
    assert.equal(vcards.length, 1);
    assert.equal(vcards[0]?.displayName, 'Alice Example');
  });

  test('folded lines are unfolded during parsing', () => {
    // Per RFC 6350 §3.2: CRLF + single whitespace is removed (the fold indicator).
    // To preserve a word break across a fold, the space must be at end of the first segment.
    // Per RFC 6350 §3.2: continuation lines begin with a single whitespace (the fold indicator).
    // That whitespace is removed during unfolding. The trailing space on the first segment
    // is preserved content, maintaining the word break.
    const folded = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:This is a very long formatted name that will span ',
      ' multiple folded lines for testing purposes',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(folded);
    assert.ok(vc);
    assert.equal(
      vc.fn[0]?.value,
      'This is a very long formatted name that will span multiple folded lines for testing purposes',
    );
  });

  test('empty input returns empty array', () => {
    assert.deepEqual(parse(''), []);
    assert.deepEqual(parse('   \r\n  '), []);
  });

  test('parseOne() throws on empty input', () => {
    assert.throws(() => parseOne(''), /No vCard found/);
  });
});

// ── Generation ─────────────────────────────────────────────────────────────

describe('Generation', () => {
  test('generated output starts with BEGIN:VCARD', () => {
    const vc = VCard.create('Test User');
    const out = vc.toString();
    assert.ok(out.startsWith('BEGIN:VCARD\r\n'));
  });

  test('generated output ends with END:VCARD', () => {
    const vc = VCard.create('Test User');
    const out = vc.toString();
    assert.ok(out.trimEnd().endsWith('END:VCARD'));
  });

  test('generated output contains VERSION:4.0', () => {
    const vc = VCard.create('Test User');
    assert.ok(vc.toString().includes('VERSION:4.0\r\n'));
  });

  test('generated output uses CRLF line endings', () => {
    const vc = VCard.create('Test User');
    const out = vc.toString();
    // Every \n should be preceded by \r
    const lines = out.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      assert.ok(lines[i]!.endsWith('\r'), `Line ${i} missing \\r`);
    }
  });

  test('throws VCardError when FN is missing', () => {
    const vc = new VCard();
    assert.throws(() => vc.toString(), VCardError);
  });

  test('round-trip preserves FN', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    const out = vc.toString();
    const [vc2] = parse(out);
    assert.ok(vc2);
    assert.equal(vc2.displayName, vc.displayName);
  });

  test('round-trip preserves EMAIL', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    const out = vc.toString();
    const [vc2] = parse(out);
    assert.ok(vc2);
    assert.equal(vc2.email.length, vc.email.length);
    assert.equal(vc2.primaryEmail, vc.primaryEmail);
  });

  test('round-trip preserves structured name', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc?.n);
    const out = vc.toString();
    const [vc2] = parse(out);
    assert.ok(vc2?.n);
    assert.deepEqual(vc2.n.value, vc.n.value);
  });

  test('round-trip preserves ADR', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    const out = vc.toString();
    const [vc2] = parse(out);
    assert.ok(vc2);
    assert.equal(vc2.adr[0]?.value.streetAddress, '123 Main St');
    assert.equal(vc2.adr[0]?.value.locality, 'Springfield');
  });

  test('round-trip preserves NOTE with embedded newline', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    const out = vc.toString();
    const [vc2] = parse(out);
    assert.ok(vc2);
    assert.equal(vc2.note[0]?.value, 'This is a test\nWith a newline');
  });

  test('stringify() works with single VCard', () => {
    const vc = VCard.create('Test');
    const out = stringify(vc);
    assert.ok(out.includes('FN:Test'));
  });

  test('stringify() works with array of VCards', () => {
    const vc1 = VCard.create('Alice');
    const vc2 = VCard.create('Bob');
    const out = stringify([vc1, vc2]);
    assert.ok(out.includes('FN:Alice'));
    assert.ok(out.includes('FN:Bob'));
    assert.equal((out.match(/BEGIN:VCARD/g) ?? []).length, 2);
  });

  test('PREF parameter is validated', () => {
    const vc = new VCard();
    const fn = new FNProperty('Test');
    fn.pref = 0; // invalid: must be 1-100
    vc.fn.push(fn);
    assert.throws(() => vc.toString(), VCardError);
  });

  test('PREF=1 is valid', () => {
    const vc = new VCard();
    const fn = new FNProperty('Test');
    fn.pref = 1;
    vc.fn.push(fn);
    assert.doesNotThrow(() => vc.toString());
  });
});

// ── Programmatic construction ─────────────────────────────────────────────

describe('Programmatic construction', () => {
  test('VCard.create() produces a valid vCard', () => {
    const vc = VCard.create('Jane Doe');
    assert.equal(vc.displayName, 'Jane Doe');
    const result = vc.validate();
    assert.ok(result.valid);
  });

  test('adding email and tel works', () => {
    const vc = VCard.create('Jane Doe');
    vc.email.push(new EmailProperty('jane@example.com'));
    vc.tel.push(new TelProperty('tel:+1-555-987-6543'));

    const out = vc.toString();
    const [parsed] = parse(out);
    assert.ok(parsed);
    assert.equal(parsed.email[0]?.value, 'jane@example.com');
  });

  test('structured name can be set', () => {
    const vc = VCard.create('John Smith');
    vc.n = new NProperty({
      familyNames: ['Smith'],
      givenNames: ['John'],
      additionalNames: [],
      honorificPrefixes: ['Mr.'],
      honorificSuffixes: [],
    });

    const out = vc.toString();
    const [parsed] = parse(out);
    assert.ok(parsed?.n);
    assert.deepEqual(parsed.n.value.familyNames, ['Smith']);
    assert.deepEqual(parsed.n.value.honorificPrefixes, ['Mr.']);
  });

  test('gender can be set with identity text', () => {
    const vc = VCard.create('Alex');
    vc.gender = new GenderProperty({ sex: 'O', identity: 'non-binary' });
    const out = vc.toString();
    const [parsed] = parse(out);
    assert.ok(parsed?.gender);
    assert.equal(parsed.gender.value.sex, 'O');
    assert.equal(parsed.gender.value.identity, 'non-binary');
  });

  test('address with type can be set', () => {
    const vc = VCard.create('Test');
    const adr = new AdrProperty({
      postOfficeBox: '',
      extendedAddress: '',
      streetAddress: '42 Answer Ave',
      locality: 'Deep Thought',
      region: 'CA',
      postalCode: '42000',
      countryName: 'USA',
    });
    adr.type = ['home'];
    vc.adr.push(adr);

    const out = vc.toString();
    const [parsed] = parse(out);
    assert.ok(parsed);
    assert.equal(parsed.adr[0]?.value.streetAddress, '42 Answer Ave');
    assert.ok(parsed.adr[0]?.type.includes('home'));
  });

  test('GeoProperty.fromCoordinates builds correct URI', () => {
    const geo = GeoProperty.fromCoordinates(37.386013, -122.082932);
    assert.ok(geo.uri.startsWith('geo:'));
    const coords = geo.coordinates;
    assert.ok(coords);
    assert.ok(Math.abs(coords.latitude - 37.386013) < 0.0001);
  });

  test('org with multiple units round-trips', () => {
    const vc = VCard.create('Corp Contact');
    vc.org.push(new OrgProperty({ name: 'Acme', units: ['Division A', 'Team B'] }));
    const out = vc.toString();
    const [parsed] = parse(out);
    assert.ok(parsed);
    assert.equal(parsed.org[0]?.value.name, 'Acme');
    assert.deepEqual(parsed.org[0]?.value.units, ['Division A', 'Team B']);
  });
});

// ── Date/time parsing ─────────────────────────────────────────────────────

describe('Date and time parsing', () => {
  test('full date YYYYMMDD', () => {
    const dt = parseDateAndOrTime('19901231');
    assert.ok(dt);
    assert.equal(dt.year, 1990);
    assert.equal(dt.month, 12);
    assert.equal(dt.day, 31);
    assert.equal(dt.hasTime, false);
  });

  test('date-only --MMDD (no year)', () => {
    const dt = parseDateAndOrTime('--0315');
    assert.ok(dt);
    assert.equal(dt.year, undefined);
    assert.equal(dt.month, 3);
    assert.equal(dt.day, 15);
  });

  test('date-time YYYYMMDDTHHMMSSZ', () => {
    const dt = parseDateAndOrTime('20240101T120000Z');
    assert.ok(dt);
    assert.equal(dt.year, 2024);
    assert.equal(dt.month, 1);
    assert.equal(dt.day, 1);
    assert.equal(dt.hasTime, true);
    assert.equal(dt.hour, 12);
    assert.equal(dt.minute, 0);
    assert.equal(dt.utcOffset, 'Z');
  });

  test('date-time with UTC offset', () => {
    const dt = parseDateAndOrTime('20240601T083000+0500');
    assert.ok(dt);
    assert.equal(dt.hour, 8);
    assert.equal(dt.minute, 30);
    assert.equal(dt.utcOffset, '+0500');
  });

  test('format round-trips correctly', () => {
    const original = '19900315';
    const dt = parseDateAndOrTime(original);
    assert.ok(dt);
    const formatted = formatDateAndOrTime(dt);
    assert.equal(formatted, original);
  });

  test('REV round-trips as timestamp', () => {
    const vc = VCard.create('Rev Test');
    vc.rev = new RevProperty(new Date('2024-06-15T10:30:00Z'));
    const out = vc.toString();
    const [parsed] = parse(out);
    assert.ok(parsed?.rev);
    assert.ok(parsed.rev.value instanceof Date);
    assert.equal((parsed.rev.value as Date).getUTCFullYear(), 2024);
    assert.equal((parsed.rev.value as Date).getUTCMonth(), 5); // June = 5
  });
});

// ── Escape handling ────────────────────────────────────────────────────────

describe('Escaping', () => {
  test('semicolons in text values are escaped', () => {
    const vc = VCard.create('A;B');
    const out = vc.toString();
    assert.ok(out.includes('FN:A\\;B'), `Expected escaped semicolon, got: ${out}`);
  });

  test('commas in text values are escaped', () => {
    const vc = VCard.create('Smith, John');
    const out = vc.toString();
    assert.ok(out.includes('FN:Smith\\, John'), `Expected escaped comma, got: ${out}`);
  });

  test('backslashes in text values are escaped', () => {
    const vc = VCard.create('C:\\Users\\Test');
    const out = vc.toString();
    assert.ok(out.includes('FN:C:\\\\Users\\\\Test'), `Expected escaped backslashes`);
  });

  test('special chars in ORG name are escaped and unescaped', () => {
    const vc = VCard.create('Test');
    vc.org.push(new OrgProperty({ name: 'Smith & Co; Consultants', units: [] }));
    const out = vc.toString();
    const [parsed] = parse(out);
    assert.ok(parsed);
    assert.equal(parsed.org[0]?.value.name, 'Smith & Co; Consultants');
  });
});

// ── Validation ─────────────────────────────────────────────────────────────

describe('Validation', () => {
  test('validate() passes for a complete vCard', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    const result = vc.validate();
    assert.ok(result.valid, JSON.stringify(result.errors));
  });

  test('validate() fails when FN is missing', () => {
    const vc = new VCard();
    const result = vc.validate();
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.property === 'FN'));
  });

  test('toStringLenient() works without FN', () => {
    const vc = new VCard();
    // Should not throw even without FN
    assert.doesNotThrow(() => vc.toStringLenient());
  });
});

// ── JSON serialization ────────────────────────────────────────────────────

describe('JSON serialization', () => {
  test('toJSON() returns expected shape', () => {
    const [vc] = parse(SAMPLE_V4);
    assert.ok(vc);
    const json = vc.toJSON();
    assert.deepEqual(json.fn, ['Alice Example']);
    assert.ok(Array.isArray(json.email));
  });
});
