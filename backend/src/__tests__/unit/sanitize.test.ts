import { describe, it, expect } from 'vitest';
import { sanitizeHtml, stripHtml, findUnknownPersonalizationVars, applyPersonalization, sanitizeCsvField } from '../../lib/sanitize.js';

describe('sanitizeHtml', () => {
  it('allows safe tags', () => {
    const result = sanitizeHtml('<p>Hello <strong>World</strong></p>');
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
  });

  it('removes script tags', () => {
    const result = sanitizeHtml('<script>alert("xss")</script><p>Safe</p>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('Safe');
  });

  it('removes event handlers', () => {
    const result = sanitizeHtml('<a href="#" onclick="steal()">Click</a>');
    expect(result).not.toContain('onclick');
  });

  it('removes javascript: URIs', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">Click</a>');
    expect(result).not.toContain('javascript:');
  });
});

describe('findUnknownPersonalizationVars', () => {
  it('finds unknown vars', () => {
    const unknown = findUnknownPersonalizationVars(
      'Hello {{firstName}} from {{unknownVar}}!',
      ['firstName', 'lastName', 'email']
    );
    expect(unknown).toContain('unknownVar');
    expect(unknown).not.toContain('firstName');
  });

  it('returns empty when all vars are known', () => {
    const unknown = findUnknownPersonalizationVars(
      'Hi {{firstName}} {{lastName}}',
      ['firstName', 'lastName', 'email', 'company']
    );
    expect(unknown).toHaveLength(0);
  });

  it('deduplicates unknown vars', () => {
    const unknown = findUnknownPersonalizationVars(
      '{{foo}} and {{foo}} and {{bar}}',
      ['email']
    );
    expect(unknown).toHaveLength(2);
  });
});

describe('applyPersonalization', () => {
  it('substitutes variables', () => {
    const result = applyPersonalization(
      'Hello {{firstName}}!',
      { firstName: 'Alice' }
    );
    expect(result).toBe('Hello Alice!');
  });

  it('uses fallback for missing vars', () => {
    const result = applyPersonalization(
      'Hello {{firstName}}!',
      { firstName: undefined },
      { firstName: 'Friend' }
    );
    expect(result).toBe('Hello Friend!');
  });

  it('uses empty string when no fallback', () => {
    const result = applyPersonalization('Hello {{firstName}}!', {});
    expect(result).toBe('Hello !');
  });
});

describe('sanitizeCsvField', () => {
  it('prefixes = with quote', () => {
    expect(sanitizeCsvField('=cmd')).toBe("'=cmd");
  });

  it('prefixes + with quote', () => {
    expect(sanitizeCsvField('+1234')).toBe("'+1234");
  });

  it('leaves normal values untouched', () => {
    expect(sanitizeCsvField('hello@example.com')).toBe('hello@example.com');
  });
});
