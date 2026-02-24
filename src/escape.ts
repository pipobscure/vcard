/**
 * Text escaping and unescaping for vCard v4 (RFC 6350 section 3.4)
 *
 * In TEXT value types:
 *   \\ → \
 *   \n or \N → newline (U+000A)
 *   \, → ,
 *   \; → ;
 *
 * On output, these characters must be escaped:
 *   \ → \\
 *   newline → \n
 *   , → \,  (only in compound/list fields)
 *   ; → \;  (always in structured fields)
 */

/** Unescape a single text component (after splitting on `;` or `,`) */
export function unescapeText(s: string): string {
  return s.replace(/\\(\\|n|N|,|;)/g, (_, c: string) => {
    if (c === 'n' || c === 'N') return '\n';
    if (c === '\\') return '\\';
    if (c === ',') return ',';
    if (c === ';') return ';';
    return c;
  });
}

/** Escape a text value for use as a TEXT property value (no structural chars) */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * Escape a text value that is a component of a structured/list property.
 * The caller is responsible for joining components with `;` or `,`.
 * Only escapes `\`, `\n`, and `;` — the `,` within a component (for list-within-struct).
 */
export function escapeStructuredComponent(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * Split a structured value on `;`, respecting backslash escapes.
 * Returns raw (still-escaped) components.
 */
export function splitStructured(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    if (ch === '\\' && i + 1 < value.length) {
      current += ch + value[++i]!;
    } else if (ch === ';') {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/**
 * Split a compound value on `,`, respecting backslash escapes.
 * Returns raw (still-escaped) items.
 */
export function splitList(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    if (ch === '\\' && i + 1 < value.length) {
      current += ch + value[++i]!;
    } else if (ch === ',') {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/** Unescape and split a structured value into its components */
export function parseStructured(value: string): string[] {
  return splitStructured(value).map(unescapeText);
}

/** Unescape and split a list value into its items */
export function parseList(value: string): string[] {
  return splitList(value).map(unescapeText);
}

/** Unescape and split a structured-with-lists value.
 *  Each `;`-separated component may itself be a `,`-separated list.
 */
export function parseStructuredList(value: string): string[][] {
  return splitStructured(value).map(component => parseList(component));
}

/**
 * Check whether a parameter value needs quoting (RFC 6350 section 5.1).
 * Param values containing `:`, `;`, or `,` must be quoted.
 */
export function needsParamQuoting(value: string): boolean {
  return /[;:,"]/.test(value);
}

/**
 * Quote a parameter value if necessary.
 * Existing double-quotes within the value are escaped as \".
 */
export function quoteParamValue(value: string): string {
  if (!needsParamQuoting(value)) return value;
  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/**
 * Unquote a parameter value (remove surrounding quotes if present,
 * unescape internal \" sequences).
 */
export function unquoteParamValue(value: string): string {
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return value;
}
