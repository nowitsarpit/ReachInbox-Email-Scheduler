/**
 * MailProvider abstraction.
 * Campaign logic depends only on this interface — never directly on Nodemailer.
 * Swap out the implementation to switch providers (SES, Resend, etc.)
 */
export interface MailMessage {
  to: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
}

export interface MailSendResult {
  messageId: string;
  providerResponse?: unknown;
}

export interface MailProviderHealth {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export interface MailProvider {
  readonly name: string;
  send(message: MailMessage): Promise<MailSendResult>;
  healthCheck(): Promise<MailProviderHealth>;
}
