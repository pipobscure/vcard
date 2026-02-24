/**
 * Edge case tests for @pipobscure/vcard
 * Based on real-world vCard examples from:
 *   - RFC 6350 / RFC 7095 appendix examples
 *   - Apple Contacts exports
 *   - Outlook, Google, iOS known quirks
 *   - Documented parser bugs and interop failures
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  VCard,
  parse,
  parseOne,
  FNProperty,
  NProperty,
  AdrProperty,
  GenderProperty,
  TZProperty,
  GeoProperty,
  NoteProperty,
  PhotoProperty,
} from '../index.js';

// ── RFC 7095 appendix example (full-featured v4) ──────────────────────────

describe('RFC 7095 Simon Perreault example', () => {
  // This is the canonical example from RFC 7095 (jCard spec),
  // which contains most v4 features in one card.
  const SIMON = [
    'BEGIN:VCARD',
    'VERSION:4.0',
    'FN:Simon Perreault',
    'N:Perreault;Simon;;;ing. jr,M.Sc.',
    'BDAY:--0203',
    'ANNIVERSARY:20090808T1430-0500',
    'GENDER:M',
    'LANG;PREF=1:fr',
    'LANG;PREF=2:en',
    'ORG;TYPE=work:Viagenie',
    'ADR;TYPE=work:;Suite D2-630;2875 Laurier;Quebec;QC;G1V 2M2;Canada',
    'TEL;VALUE=uri;TYPE="work,voice";PREF=1:tel:+1-418-656-9254;ext=102',
    'TEL;VALUE=uri;TYPE="work,voice";PREF=2:tel:+1-418-262-6501',
    'EMAIL;TYPE=work:simon.perreault@viagenie.ca',
    'GEO;TYPE=work:geo:46.772673,-71.282945',
    'KEY;TYPE=work;VALUE=uri:http://www.viagenie.ca/simon.perreault/simon.asc',
    'TZ:-0500',
    'URL;TYPE=home:http://nomis80.org',
    'END:VCARD',
  ].join('\r\n');

  test('parses without errors', () => {
    const [vc] = parse(SIMON);
    assert.ok(vc);
    assert.equal(vc.parseWarnings.filter(w => w.message.includes('error')).length, 0);
  });

  test('FN is correct', () => {
    const [vc] = parse(SIMON);
    assert.equal(vc?.displayName, 'Simon Perreault');
  });

  test('N with multiple suffixes (comma-list)', () => {
    const [vc] = parse(SIMON);
    assert.ok(vc?.n);
    assert.deepEqual(vc.n.value.familyNames, ['Perreault']);
    assert.deepEqual(vc.n.value.givenNames, ['Simon']);
    // honorific suffixes: "ing. jr,M.Sc." → two suffixes
    assert.deepEqual(vc.n.value.honorificSuffixes, ['ing. jr', 'M.Sc.']);
  });

  test('BDAY with --MMDD format (no year)', () => {
    const [vc] = parse(SIMON);
    assert.ok(vc?.bday?.dateValue);
    assert.equal(vc.bday.dateValue.year, undefined);
    assert.equal(vc.bday.dateValue.month, 2);
    assert.equal(vc.bday.dateValue.day, 3);
  });

  test('ANNIVERSARY with date-time and offset', () => {
    const [vc] = parse(SIMON);
    assert.ok(vc?.anniversary?.dateValue);
    assert.equal(vc.anniversary.dateValue.year, 2009);
    assert.equal(vc.anniversary.dateValue.month, 8);
    assert.equal(vc.anniversary.dateValue.day, 8);
    assert.ok(vc.anniversary.dateValue.hasTime);
    assert.equal(vc.anniversary.dateValue.hour, 14);
    assert.equal(vc.anniversary.dateValue.minute, 30);
    assert.ok(vc.anniversary.dateValue.utcOffset?.includes('0500'));
  });

  test('LANG properties with PREF', () => {
    const [vc] = parse(SIMON);
    assert.equal(vc?.lang.length, 2);
    const fr = vc?.lang.find(l => l.value === 'fr');
    assert.ok(fr);
    assert.equal(fr.pref, 1);
  });

  test('TEL with quoted TYPE containing comma (TYPE="work,voice")', () => {
    const [vc] = parse(SIMON);
    assert.ok(vc);
    assert.equal(vc.tel.length, 2);
    // TYPE="work,voice" should parse as two types
    const t = vc.tel[0]!;
    assert.ok(t.type.includes('work'), `Expected work in types: ${JSON.stringify(t.type)}`);
    assert.ok(t.type.includes('voice'), `Expected voice in types: ${JSON.stringify(t.type)}`);
  });

  test('TEL is a URI value', () => {
    const [vc] = parse(SIMON);
    assert.ok(vc);
    assert.ok(vc.tel[0]?.value.startsWith('tel:'));
    assert.ok(vc.tel[0]?.isUri);
  });

  test('GEO URI round-trips', () => {
    const [vc] = parse(SIMON);
    assert.ok(vc);
    assert.equal(vc.geo.length, 1);
    const coords = vc.geo[0]?.coordinates;
    assert.ok(coords);
    assert.ok(Math.abs(coords.latitude - 46.772673) < 0.0001);
    assert.ok(Math.abs(coords.longitude - (-71.282945)) < 0.0001);
  });

  test('TZ as UTC offset', () => {
    const [vc] = parse(SIMON);
    assert.ok(vc);
    assert.equal(vc.tz.length, 1);
    assert.equal(vc.tz[0]?.valueKind, 'utc-offset');
    assert.equal(vc.tz[0]?.value, '-0500');
  });

  test('ADR with empty first two components', () => {
    const [vc] = parse(SIMON);
    assert.ok(vc);
    assert.equal(vc.adr[0]?.value.postOfficeBox, '');
    assert.equal(vc.adr[0]?.value.extendedAddress, 'Suite D2-630');
    assert.equal(vc.adr[0]?.value.streetAddress, '2875 Laurier');
    assert.equal(vc.adr[0]?.value.locality, 'Quebec');
    assert.equal(vc.adr[0]?.value.region, 'QC');
    assert.equal(vc.adr[0]?.value.postalCode, 'G1V 2M2');
    assert.equal(vc.adr[0]?.value.countryName, 'Canada');
  });

  test('round-trips faithfully', () => {
    const [vc] = parse(SIMON);
    assert.ok(vc);
    const out = vc.toString();
    const [vc2] = parse(out);
    assert.ok(vc2);
    assert.equal(vc2.displayName, vc.displayName);
    assert.equal(vc2.tel.length, vc.tel.length);
    assert.equal(vc2.email[0]?.value, vc.email[0]?.value);
    assert.deepEqual(vc2.n?.value.honorificSuffixes, vc.n?.value.honorificSuffixes);
  });
});

// ── vCard 3.0 with base64 PHOTO ───────────────────────────────────────────

describe('vCard 3.0 - Forrest Gump (base64, v3 TYPE multi-value, LABEL)', () => {
  const FORREST = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Gump;Forrest;;Mr.;',
    'FN:Forrest Gump',
    'ORG:Bubba Gump Shrimp Co.',
    'TITLE:Shrimp Man',
    'PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQSkZJRgABAQ==',
    'TEL;TYPE=WORK,VOICE:(111) 555-1212',
    'TEL;TYPE=HOME,VOICE:(404) 555-1212',
    'ADR;TYPE=WORK:;;100 Waters Edge;Baytown;LA;30314;United States of America',
    'LABEL;TYPE=WORK:100 Waters Edge\\nBaytown\\, LA 30314\\nUnited States of America',
    'EMAIL;TYPE=PREF,INTERNET:forrestgump@example.com',
    'REV:2008-04-24T19:52:43Z',
    'END:VCARD',
  ].join('\r\n');

  test('parses v3 without throwing', () => {
    const vcards = parse(FORREST);
    assert.equal(vcards.length, 1);
    assert.equal(vcards[0]?.parsedVersion, '3.0');
  });

  test('FN and N are parsed', () => {
    const [vc] = parse(FORREST);
    assert.equal(vc?.displayName, 'Forrest Gump');
    assert.equal(vc?.n?.value.familyNames[0], 'Gump');
    assert.equal(vc?.n?.value.givenNames[0], 'Forrest');
    assert.deepEqual(vc?.n?.value.honorificPrefixes, ['Mr.']);
  });

  test('TEL with comma-separated TYPE values', () => {
    const [vc] = parse(FORREST);
    assert.ok(vc);
    assert.equal(vc.tel.length, 2);
    // TYPE=WORK,VOICE → types: ['work', 'voice']
    const workTel = vc.tel.find(t => t.type.includes('work'));
    assert.ok(workTel);
    assert.ok(workTel.type.includes('voice'));
    assert.equal(workTel.value, '(111) 555-1212');
  });

  test('PHOTO with ENCODING=b is stored verbatim', () => {
    const [vc] = parse(FORREST);
    assert.ok(vc);
    assert.equal(vc.photo.length, 1);
    // The ENCODING=b flag in v3 — data is stored as-is (already base64)
    assert.ok((vc.photo[0]?.value.length ?? 0) > 0);
  });

  test('REV with extended ISO format is parsed as Date', () => {
    const [vc] = parse(FORREST);
    assert.ok(vc?.rev);
    assert.ok(vc.rev.value instanceof Date);
    assert.equal((vc.rev.value as Date).getUTCFullYear(), 2008);
    assert.equal((vc.rev.value as Date).getUTCMonth(), 3); // April = 3
  });

  test('LABEL stored as unknown property (v3 only)', () => {
    const [vc] = parse(FORREST);
    assert.ok(vc);
    const label = vc.extended.find(p => p.name === 'LABEL');
    assert.ok(label, 'LABEL should be in extended properties');
  });

  test('ADR with all components', () => {
    const [vc] = parse(FORREST);
    assert.ok(vc);
    assert.equal(vc.adr[0]?.value.streetAddress, '100 Waters Edge');
    assert.equal(vc.adr[0]?.value.locality, 'Baytown');
    assert.equal(vc.adr[0]?.value.region, 'LA');
    assert.equal(vc.adr[0]?.value.postalCode, '30314');
    assert.equal(vc.adr[0]?.value.countryName, 'United States of America');
  });
});

// ── Apple Contacts item-groups ─────────────────────────────────────────────

describe('Apple Contacts - item groups and X- extensions', () => {
  const APPLE = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Public;John;Quinlan;Mr.;Esq.',
    'FN:Mr. John Quinlan Public\\, Esq.',
    'ORG:ABC\\, Inc.',
    'TITLE:Software Architect',
    'item1.EMAIL;type=INTERNET:john@example.com',
    'item1.X-ABLabel:Work',
    'item2.EMAIL;type=INTERNET:jpublic@personal.com',
    'item2.X-ABLabel:Personal',
    'item3.TEL;type=VOICE:+1-555-555-5555',
    'item3.X-ABLabel:_$!<Mobile>!$_',
    'item4.TEL;type=VOICE:+1-555-555-5556',
    'item4.X-ABLabel:_$!<Main>!$_',
    'item5.URL;type=WORK:http://www.example.com',
    'item5.X-ABLabel:_$!<HomePage>!$_',
    'X-ABUID:12345678-1234-1234-1234-123456789012:ABPerson',
    'END:VCARD',
  ].join('\r\n');

  test('parses without error', () => {
    const vcards = parse(APPLE);
    assert.equal(vcards.length, 1);
  });

  test('FN with escaped comma round-trips', () => {
    const [vc] = parse(APPLE);
    assert.ok(vc);
    assert.equal(vc.displayName, 'Mr. John Quinlan Public, Esq.');
  });

  test('ORG with escaped comma', () => {
    const [vc] = parse(APPLE);
    assert.ok(vc);
    assert.equal(vc.org[0]?.value.name, 'ABC, Inc.');
  });

  test('grouped EMAIL properties preserve group name', () => {
    const [vc] = parse(APPLE);
    assert.ok(vc);
    assert.equal(vc.email.length, 2);
    assert.equal(vc.email[0]?.group, 'item1');
    assert.equal(vc.email[1]?.group, 'item2');
  });

  test('grouped TEL properties preserve group name', () => {
    const [vc] = parse(APPLE);
    assert.ok(vc);
    assert.equal(vc.tel.length, 2);
    assert.equal(vc.tel[0]?.group, 'item3');
    assert.equal(vc.tel[1]?.group, 'item4');
  });

  test('X-ABLabel stored in extended properties', () => {
    const [vc] = parse(APPLE);
    assert.ok(vc);
    const labels = vc.extended.filter(p => p.name === 'X-ABLABEL');
    assert.equal(labels.length, 5);
    assert.equal(labels[0]?.group, 'item1');
    assert.equal(labels[0]?.rawValue, 'Work');
    // Apple's special label tokens
    assert.ok(labels[2]?.rawValue.includes('Mobile'));
  });

  test('X-ABUID stored in extended properties', () => {
    const [vc] = parse(APPLE);
    assert.ok(vc);
    const abuid = vc.extended.find(p => p.name === 'X-ABUID');
    assert.ok(abuid);
    assert.ok(abuid.rawValue.includes('12345678'));
  });

  test('URL with group is parsed', () => {
    const [vc] = parse(APPLE);
    assert.ok(vc);
    assert.equal(vc.url.length, 1);
    assert.equal(vc.url[0]?.group, 'item5');
    assert.equal(vc.url[0]?.value, 'http://www.example.com');
  });
});

// ── Multilingual vCard with Unicode ───────────────────────────────────────

describe('Multilingual vCard with ALTID and Unicode', () => {
  const JP = [
    'BEGIN:VCARD',
    'VERSION:4.0',
    'FN;ALTID=1;LANGUAGE=ja:山田太郎',
    'FN;ALTID=1;LANGUAGE=en:Yamada Taro',
    'N;ALTID=1;LANGUAGE=ja:山田;太郎;;;',
    'N;ALTID=1;LANGUAGE=en:Yamada;Taro;;;',
    'ORG;LANGUAGE=ja:株式会社ABC',
    'ORG;LANGUAGE=en:ABC Corporation',
    'END:VCARD',
  ].join('\r\n');

  test('parses Unicode characters correctly', () => {
    const [vc] = parse(JP);
    assert.ok(vc);
    assert.equal(vc.fn.length, 2);
    const jaFN = vc.fn.find(f => f.language === 'ja');
    assert.ok(jaFN);
    assert.equal(jaFN.value, '山田太郎');
  });

  test('ALTID groups are preserved', () => {
    const [vc] = parse(JP);
    assert.ok(vc);
    assert.equal(vc.fn[0]?.altid, '1');
    assert.equal(vc.fn[1]?.altid, '1');
  });

  test('English version accessible via LANGUAGE param', () => {
    const [vc] = parse(JP);
    assert.ok(vc);
    const enFN = vc.fn.find(f => f.language === 'en');
    assert.equal(enFN?.value, 'Yamada Taro');
  });

  test('Japanese N components are correct', () => {
    const [vc] = parse(JP);
    assert.ok(vc);
    // When multiple N are present, the last one wins (v4 cardinality *1)
    // Both should parse to Japanese or English family/given
    assert.ok(vc.n);
  });

  test('round-trips Unicode without corruption', () => {
    const [vc] = parse(JP);
    assert.ok(vc);
    const out = vc.toString();
    const [vc2] = parse(out);
    assert.ok(vc2);
    const jaFN = vc2.fn.find(f => f.language === 'ja');
    assert.equal(jaFN?.value, '山田太郎');
  });

  test('generated output has correct byte-level line folding for Unicode', () => {
    const [vc] = parse(JP);
    assert.ok(vc);
    const out = vc.toString();
    for (const line of out.split('\r\n').filter(Boolean)) {
      assert.ok(
        Buffer.byteLength(line, 'utf8') <= 75,
        `Line exceeds 75 octets: "${line}" (${Buffer.byteLength(line, 'utf8')} bytes)`,
      );
    }
  });
});

// ── vCard 2.1 QUOTED-PRINTABLE ────────────────────────────────────────────

describe('vCard 2.1 QUOTED-PRINTABLE tolerance', () => {
  const QP = [
    'BEGIN:VCARD',
    'VERSION:2.1',
    'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:M=C3=BCller;Fr=C3=A4nk;;;',
    'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Fr=C3=A4nk M=C3=BCller',
    'TEL;WORK:+49-69-1234567',
    'END:VCARD',
  ].join('\r\n');

  test('parses without throwing', () => {
    const vcards = parse(QP);
    assert.equal(vcards.length, 1);
    assert.equal(vcards[0]?.parsedVersion, '2.1');
  });

  test('QUOTED-PRINTABLE decoded: ä (=C3=A4) and ü (=C3=BC)', () => {
    const [vc] = parse(QP);
    assert.ok(vc);
    // Fr=C3=A4nk = Fränk, M=C3=BCller = Müller
    assert.equal(vc.displayName, 'Fränk Müller');
  });

  test('N structured name decoded correctly', () => {
    const [vc] = parse(QP);
    assert.ok(vc?.n);
    assert.equal(vc.n.value.familyNames[0], 'Müller');
    assert.equal(vc.n.value.givenNames[0], 'Fränk');
  });

  test('TEL without VALUE=uri is stored as text', () => {
    const [vc] = parse(QP);
    assert.ok(vc);
    assert.equal(vc.tel.length, 1);
    assert.equal(vc.tel[0]?.value, '+49-69-1234567');
  });
});

// ── KIND:group with MEMBER ────────────────────────────────────────────────

describe('KIND:group with MEMBER URIs', () => {
  const GROUP = [
    'BEGIN:VCARD',
    'VERSION:4.0',
    'KIND:group',
    'FN:The Doe family',
    'MEMBER:urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af',
    'MEMBER:urn:uuid:b8767877-b4a1-4c70-9acc-505d3819e519',
    'MEMBER:mailto:sister@example.com',
    'END:VCARD',
  ].join('\r\n');

  test('parses KIND:group', () => {
    const [vc] = parse(GROUP);
    assert.ok(vc?.kind);
    assert.equal(vc.kind.value, 'group');
  });

  test('MEMBER URIs are all parsed', () => {
    const [vc] = parse(GROUP);
    assert.ok(vc);
    assert.equal(vc.member.length, 3);
  });

  test('urn:uuid MEMBER URI preserved', () => {
    const [vc] = parse(GROUP);
    assert.ok(vc);
    assert.ok(vc.member[0]?.value.startsWith('urn:uuid:'));
  });

  test('mailto MEMBER URI preserved', () => {
    const [vc] = parse(GROUP);
    assert.ok(vc);
    assert.ok(vc.member.some(m => m.value.startsWith('mailto:')));
  });

  test('round-trips correctly', () => {
    const [vc] = parse(GROUP);
    assert.ok(vc);
    const out = vc.toString();
    const [vc2] = parse(out);
    assert.ok(vc2);
    assert.equal(vc2.kind?.value, 'group');
    assert.equal(vc2.member.length, 3);
  });
});

// ── Complex ADR with GEO and LABEL parameters ──────────────────────────────

describe('ADR with GEO parameter and LABEL', () => {
  const COMPLEX_ADR = [
    'BEGIN:VCARD',
    'VERSION:4.0',
    'FN:John Q. Public',
    'ADR;GEO="geo:12.3457,78.910";LABEL="Mr. John Q. Public\\, Esq.\\nMail Drop: TNE QB\\n123 Main Street":;;123 Main Street;Any Town;CA;91921;U.S.A.',
    'END:VCARD',
  ].join('\r\n');

  test('parses ADR with extra parameters', () => {
    const [vc] = parse(COMPLEX_ADR);
    assert.ok(vc);
    assert.equal(vc.adr.length, 1);
    assert.equal(vc.adr[0]?.value.streetAddress, '123 Main Street');
    assert.equal(vc.adr[0]?.value.locality, 'Any Town');
    assert.equal(vc.adr[0]?.value.region, 'CA');
    assert.equal(vc.adr[0]?.value.postalCode, '91921');
    assert.equal(vc.adr[0]?.value.countryName, 'U.S.A.');
  });

  test('GEO parameter is preserved in params map', () => {
    const [vc] = parse(COMPLEX_ADR);
    assert.ok(vc);
    const geo = vc.adr[0]?.params.get('GEO');
    assert.ok(geo);
    const geoStr = Array.isArray(geo) ? geo[0] : geo;
    assert.ok(geoStr?.includes('12.3457'));
  });

  test('LABEL parameter with escaped chars is preserved', () => {
    const [vc] = parse(COMPLEX_ADR);
    assert.ok(vc);
    const label = vc.adr[0]?.label;
    assert.ok(label);
    assert.ok(label.includes('John Q. Public'));
  });
});

// ── DATE/TIME format variations ───────────────────────────────────────────

describe('DATE/TIME format variations', () => {
  const DATES = [
    'BEGIN:VCARD',
    'VERSION:4.0',
    'FN:Test Subject',
    'BDAY:19960415',
    'END:VCARD',
  ].join('\r\n');

  const PARTIAL_DATE = [
    'BEGIN:VCARD',
    'VERSION:4.0',
    'FN:Test Subject',
    'BDAY:--0415',
    'END:VCARD',
  ].join('\r\n');

  const TEXT_DATE = [
    'BEGIN:VCARD',
    'VERSION:4.0',
    'FN:Test Subject',
    'BDAY;VALUE=text:circa 1800',
    'END:VCARD',
  ].join('\r\n');

  const YEAR_ONLY = [
    'BEGIN:VCARD',
    'VERSION:4.0',
    'FN:Test Subject',
    'BDAY:1990',
    'END:VCARD',
  ].join('\r\n');

  const HYPHENATED = [
    'BEGIN:VCARD',
    'VERSION:4.0',
    'FN:Test Subject',
    'BDAY:1990-04-15',
    'END:VCARD',
  ].join('\r\n');

  test('full YYYYMMDD date', () => {
    const [vc] = parse(DATES);
    assert.ok(vc?.bday?.dateValue);
    assert.equal(vc.bday.dateValue.year, 1996);
    assert.equal(vc.bday.dateValue.month, 4);
    assert.equal(vc.bday.dateValue.day, 15);
  });

  test('--MMDD partial date (no year)', () => {
    const [vc] = parse(PARTIAL_DATE);
    assert.ok(vc?.bday?.dateValue);
    assert.equal(vc.bday.dateValue.year, undefined);
    assert.equal(vc.bday.dateValue.month, 4);
    assert.equal(vc.bday.dateValue.day, 15);
  });

  test('VALUE=text date stored as text', () => {
    const [vc] = parse(TEXT_DATE);
    assert.ok(vc?.bday);
    assert.equal(vc.bday.dateValue, null);
    assert.equal(vc.bday.textValue, 'circa 1800');
  });

  test('year-only BDAY', () => {
    const [vc] = parse(YEAR_ONLY);
    assert.ok(vc?.bday?.dateValue);
    assert.equal(vc.bday.dateValue.year, 1990);
    assert.equal(vc.bday.dateValue.month, undefined);
    assert.equal(vc.bday.dateValue.day, undefined);
  });

  test('hyphenated ISO 8601 extended format YYYY-MM-DD', () => {
    const [vc] = parse(HYPHENATED);
    assert.ok(vc?.bday?.dateValue);
    assert.equal(vc.bday.dateValue.year, 1990);
    assert.equal(vc.bday.dateValue.month, 4);
    assert.equal(vc.bday.dateValue.day, 15);
  });

  test('VALUE=text BDAY round-trips', () => {
    const [vc] = parse(TEXT_DATE);
    assert.ok(vc);
    const out = vc.toString();
    const [vc2] = parse(out);
    assert.ok(vc2?.bday);
    assert.equal(vc2.bday.textValue, 'circa 1800');
  });
});

// ── Semicolon escaping edge cases ─────────────────────────────────────────

describe('Semicolon and special character escaping edge cases', () => {
  test('escaped semicolon in ORG component preserved', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Test',
      'N:Smith;John;Lee;Dr.;PhD',
      'ORG:Company\\;Inc.;Sales\\;Marketing',
      'END:VCARD',
    ].join('\r\n');

    const [vc] = parse(card);
    assert.ok(vc);
    // ORG: "Company;Inc." is org name, "Sales;Marketing" is unit
    assert.equal(vc.org[0]?.value.name, 'Company;Inc.');
    assert.deepEqual(vc.org[0]?.value.units, ['Sales;Marketing']);
  });

  test('escaped semicolons in NICKNAME (text-list)', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Test',
      'NICKNAME:Johnny\\;The\\;Genius',
      'END:VCARD',
    ].join('\r\n');

    const [vc] = parse(card);
    assert.ok(vc);
    // Single value with literal semicolons
    assert.equal(vc.nickname[0]?.values[0], 'Johnny;The;Genius');
  });

  test('N components with semicolons as delimiters (not escaped)', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:John Smith',
      'N:Smith;John;Lee;Dr.;PhD',
      'END:VCARD',
    ].join('\r\n');

    const [vc] = parse(card);
    assert.ok(vc?.n);
    assert.deepEqual(vc.n.value.familyNames, ['Smith']);
    assert.deepEqual(vc.n.value.givenNames, ['John']);
    assert.deepEqual(vc.n.value.additionalNames, ['Lee']);
    assert.deepEqual(vc.n.value.honorificPrefixes, ['Dr.']);
    assert.deepEqual(vc.n.value.honorificSuffixes, ['PhD']);
  });

  test('NOTE with escaped newlines and commas', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Test',
      'NOTE:Mythical Manager\\nHyjinx Software Division\\nBabsCo\\, Inc.',
      'END:VCARD',
    ].join('\r\n');

    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.note[0]?.value, 'Mythical Manager\nHyjinx Software Division\nBabsCo, Inc.');
  });

  test('backslash followed by unknown char is preserved literally', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:Test',
      'NOTE:path\\: C:\\\\Users\\\\test',
      'END:VCARD',
    ].join('\r\n');

    const [vc] = parse(card);
    assert.ok(vc);
    // \\ → \, \: → (literal \\:, since \: is not a defined escape, keep \\: as-is... but actually unescapeText strips the backslash)
    // In RFC: "In text value types, any character may be escaped with a backslash"
    // So \: → :
    // Actually per RFC 6350: the defined escapes are \\, \n, \;, \,
    // Undefined escapes like \: are parsed as the next char
    assert.ok(vc.note[0]?.value.includes('C:\\Users\\test'));
  });

  test('FN with colon in value', () => {
    // Colon appears after the property name separator — value starts there
    // But a colon IN the value should not need escaping
    const card = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:Dr. Jones: Adventurer',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.displayName, 'Dr. Jones: Adventurer');
  });
});

// ── Multiple vCards and edge formats ──────────────────────────────────────

describe('Multi-vCard and format edge cases', () => {
  test('empty BDAY (just --) does not crash', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:Test',
      'BDAY:',
      'END:VCARD',
    ].join('\r\n');
    assert.doesNotThrow(() => parse(card));
  });

  test('property with no value after colon is tolerated', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:Test',
      'NOTE:',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.note.length, 1);
    assert.equal(vc.note[0]?.value, '');
  });

  test('completely unknown property is stored in extended', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:Test',
      'X-SOME-CUSTOM:somevalue',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    const x = vc.extended.find(p => p.name === 'X-SOME-CUSTOM');
    assert.ok(x);
    assert.equal(x.rawValue, 'somevalue');
  });

  test('multiple FN properties are all stored', () => {
    // v4 allows 1+ FN properties
    const card = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN;LANGUAGE=en:John Doe',
      'FN;LANGUAGE=fr:Jean Dupont',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.fn.length, 2);
  });

  test('multiple ORG properties are all stored', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:Test',
      'ORG:Primary Corp',
      'ORG;TYPE=work:Secondary Inc.',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.org.length, 2);
  });

  test('case-insensitive property names', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'fn:John Doe',
      'email:john@example.com',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.displayName, 'John Doe');
    assert.equal(vc.email[0]?.value, 'john@example.com');
  });

  test('case-insensitive VERSION:4.0', () => {
    const card = 'begin:vcard\r\nversion:4.0\r\nfn:Test\r\nend:vcard\r\n';
    const vcards = parse(card);
    assert.equal(vcards.length, 1);
    assert.equal(vcards[0]?.displayName, 'Test');
  });

  test('CRLF-only blank lines between vCards are ignored', () => {
    const multi = [
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Alice', 'END:VCARD',
      '', '',
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Bob', 'END:VCARD',
    ].join('\r\n');
    const vcards = parse(multi);
    assert.equal(vcards.length, 2);
    assert.equal(vcards[0]?.displayName, 'Alice');
    assert.equal(vcards[1]?.displayName, 'Bob');
  });

  test('content before first BEGIN:VCARD is ignored', () => {
    const card = 'This is not a vCard\r\n' + [
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Test', 'END:VCARD',
    ].join('\r\n');
    const vcards = parse(card);
    assert.equal(vcards.length, 1);
    assert.equal(vcards[0]?.displayName, 'Test');
  });

  test('unclosed vCard is parsed tolerantly', () => {
    const card = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:Test'].join('\r\n');
    const vcards = parse(card);
    // Should still yield one vCard with a warning
    assert.equal(vcards.length, 1);
    assert.equal(vcards[0]?.displayName, 'Test');
    assert.ok(vcards[0]?.parseWarnings.some(w => w.message.includes('END:VCARD')));
  });
});

// ── Timezone format variations ─────────────────────────────────────────────

describe('Timezone format variations', () => {
  test('TZ as bare UTC offset (no VALUE param)', () => {
    const card = [
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Test', 'TZ:-0500', 'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.tz.length, 1);
    assert.equal(vc.tz[0]?.valueKind, 'utc-offset');
    assert.equal(vc.tz[0]?.value, '-0500');
  });

  test('TZ as colon-format UTC offset', () => {
    const card = [
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Test', 'TZ:-05:00', 'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.tz[0]?.valueKind, 'utc-offset');
    assert.equal(vc.tz[0]?.value, '-05:00');
  });

  test('TZ as IANA text (VALUE=text)', () => {
    const card = [
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Test',
      'TZ;VALUE=text:America/New_York',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.tz[0]?.valueKind, 'text');
    assert.equal(vc.tz[0]?.value, 'America/New_York');
  });

  test('TZ as URI (VALUE=uri)', () => {
    const card = [
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Test',
      'TZ;VALUE=uri:https://www.iana.org/time-zones',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.tz[0]?.valueKind, 'uri');
  });
});

// ── GENDER with identity text ─────────────────────────────────────────────

describe('GENDER property variations', () => {
  test('M (male)', () => {
    const card = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:Test', 'GENDER:M', 'END:VCARD'].join('\r\n');
    const [vc] = parse(card);
    assert.equal(vc?.gender?.value.sex, 'M');
    assert.equal(vc?.gender?.value.identity, undefined);
  });

  test('F (female)', () => {
    const card = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:Test', 'GENDER:F', 'END:VCARD'].join('\r\n');
    const [vc] = parse(card);
    assert.equal(vc?.gender?.value.sex, 'F');
  });

  test('O with identity text', () => {
    const card = [
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Test',
      'GENDER:O;non-binary',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.equal(vc?.gender?.value.sex, 'O');
    assert.equal(vc?.gender?.value.identity, 'non-binary');
  });

  test('U (unknown)', () => {
    const card = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:Test', 'GENDER:U', 'END:VCARD'].join('\r\n');
    const [vc] = parse(card);
    assert.equal(vc?.gender?.value.sex, 'U');
  });

  test('N (not applicable)', () => {
    const card = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:Test', 'GENDER:N', 'END:VCARD'].join('\r\n');
    const [vc] = parse(card);
    assert.equal(vc?.gender?.value.sex, 'N');
  });

  test('empty sex with identity', () => {
    const card = [
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Test',
      'GENDER:;it/its',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.equal(vc?.gender?.value.sex, '');
    assert.equal(vc?.gender?.value.identity, 'it/its');
  });

  test('GENDER with identity round-trips', () => {
    const card = [
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Test',
      'GENDER:O;non-binary',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    const out = vc.toString();
    const [vc2] = parse(out);
    assert.equal(vc2?.gender?.value.sex, 'O');
    assert.equal(vc2?.gender?.value.identity, 'non-binary');
  });
});

// ── RELATED property ──────────────────────────────────────────────────────

describe('RELATED property', () => {
  test('RELATED as URI', () => {
    const card = [
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Test',
      'RELATED;TYPE=spouse:urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.related.length, 1);
    assert.ok(vc.related[0]?.isUri);
    assert.ok(vc.related[0]?.value.startsWith('urn:uuid:'));
    assert.ok(vc.related[0]?.type.includes('spouse'));
  });

  test('RELATED as text (VALUE=text)', () => {
    const card = [
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Test',
      'RELATED;VALUE=text;TYPE=friend:Jane Doe',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.related[0]?.value, 'Jane Doe');
    assert.equal(vc.related[0]?.isUri, false);
  });
});

// ── CLIENTPIDMAP ──────────────────────────────────────────────────────────

describe('CLIENTPIDMAP property', () => {
  test('parses pid number and URI', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:Test',
      'CLIENTPIDMAP:1;urn:uuid:3df403f4-5924-4bb7-b077-3c711d9eb34b',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.clientpidmap.length, 1);
    assert.equal(vc.clientpidmap[0]?.value.pid, 1);
    assert.ok(vc.clientpidmap[0]?.value.uri.startsWith('urn:uuid:'));
  });

  test('multiple CLIENTPIDMAP entries', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:Test',
      'CLIENTPIDMAP:1;urn:uuid:aaa',
      'CLIENTPIDMAP:2;urn:uuid:bbb',
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc);
    assert.equal(vc.clientpidmap.length, 2);
    assert.equal(vc.clientpidmap[0]?.value.pid, 1);
    assert.equal(vc.clientpidmap[1]?.value.pid, 2);
  });
});

// ── Long line folding with real data ─────────────────────────────────────

describe('Long-line folding with real data', () => {
  test('very long NOTE is folded and unfolded correctly', () => {
    const longNote = 'This is a very long note that goes on and on and on. ' +
      'It contains important information that exceeds the 75 octet limit significantly. ' +
      'The line folding mechanism must correctly handle this case.';

    const vc = VCard.create('Test');
    vc.note.push(new NoteProperty(longNote));
    const out = vc.toString();

    // All lines must be ≤ 75 octets
    for (const line of out.split('\r\n').filter(Boolean)) {
      assert.ok(
        Buffer.byteLength(line, 'utf8') <= 75,
        `Line too long (${Buffer.byteLength(line, 'utf8')} bytes): "${line.slice(0, 40)}..."`,
      );
    }

    // Round-trip must preserve the note
    const [vc2] = parse(out);
    assert.equal(vc2?.note[0]?.value, longNote);
  });

  test('UID as urn:uuid round-trips correctly', () => {
    const uid = 'urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6';
    const card = [
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Test',
      `UID:${uid}`,
      'END:VCARD',
    ].join('\r\n');
    const [vc] = parse(card);
    assert.ok(vc?.uid);
    assert.equal(vc.uid.value, uid);
    const out = vc.toString();
    const [vc2] = parse(out);
    assert.equal(vc2?.uid?.value, uid);
  });

  test('data: URI in PHOTO survives round-trip', () => {
    // Abbreviated base64 for test
    const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEB';
    const vc = VCard.create('Test');
    vc.photo.push(new PhotoProperty(dataUri));
    const out = vc.toString();
    const [vc2] = parse(out);
    assert.ok(vc2);
    assert.equal(vc2.photo.length, 1);
    assert.ok(vc2.photo[0]?.value.startsWith('data:image/jpeg'));
  });
});

// ── toJSON coverage ────────────────────────────────────────────────────────

describe('toJSON()', () => {
  test('gender appears in JSON', () => {
    const [vc] = parse([
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Test', 'GENDER:M', 'END:VCARD',
    ].join('\r\n'));
    assert.ok(vc);
    const json = vc.toJSON() as Record<string, unknown>;
    assert.deepEqual(json.gender, { sex: 'M' });
  });

  test('rev appears as ISO string in JSON', () => {
    const [vc] = parse([
      'BEGIN:VCARD', 'VERSION:4.0', 'FN:Test', 'REV:20240101T120000Z', 'END:VCARD',
    ].join('\r\n'));
    assert.ok(vc);
    const json = vc.toJSON() as Record<string, unknown>;
    assert.ok(typeof json.rev === 'string');
    assert.ok((json.rev as string).startsWith('2024'));
  });
});
