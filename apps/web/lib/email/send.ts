// Built by Anointed Coder.
//
// SMTP email sender used by the campaign blast dispatcher. It mirrors the
// SMS service: it never throws, returns a small result object, and writes
// a NotificationLog row (channel 'email') for every attempt so the
// operator can audit sends. Configuration is read from the same
// EMAIL_SMTP_* environment variables that isEmailProviderConfigured()
// validates, so the channel stays dormant until the operator supplies SMTP
// credentials (host, port, user, password, from address).

import type { Prisma } from '@prisma/client';
import nodemailer, { type Transporter } from 'nodemailer';
import { db } from '@/lib/db/client';
import { isEmailProviderConfigured } from '@/lib/campaigns/email-provider';

export interface EmailSendResult {
  ok: boolean;
  ref?: string;
  errorCode?: string;
  errorBody?: string;
}

export interface SendEmailOpts {
  email: string;
  subject: string;
  html: string;
  template?: string | null;
  userId?: string | null;
  triggerKey?: string | null;
  meta?: Prisma.JsonObject | null;
}

let cachedTransport: Transporter | null = null;

function getTransport(): Transporter {
  if (cachedTransport) return cachedTransport;
  const port = Number(process.env.EMAIL_SMTP_PORT || 587);
  cachedTransport = nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port,
    // Port 465 is implicit TLS; 587 / 25 use STARTTLS, which nodemailer
    // negotiates automatically when secure is false.
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASSWORD,
    },
  });
  return cachedTransport;
}

function fromAddress(): string {
  const addr = process.env.EMAIL_FROM_ADDRESS ?? '';
  const name = process.env.EMAIL_FROM_NAME?.trim();
  return name ? `${name} <${addr}>` : addr;
}

export async function sendEmail(opts: SendEmailOpts): Promise<EmailSendResult> {
  let result: EmailSendResult;
  if (!isEmailProviderConfigured()) {
    result = { ok: false, errorCode: 'EMAIL_NOT_CONFIGURED' };
  } else {
    try {
      const info = await getTransport().sendMail({
        from: fromAddress(),
        to: opts.email,
        subject: opts.subject,
        html: opts.html,
      });
      result = { ok: true, ref: info.messageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result = { ok: false, errorCode: 'SMTP_SEND_FAILED', errorBody: msg.slice(0, 500) };
    }
  }

  // Best-effort audit log. Never throws.
  try {
    await db.notificationLog.create({
      data: {
        channel: 'email',
        provider: 'smtp',
        recipient: opts.email,
        template: opts.template ?? null,
        body: opts.html,
        userId: opts.userId ?? null,
        triggerKey: opts.triggerKey ?? null,
        ok: result.ok,
        ref: result.ref ?? null,
        errorCode: result.errorCode ?? null,
        errorBody: result.errorBody ?? null,
        meta: (opts.meta ?? null) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error('[email] NotificationLog write failed', err);
  }

  return result;
}
