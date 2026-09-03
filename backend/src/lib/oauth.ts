import { Issuer, generators, type Client } from 'openid-client';
import { env } from '../config/env.js';
import { getRedis } from './redis.js';

// TTL for OAuth state in Redis (15 minutes)
const OAUTH_STATE_TTL = 15 * 60;

let googleClient: Client | null = null;

/**
 * Initialize the Google OIDC client.
 * Discovers the OIDC configuration from Google's well-known endpoint.
 */
export async function getGoogleOidcClient(): Promise<Client> {
  if (googleClient) return googleClient;

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new OAuthNotConfiguredError(
      'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file. ' +
      'Create credentials at https://console.cloud.google.com/apis/credentials'
    );
  }

  const googleIssuer = await Issuer.discover('https://accounts.google.com');

  googleClient = new googleIssuer.Client({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uris: [env.GOOGLE_CALLBACK_URL],
    response_types: ['code'],
  });

  return googleClient;
}

export class OAuthNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthNotConfiguredError';
  }
}

export interface OAuthStateData {
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectAfter?: string;
}

/**
 * Generate and persist OAuth state (state, nonce, PKCE verifier).
 * State is stored in Redis with a short TTL to prevent replay attacks.
 */
export async function generateOAuthState(redirectAfter?: string): Promise<OAuthStateData> {
  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();

  const stateData: OAuthStateData = { state, nonce, codeVerifier, ...(redirectAfter ? { redirectAfter } : {}) };

  const redis = getRedis();
  await redis.setex(
    `oauth:state:${state}`,
    OAUTH_STATE_TTL,
    JSON.stringify(stateData)
  );

  return stateData;
}

/**
 * Retrieve and consume OAuth state from Redis.
 * State is deleted after consumption to prevent replay.
 */
export async function consumeOAuthState(state: string): Promise<OAuthStateData | null> {
  const redis = getRedis();
  const key = `oauth:state:${state}`;
  const raw = await redis.get(key);

  if (!raw) return null;

  // Delete immediately (consume once)
  await redis.del(key);

  try {
    return JSON.parse(raw) as OAuthStateData;
  } catch {
    return null;
  }
}

/**
 * Build the Google authorization URL with PKCE + state + nonce.
 */
export async function buildAuthorizationUrl(state: OAuthStateData): Promise<string> {
  const client = await getGoogleOidcClient();
  const codeChallenge = generators.codeChallenge(state.codeVerifier);

  return client.authorizationUrl({
    scope: 'openid email profile',
    state: state.state,
    nonce: state.nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
}

export interface GoogleIdentity {
  sub: string;          // stable Google user ID
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

/**
 * Exchange authorization code for tokens and validate the ID token.
 * Performs: issuer, audience, expiry, nonce validation.
 */
export async function exchangeCodeForIdentity(
  code: string,
  stateData: OAuthStateData
): Promise<GoogleIdentity> {
  const client = await getGoogleOidcClient();

  const params = { code, state: stateData.state };

  const tokenSet = await client.callback(env.GOOGLE_CALLBACK_URL, params, {
    state: stateData.state,
    nonce: stateData.nonce,
    code_verifier: stateData.codeVerifier,
  });

  if (!tokenSet.id_token) {
    throw new Error('No ID token received from Google');
  }

  const claims = tokenSet.claims();

  if (!claims.email) {
    throw new Error('No email in Google ID token claims');
  }

  if (!claims.email_verified) {
    throw new Error('Google account email is not verified');
  }

  return {
    sub: claims.sub,
    email: claims.email,
    emailVerified: Boolean(claims.email_verified),
    ...(claims.name ? { name: claims.name as string } : {}),
    ...(claims.picture ? { picture: claims.picture as string } : {}),
  };
}
