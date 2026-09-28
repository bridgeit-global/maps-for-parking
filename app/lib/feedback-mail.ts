import { createHmac, timingSafeEqual } from 'crypto';
import nodemailer from 'nodemailer';
import { createAdminClient } from './supabase/admin';

const FROM = 'Maps for Parking <support@parkourai.com>';

function mailSecret(): string | null {
  return process.env.SUPABASE_SECRET_KEY || null;
}

export function unsubscribeToken(userId: string): string | null {
  const secret = mailSecret();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 180;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function readUnsubscribeToken(token: string): string | null {
  const secret = mailSecret();
  const [payload, sig] = token.split('.');
  if (!secret || !payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      uid?: string;
      exp?: number;
    };
    if (!parsed.uid || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

function smtpReady(): boolean {
  return Boolean(process.env.SMTP_PASSWORD);
}

function messageHtml(origin: string, viewCount: number, unsubscribeUrl: string): string {
  const see = `${origin}/?progress=1`;
  const map = `${origin}/`;
  return `<div style="font-family:Georgia,serif;color:#1c1917;max-width:32rem;margin:0 auto;padding:24px">
  <p style="font-size:28px;line-height:1.25;margin:0">Your checks are helping in a big way</p>
  <p style="margin:20px 0"><a href="${see}" style="color:#1d4ed8">See your contributions</a></p>
  <p style="font-size:16px;line-height:1.5">Congrats. Your parking checks just reached a new milestone. Together, they have been viewed over ${viewCount.toLocaleString('en-US')} times, helping other drivers get the information they needed.</p>
  <p style="margin:20px 0"><a href="${map}" style="color:#1d4ed8">Contribute more</a></p>
  <p style="margin-top:32px;font-size:12px;line-height:1.5;color:#57534e">You received this email because you submitted parking information on Maps for Parking. <a href="${unsubscribeUrl}" style="color:#57534e">Unsubscribe</a> if you do not want these updates. Unsubscribing does not delete your checks.</p>
</div>`;
}

export async function sendPendingViewMail(origin: string): Promise<void> {
  if (!smtpReady()) return;
  const admin = createAdminClient();
  if (!admin) return;

  const { data: pending } = await admin
    .from('feedback_view_mail')
    .select('id, user_id, milestone, view_count')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(20);
  if (!pending || pending.length === 0) return;

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'support@parkourai.com',
      pass: process.env.SMTP_PASSWORD
    }
  });

  for (const row of pending) {
    const { data: pref } = await admin
      .from('contributor_email_prefs')
      .select('unsubscribed_at')
      .eq('user_id', row.user_id)
      .maybeSingle();
    if (pref?.unsubscribed_at) {
      await markSent(admin, row.user_id, row.id, row.milestone);
      continue;
    }

    const token = unsubscribeToken(row.user_id);
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(row.user_id);
    const email = userResult.user?.email;
    if (!token || userError || !email) continue;

    const unsubscribeUrl = `${origin}/api/feedback-emails/unsubscribe?token=${encodeURIComponent(token)}`;
    const viewed = row.view_count.toLocaleString('en-US');
    try {
      await transport.sendMail({
        from: FROM,
        to: email,
        replyTo: 'support@parkourai.com',
        subject: 'A lot of people are seeing your parking checks.',
        text: [
          'Your checks are helping in a big way.',
          '',
          `Congrats. Your parking checks just reached a new milestone. Together, they have been viewed over ${viewed} times, helping other drivers get the information they needed.`,
          '',
          `See your contributions: ${origin}/?progress=1`,
          `Contribute more: ${origin}/`,
          '',
          `Unsubscribe: ${unsubscribeUrl}`
        ].join('\n'),
        html: messageHtml(origin, row.view_count, unsubscribeUrl)
      });
      await markSent(admin, row.user_id, row.id, row.milestone);
    } catch (err) {
      console.error('Could not send a view milestone email', err instanceof Error ? err.message : 'unknown error');
    }
  }
}

async function markSent(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  mailId: string,
  milestone: number
) {
  const sentAt = new Date().toISOString();
  await admin.from('feedback_view_mail').update({ sent_at: sentAt }).eq('id', mailId).is('sent_at', null);
  await admin
    .from('contributor_milestones')
    .update({ emailed_at: sentAt })
    .eq('user_id', userId)
    .lte('milestone', milestone)
    .is('emailed_at', null);
}
