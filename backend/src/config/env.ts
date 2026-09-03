import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load single backend/.env file from possible execution directories (cwd, backend/, __dirname)
const candidateEnvPaths = [
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '.env'),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(Number(process.env['PORT']) || 5000),
  PORT: z.coerce.number().optional(),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Ethereal SMTP
  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.coerce.number().default(587),
  ETHEREAL_SECURE: z.preprocess((val) => val === 'true' || val === true || val === '1', z.boolean()).default(false),
  ETHEREAL_USER: z.string().optional(),
  ETHEREAL_PASS: z.string().optional(),
  ETHEREAL_FROM_NAME: z.string().default('GoMAil'),
  ETHEREAL_FROM_EMAIL: z.string().optional(),

  // Worker
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  WORKER_QUEUE_NAME: z.string().default('gomail-delivery'),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().default(1000),
  LEASE_TIMEOUT_MS: z.coerce.number().default(60000),

  // Rate limiting
  RATE_LIMIT_GLOBAL_PER_HOUR: z.coerce.number().default(500),
  RATE_LIMIT_ORG_PER_HOUR: z.coerce.number().default(200),
  RATE_LIMIT_SENDER_PER_HOUR: z.coerce.number().default(100),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/auth/google/callback'),

  // Session
  SESSION_SECRET: z.string().min(32).optional(),
  SESSION_DURATION_DAYS: z.coerce.number().default(30),

  // URLs
  API_URL: z.string().default('http://localhost:5000'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Webhook
  WEBHOOK_TIMEOUT_MS: z.coerce.number().default(10000),
  WEBHOOK_MAX_RETRIES: z.coerce.number().default(5),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
export type Env = typeof env;
