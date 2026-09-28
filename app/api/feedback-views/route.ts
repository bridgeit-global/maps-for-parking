import { NextResponse } from 'next/server';
import { sendPendingViewMail } from '@/app/lib/feedback-mail';
import { createClient } from '@/app/lib/supabase/server';

const TARGETS = new Set(['feature', 'tow', 'suggestion']);

export async function POST(request: Request) {
  let body: { targetType?: string; targetId?: string; viewerKey?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ counted: false }, { status: 400 });
  }

  const targetType = body.targetType ?? '';
  const targetId = (body.targetId ?? '').trim();
  const viewerKey = (body.viewerKey ?? '').trim();
  if (!TARGETS.has(targetType) || !targetId || targetId.length > 200) {
    return NextResponse.json({ counted: false }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('record_feedback_view', {
      p_target_type: targetType,
      p_target_id: targetId,
      p_viewer_key: viewerKey
    });
    if (error) {
      console.error('Could not record a feedback view', error.message);
      return NextResponse.json({ counted: false });
    }
    await sendPendingViewMail(new URL(request.url).origin);
    const counted = Boolean(data && typeof data === 'object' && 'counted' in data && data.counted);
    return NextResponse.json({ counted });
  } catch (err) {
    console.error('Could not record a feedback view', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ counted: false });
  }
}
