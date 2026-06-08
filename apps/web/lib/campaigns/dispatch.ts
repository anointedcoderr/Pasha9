// Built by Anointed Coder.
//
// Campaign dispatch service. Resolves the campaign audience to a real
// CampaignRecipient list (or reads it if already materialised), then
// attempts to deliver each row through the configured provider.
//
// SMS dispatch goes through the existing lib/sms/service sendSms()
// helper which already returns { ok, errorCode, providerMessageId }
// and writes a NotificationLog. When no SMS provider is configured
// sendSms returns ok=false with provider='manual', which we surface
// as 'provider_setup_required' on the campaign.
//
// Email dispatch has no SMTP/SendGrid client wired in this codebase.
// Until an operator adds the credentials AND the adapter the email
// channel stays in 'provider_setup_required' status. We do NOT mark
// anything as 'sent' for email.

import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { sendSms } from '@/lib/sms/service';
import { isEmailProviderConfigured } from './email-provider';

interface DispatchResult {
  campaignId: string;
  status: 'sent' | 'partial' | 'failed' | 'provider_setup_required';
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  providerStatus: string | null;
}

async function resolveAudience(campaign: { audience: string; channel: string }): Promise<Array<{ userId: string | null; phone: string | null; email: string | null }>> {
  const channel = campaign.channel;
  if (campaign.audience === 'depositors') {
    const depositorIds = (
      await db.deposit.findMany({
        where: { status: 'approved' },
        distinct: ['userId'],
        select: { userId: true },
      })
    ).map((r) => r.userId);
    const rows = await db.user.findMany({
      where: { id: { in: depositorIds } },
      select: { id: true, phone: true, email: true },
    });
    return rows.map((u) => ({ userId: u.id, phone: u.phone ?? null, email: u.email ?? null }));
  }
  if (campaign.audience === 'with_phone') {
    const rows = await db.user.findMany({ where: { NOT: { phone: '' } }, select: { id: true, phone: true } });
    return rows.map((u) => ({ userId: u.id, phone: u.phone, email: null }));
  }
  if (campaign.audience === 'with_email') {
    const rows = await db.user.findMany({ where: { email: { not: null } }, select: { id: true, phone: true, email: true } });
    return rows.map((u) => ({ userId: u.id, phone: u.phone ?? null, email: u.email ?? null }));
  }
  if (campaign.audience === 'active') {
    const rows = await db.user.findMany({ where: { status: 'active' }, select: { id: true, phone: true, email: true } });
    return rows.map((u) => ({ userId: u.id, phone: u.phone ?? null, email: u.email ?? null }));
  }
  if (campaign.audience === 'selected') {
    // Selected audience is loaded from already-stored CampaignRecipient rows.
    return [];
  }
  // all
  const rows = await db.user.findMany({ select: { id: true, phone: true, email: true } });
  return rows.map((u) => ({ userId: u.id, phone: u.phone ?? null, email: u.email ?? null }));
}

export async function materialiseRecipients(campaignId: string, recipients: Array<{ userId: string | null; phone: string | null; email: string | null }>): Promise<number> {
  if (recipients.length === 0) return 0;
  const CHUNK = 500;
  let total = 0;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const slice = recipients.slice(i, i + CHUNK);
    const result = await db.campaignRecipient.createMany({
      data: slice.map((r) => ({
        campaignId,
        userId: r.userId,
        phone: r.phone,
        email: r.email,
        status: 'queued',
      })),
      skipDuplicates: true,
    });
    total += result.count;
  }
  return total;
}

export async function dispatchCampaign(campaignId: string): Promise<DispatchResult> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');

  // For non-selected audiences, materialise recipients now if the
  // campaign has no rows yet. Selected campaigns assume the operator
  // already populated the CampaignRecipient rows via the admin UI.
  let existingCount = await db.campaignRecipient.count({ where: { campaignId } });
  if (existingCount === 0 && campaign.audience !== 'selected') {
    const audience = await resolveAudience(campaign);
    existingCount = await materialiseRecipients(campaignId, audience);
  }

  const recipients = await db.campaignRecipient.findMany({
    where: { campaignId, status: { in: ['queued', 'failed'] } },
    take: 5000,
  });

  if (recipients.length === 0) {
    return {
      campaignId,
      status: 'sent',
      recipientCount: existingCount,
      sentCount: existingCount,
      failedCount: 0,
      providerStatus: null,
    };
  }

  let sent = 0;
  let failed = 0;
  let providerStatus: string | null = null;
  let allUnconfigured = true;

  if (campaign.channel === 'email') {
    const emailReady = isEmailProviderConfigured();
    if (!emailReady) {
      await db.campaign.update({
        where: { id: campaignId },
        data: { status: 'provider_setup_required', providerStatus: 'email_provider_missing' },
      });
      await db.campaignRecipient.updateMany({
        where: { campaignId, status: { in: ['queued', 'failed'] } },
        data: { status: 'provider_setup_required' },
      });
      return {
        campaignId,
        status: 'provider_setup_required',
        recipientCount: existingCount,
        sentCount: 0,
        failedCount: 0,
        providerStatus: 'email_provider_missing',
      };
    }
    // No real email adapter is wired in this codebase. Keep rows
    // queued and signal upstream that wiring is still required.
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: 'provider_setup_required', providerStatus: 'email_adapter_missing' },
    });
    return {
      campaignId,
      status: 'provider_setup_required',
      recipientCount: existingCount,
      sentCount: 0,
      failedCount: 0,
      providerStatus: 'email_adapter_missing',
    };
  }

  // SMS dispatch path.
  for (const r of recipients) {
    if (!r.phone) {
      await db.campaignRecipient.update({
        where: { id: r.id },
        data: { status: 'failed', error: 'NO_PHONE' },
      });
      failed += 1;
      continue;
    }
    const res = await sendSms({
      phone: r.phone,
      body: campaign.body,
      template: campaign.title,
      userId: r.userId,
      triggerKey: 'campaign',
      meta: { campaignId: campaign.id } as Prisma.JsonObject,
    });
    if (res.ok) {
      allUnconfigured = false;
      sent += 1;
      await db.campaignRecipient.update({
        where: { id: r.id },
        data: {
          status: 'sent',
          providerMessageId: res.ref ?? null,
          sentAt: new Date(),
          error: null,
        },
      });
    } else {
      if (res.provider !== 'manual') allUnconfigured = false;
      failed += 1;
      await db.campaignRecipient.update({
        where: { id: r.id },
        data: {
          status: 'failed',
          error: res.errorCode ?? 'SEND_FAILED',
        },
      });
    }
  }

  if (allUnconfigured) {
    providerStatus = 'sms_provider_missing';
  }
  const finalStatus: DispatchResult['status'] = allUnconfigured
    ? 'provider_setup_required'
    : failed === 0
      ? 'sent'
      : sent === 0
        ? 'failed'
        : 'partial';

  const allCounts = await db.campaignRecipient.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(allCounts.map((c) => [c.status, c._count._all]));
  const totalSent = counts.sent ?? 0;
  const totalFailed = counts.failed ?? 0;
  const totalRecipients = Object.values(counts).reduce((acc, n) => acc + n, 0);

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      status: finalStatus,
      providerStatus,
      sentCount: totalSent,
      failedCount: totalFailed,
      recipientCount: totalRecipients,
      sentAt: new Date(),
    },
  });

  return {
    campaignId,
    status: finalStatus,
    recipientCount: totalRecipients,
    sentCount: totalSent,
    failedCount: totalFailed,
    providerStatus,
  };
}
