/**
 * The substitution layer a bridge spec is written in.
 *
 * Two operations, both deliberately small: read a value out of a JSON response by path, and render a
 * JSON tree whose strings may contain `{{…}}` placeholders. Everything vendor-shaped in
 * `BridgeSpec` — URLs, headers, request bodies, output locations — is expressed with these, which is
 * what lets a new API be data rather than a new adapter file.
 *
 * Three rules carry most of the weight:
 *
 * 1. **A string that is *only* a placeholder keeps the value's type.** `"{{duration}}"` sends the
 *    number `8`, not `"8"` — vendors validate types and half of them reject a stringified number.
 *    `"{{width}}x{{height}}"` is the other case and interpolates to `"1024x576"` as you'd expect.
 * 2. **An object key whose value resolves to `undefined` is dropped.** A spec is written once for
 *    every request the API will ever serve, so most of its keys are optional most of the time;
 *    sending `"seed": null` when the user set no seed makes strict vendors 400.
 * 3. **Nothing is coerced to `"undefined"`.** An unresolved placeholder inside a longer string
 *    renders as empty, so a half-filled URL fails as a 404 rather than as a literal
 *    `.../undefined/result`, which is far harder to read in a stage error.
 */

/** `{{ path }}` and nothing else — the type-preserving case. */
const WHOLE_PLACEHOLDER = /^\{\{\s*([\w$]+(?:(?:\.[\w$]+)|(?:\[\d+\]))*)\s*\}\}$/;

/** Every `{{ path }}` inside a larger string — the interpolating case. */
const INLINE_PLACEHOLDER = /\{\{\s*([\w$]+(?:(?:\.[\w$]+)|(?:\[\d+\]))*)\s*\}\}/g;

/**
 * Reads `a.b[0].c` out of a parsed JSON value. Returns `undefined` for any missing or
 * wrongly-typed link in the chain rather than throwing — a vendor that renamed a field should
 * surface as "no outputs returned", not as a `TypeError` from inside the adapter.
 */
export function getPath(source: unknown, path: string): unknown {
  const tokens = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  let current: unknown = source;
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

export type TemplateVars = Record<string, unknown>;

/** Interpolates every placeholder in `template`; unresolved ones become empty (see rule 3). */
export function renderString(template: string, vars: TemplateVars): string {
  return template.replace(INLINE_PLACEHOLDER, (_match, path: string) => {
    const value = getPath(vars, path);
    if (value === null || value === undefined) return '';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}

/**
 * Renders a whole JSON tree. Objects lose their `undefined`-valued keys (rule 2) and arrays lose
 * their `undefined` entries, so a spec can list every parameter the vendor supports and only the
 * ones this request actually fills get sent.
 */
export function renderValue(node: unknown, vars: TemplateVars): unknown {
  if (typeof node === 'string') {
    const whole = WHOLE_PLACEHOLDER.exec(node);
    if (whole?.[1]) return getPath(vars, whole[1]);
    return renderString(node, vars);
  }

  if (Array.isArray(node)) {
    return node.map((item) => renderValue(item, vars)).filter((item) => item !== undefined);
  }

  if (node !== null && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      const rendered = renderValue(value, vars);
      if (rendered !== undefined) out[key] = rendered;
    }
    return out;
  }

  return node;
}

/** Renders a header map, dropping headers whose value came out empty. */
export function renderHeaders(
  headers: Record<string, string>,
  vars: TemplateVars,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const rendered = renderString(value, vars);
    if (rendered) out[name] = rendered;
  }
  return out;
}
