import { EtherealMailProvider } from './EtherealMailProvider.js';
import type { MailProvider } from './MailProvider.js';
import { env } from '../../config/env.js';

let provider: MailProvider | null = null;

export function getMailProvider(): MailProvider {
  if (!provider) {
    // Currently only Ethereal is implemented.
    // To add SES, Resend, etc.: check env.MAIL_PROVIDER and return the correct adapter.
    provider = new EtherealMailProvider();
    console.info(`[MailProvider] Using provider: ${provider.name}`);
  }
  return provider;
}

export type { MailProvider, MailMessage, MailSendResult } from './MailProvider.js';
