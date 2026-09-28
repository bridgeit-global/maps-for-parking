import { NextResponse } from 'next/server';
import { readUnsubscribeToken } from '@/app/lib/feedback-mail';
import { createAdminClient } from '@/app/lib/supabase/admin';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const userId = readUnsubscribeToken(token);
  const admin = createAdminClient();
  let done = false;
  if (userId && admin) {
    const { error } = await admin.from('contributor_email_prefs').upsert(
      { user_id: userId, unsubscribed_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    done = !error;
  }

  const title = done ? 'You are unsubscribed' : 'This unsubscribe link is not valid';
  const body = done
    ? 'We will stop sending notes when people view your parking checks. Your checks stay on the map.'
    : 'Open the latest email and use that unsubscribe link.';
  return new NextResponse(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:Georgia,serif;margin:3rem auto;max-width:32rem;padding:0 1.25rem;color:#1c1917"><h1 style="font-size:1.75rem">${title}</h1><p>${body}</p><p><a href="/">Back to the map</a></p></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}
