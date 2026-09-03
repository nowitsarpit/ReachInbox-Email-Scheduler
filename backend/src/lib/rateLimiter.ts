import { getRedis } from './redis.js';
import { env } from '../config/env.js';

/**
 * Atomic Redis rate limiter using Lua scripts.
 * Uses a sliding window counter per key.
 * Multiple workers share the same Redis state — no race conditions.
 */

// Atomic increment-and-check Lua script
// Returns: [current_count, ttl_ms_remaining, allowed (1 or 0)]
const RATE_LIMIT_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])

local current = tonumber(redis.call('GET', key) or '0')

if current >= limit then
  local ttl = redis.call('PTTL', key)
  return {current, ttl, 0}
end

local new_count = redis.call('INCR', key)
if new_count == 1 then
  redis.call('PEXPIRE', key, window_ms)
end

local ttl = redis.call('PTTL', key)
return {new_count, ttl, 1}
`;

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  resetInMs: number;
}

/**
 * Try to consume one unit from the rate limit bucket.
 * Returns whether the operation is allowed and the remaining TTL.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = getRedis();

  const result = await redis.eval(
    RATE_LIMIT_LUA,
    1,
    key,
    String(limit),
    String(windowMs)
  ) as [number, number, number];

  const [current, ttl, allowed] = result;

  return {
    allowed: allowed === 1,
    current,
    limit,
    resetInMs: ttl > 0 ? ttl : windowMs,
  };
}

/**
 * Check rate limit for an organization.
 */
export async function checkOrgRateLimit(organizationId: string): Promise<RateLimitResult> {
  const windowMs = 60 * 60 * 1000; // 1 hour
  const key = `rl:org:${organizationId}:${Math.floor(Date.now() / windowMs)}`;
  return checkRateLimit(key, env.RATE_LIMIT_ORG_PER_HOUR, windowMs);
}

/**
 * Check rate limit for a sender.
 */
export async function checkSenderRateLimit(
  organizationId: string,
  senderId: string
): Promise<RateLimitResult> {
  const windowMs = 60 * 60 * 1000;
  const key = `rl:sender:${organizationId}:${senderId}:${Math.floor(Date.now() / windowMs)}`;
  return checkRateLimit(key, env.RATE_LIMIT_SENDER_PER_HOUR, windowMs);
}

/**
 * Check global rate limit.
 */
export async function checkGlobalRateLimit(): Promise<RateLimitResult> {
  const windowMs = 60 * 60 * 1000;
  const key = `rl:global:${Math.floor(Date.now() / windowMs)}`;
  return checkRateLimit(key, env.RATE_LIMIT_GLOBAL_PER_HOUR, windowMs);
}

/**
 * Calculate the timestamp when the next send is eligible after rate limiting.
 */
export function calculateNextEligibleTime(resetInMs: number): Date {
  // Add a small buffer to avoid hitting the limit boundary
  return new Date(Date.now() + resetInMs + 100);
}
