import nodemailer, { type Transporter } from 'nodemailer';
import type { MailProvider, MailMessage, MailSendResult, MailProviderHealth } from './MailProvider.js';
import { env } from '../../config/env.js';

interface EtherealAccount {
  user: string;
  pass: string;
  smtp: { host: string; port: number; secure: boolean };
  web: string;
}

let transporter: Transporter | null = null;
let testAccount: EtherealAccount | null = null;

/**
 * Get or create an Ethereal test account.
 * If ETHEREAL_USER/PASS are set, use those. Otherwise auto-create.
 */
async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  let user = env.ETHEREAL_USER;
  let pass = env.ETHEREAL_PASS;

  if (!user || !pass) {
    console.info('[EtherealMailProvider] No Ethereal credentials found. Auto-creating test account...');
    testAccount = await nodemailer.createTestAccount() as unknown as EtherealAccount;
    user = testAccount.user;
    pass = testAccount.pass;
    console.info(`[EtherealMailProvider] Created test account: ${user}`);
    console.info(`[EtherealMailProvider] View emails at: https://ethereal.email`);
    // Expose for the operations endpoint
    process.env.ETHEREAL_USER = user;
    process.env.ETHEREAL_PASS = pass;
  }

  transporter = nodemailer.createTransport({
    host: env.ETHEREAL_HOST,
    port: env.ETHEREAL_PORT,
    secure: env.ETHEREAL_SECURE,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });

  // Test credentials; if expired, auto-create a fresh account
  try {
    await transporter.verify();
  } catch (err: any) {
    const isAuthError = err?.code === 'EAUTH' || err?.responseCode === 535 || String(err?.message).includes('535') || String(err?.message).toLowerCase().includes('auth');
    if (isAuthError) {
      console.warn('[EtherealMailProvider] Credentials invalid or expired. Generating fresh test account...');
      testAccount = await nodemailer.createTestAccount() as unknown as EtherealAccount;
      user = testAccount.user;
      pass = testAccount.pass;
      process.env.ETHEREAL_USER = user;
      process.env.ETHEREAL_PASS = pass;
      transporter = nodemailer.createTransport({
        host: env.ETHEREAL_HOST,
        port: env.ETHEREAL_PORT,
        secure: env.ETHEREAL_SECURE,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      });
      await transporter.verify();
      console.info(`[EtherealMailProvider] Fresh test account active: ${user}`);
    } else {
      throw err;
    }
  }

  return transporter;
}

export class EtherealMailProvider implements MailProvider {
  readonly name = 'Ethereal (Test)';

  async send(message: MailMessage): Promise<MailSendResult> {
    let transport = await getTransporter();

    let info: any;
    try {
      info = await transport.sendMail({
        from: message.fromName
          ? `"${message.fromName}" <${message.from}>`
          : message.from,
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: {
          'X-GoMAil-Job-Id': message.jobId,
          'X-GoMAil-Campaign-Id': message.campaignId,
        },
      });
    } catch (err: any) {
      const isAuthError = err?.code === 'EAUTH' || err?.responseCode === 535 || String(err?.message).includes('535');
      if (isAuthError) {
        console.warn('[EtherealMailProvider] Send failed with auth error, renewing credentials and retrying once...');
        transporter = null;
        testAccount = null;
        process.env.ETHEREAL_USER = '';
        process.env.ETHEREAL_PASS = '';
        transport = await getTransporter();
        info = await transport.sendMail({
          from: message.fromName
            ? `"${message.fromName}" <${message.from}>`
            : message.from,
          to: message.to,
          replyTo: message.replyTo,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: {
            'X-GoMAil-Job-Id': message.jobId,
            'X-GoMAil-Campaign-Id': message.campaignId,
          },
        });
      } else {
        throw err;
      }
    }// Log preview URL for development
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.info(`[EtherealMailProvider] Preview URL: ${previewUrl}`);
    }

    return {
      messageId: info.messageId,
      providerResponse: {
        accepted: info.accepted,
        rejected: info.rejected,
        previewUrl: previewUrl || undefined,
      },
    };
  }

  async healthCheck(): Promise<MailProviderHealth> {
    const start = Date.now();
    try {
      const transport = await getTransporter();
      await transport.verify();
      return {
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
