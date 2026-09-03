import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  normalizeEmail,
  generateIdempotencyKey,
  generateApiKey,
  hashApiKey,
  toBullJobId,
} from '../../lib/idempotency.js';

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('User.Name+tag@sub.domain.org')).toBe(true);
    expect(isValidEmail('test@gmail.com')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('rejects emails over 254 chars', () => {
    const long = 'a'.repeat(250) + '@b.com';
    expect(isValidEmail(long)).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  User@EXAMPLE.COM  ')).toBe('user@example.com');
  });

  it('removes Gmail dots', () => {
    expect(normalizeEmail('j.o.h.n@gmail.com')).toBe('john@gmail.com');
    expect(normalizeEmail('J.O.H.N@GMAIL.COM')).toBe('john@gmail.com');
  });

  it('strips plus addressing for Gmail', () => {
    expect(normalizeEmail('john+promo@gmail.com')).toBe('john@gmail.com');
  });

  it('strips plus addressing for other providers', () => {
    expect(normalizeEmail('user+tag@company.com')).toBe('user@company.com');
  });

  it('deduplicates Gmail variants', () => {
    const variants = [
      'john.doe@gmail.com',
      'johndoe@gmail.com',
      'john.doe+spam@gmail.com',
      'JOHN.DOE@GMAIL.COM',
    ];
    const normalized = variants.map(normalizeEmail);
    expect(new Set(normalized).size).toBe(1);
  });
});

describe('generateIdempotencyKey', () => {
  it('produces deterministic SHA-256 output', () => {
    const key1 = generateIdempotencyKey('campaign-1', 'user@example.com');
    const key2 = generateIdempotencyKey('campaign-1', 'user@example.com');
    expect(key1).toBe(key2);
  });

  it('differs for different inputs', () => {
    const key1 = generateIdempotencyKey('campaign-1', 'a@example.com');
    const key2 = generateIdempotencyKey('campaign-1', 'b@example.com');
    expect(key1).not.toBe(key2);
  });

  it('produces 64-char hex string', () => {
    const key = generateIdempotencyKey('campaign-abc', 'test@test.com');
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('generateApiKey', () => {
  it('returns key, prefix and hash', () => {
    const { key, prefix, hash } = generateApiKey();
    expect(key).toMatch(/^gm_/);
    expect(prefix).toBe(key.substring(0, 10));
    expect(hash).toHaveLength(64);
  });

  it('hash matches hashApiKey', () => {
    const { key, hash } = generateApiKey();
    expect(hashApiKey(key)).toBe(hash);
  });

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateApiKey().key));
    expect(keys.size).toBe(100);
  });
});

describe('toBullJobId', () => {
  it('prefixes with gomail:', () => {
    expect(toBullJobId('abc123')).toBe('gomail:abc123');
  });
});
