import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

// Initialize DOMPurify with JSDOM for server-side use
const { window } = new JSDOM('');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DOMPurify = createDOMPurify(window as any);

// Strict configuration for email HTML
const EMAIL_HTML_CONFIG = {
  ALLOWED_TAGS: [
    'a', 'b', 'blockquote', 'br', 'caption', 'cite', 'code',
    'col', 'colgroup', 'dd', 'del', 'details', 'dfn', 'div',
    'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li',
    'mark', 'ol', 'p', 'pre', 's', 'samp', 'small', 'span',
    'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td',
    'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'width', 'height',
    'style', 'align', 'valign', 'bgcolor', 'color',
    'cellpadding', 'cellspacing', 'border', 'colspan', 'rowspan',
    'target', 'rel', 'class', 'id',
  ],
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: true,
};

/**
 * Sanitize HTML content for email bodies.
 * Removes scripts, event handlers, and dangerous attributes.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, EMAIL_HTML_CONFIG);
}

/**
 * Strip all HTML tags and return plain text.
 */
export function stripHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return sanitized.replace(/\s+/g, ' ').trim();
}

/**
 * Validate that personalization variables in a template are all supported.
 * Returns list of unknown variables found.
 */
export function findUnknownPersonalizationVars(
  template: string,
  knownVars: string[]
): string[] {
  const varRegex = /\{\{(\w+)\}\}/g;
  const found: string[] = [];
  let match;
  while ((match = varRegex.exec(template)) !== null) {
    if (match[1] && !knownVars.includes(match[1])) {
      found.push(match[1]);
    }
  }
  return [...new Set(found)];
}

/**
 * Apply personalization variables to a template string.
 */
export function applyPersonalization(
  template: string,
  vars: Record<string, string | undefined>,
  fallbacks?: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = vars[key];
    if (value !== undefined && value !== '') return value;
    const fallback = fallbacks?.[key];
    return fallback ?? '';
  });
}

/**
 * Sanitize CSV field to prevent CSV injection.
 * Prefixes dangerous characters with a single quote.
 */
export function sanitizeCsvField(value: string): string {
  const dangerous = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerous.some((c) => value.startsWith(c))) {
    return `'${value}`;
  }
  return value;
}
