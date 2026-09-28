import { createClient } from './supabase/client';

export const LEVELS = [
  { name: 'Spotter', min: 0 },
  { name: 'Local', min: 40 },
  { name: 'Marshal', min: 120 },
  { name: 'Warden', min: 280 }
] as const;

const BADGE_DEFS = [
  { id: 'first_check', name: 'First check', hint: 'Confirm or report a spot' },
  { id: 'sharp_eye', name: 'Sharp eye', hint: 'Report a wrong rule or a missing board' },
  { id: 'proof', name: 'Proof', hint: 'Add a photo to a check' },
  { id: 'tow_watch', name: 'Tow watch', hint: 'Report a tow crew' },
  { id: 'new_spot', name: 'New spot', hint: 'Suggest a parking spot' },
  { id: 'it_helped', name: 'It helped', hint: 'Have a report marked fixed or a spot approved' },
  { id: 'ten_streets', name: 'Ten streets', hint: 'Check ten different places' },
  { id: 'regular', name: 'Regular', hint: 'Contribute on three different days' }
] as const;

export type BadgeId = (typeof BADGE_DEFS)[number]['id'];

export interface ContributorBadge {
  id: BadgeId;
  name: string;
  hint: string;
  earned: boolean;
}

export interface ContributorProgress {
  points: number;
  level: string;
  nextLevel: string | null;
  floor: number;
  nextAt: number | null;
  viewCount: number;
  badges: ContributorBadge[];
}

interface ContributorEventRow {
  event: string;
  points: number;
  source_id: string;
  detail: string | null;
  created_at: string;
}

const VIEWER_KEY = 'mfp_viewer';

export function levelProgress(points: number): Pick<
  ContributorProgress,
  'level' | 'nextLevel' | 'floor' | 'nextAt'
> {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const level of LEVELS) {
    if (points >= level.min) current = level;
  }
  const next = LEVELS.find((level) => level.min > current.min) ?? null;
  return {
    level: current.name,
    nextLevel: next?.name ?? null,
    floor: current.min,
    nextAt: next?.min ?? null
  };
}

function badgeEarned(id: BadgeId, rows: ContributorEventRow[]): boolean {
  if (id === 'first_check') return rows.some((row) => row.event === 'validation_submit');
  if (id === 'sharp_eye') {
    return rows.some(
      (row) =>
        row.event === 'validation_submit' &&
        (row.detail === 'rule_wrong' || row.detail === 'board_missing')
    );
  }
  if (id === 'proof') return rows.some((row) => row.event === 'photo');
  if (id === 'tow_watch') return rows.some((row) => row.event === 'tow_submit');
  if (id === 'new_spot') return rows.some((row) => row.event === 'suggestion_submit');
  if (id === 'it_helped') {
    return rows.some((row) => row.event === 'review_fixed' || row.event === 'suggestion_approved');
  }
  if (id === 'ten_streets') {
    const features = new Set(
      rows.filter((row) => row.event === 'validation_submit').map((row) => row.source_id)
    );
    return features.size >= 10;
  }
  const days = new Set(rows.map((row) => row.created_at.slice(0, 10)));
  return days.size >= 3;
}

export function progressFromRows(
  rows: ContributorEventRow[],
  viewCount: number
): ContributorProgress {
  const points = rows.reduce((sum, row) => sum + row.points, 0);
  return {
    points,
    viewCount,
    ...levelProgress(points),
    badges: BADGE_DEFS.map((badge) => ({
      ...badge,
      earned: badgeEarned(badge.id, rows)
    }))
  };
}

export function formatCredit(
  before: ContributorProgress | null,
  after: ContributorProgress | null
): string | null {
  if (!after) return null;
  const previousPoints = before?.points ?? 0;
  const delta = after.points - previousPoints;
  const previous = new Set((before?.badges ?? []).filter((badge) => badge.earned).map((badge) => badge.id));
  const unlocked = after.badges.find((badge) => badge.earned && !previous.has(badge.id));
  if (delta <= 0 && !unlocked) return null;
  const points = delta > 0 ? `+${delta} · ${after.level} · ${after.points}` : `${after.level} · ${after.points}`;
  return unlocked ? `${points} · ${unlocked.name}` : points;
}

export function notifyContributorProgress() {
  window.dispatchEvent(new Event('contributor-progress'));
}

export async function loadContributorProgress(): Promise<ContributorProgress | null> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [eventsResult, viewsResult] = await Promise.all([
    supabase
      .from('contributor_events')
      .select('event, points, source_id, detail, created_at')
      .eq('user_id', auth.user.id),
    supabase
      .from('contributor_view_totals')
      .select('view_count')
      .eq('user_id', auth.user.id)
      .maybeSingle()
  ]);
  if (eventsResult.error) return null;
  const rows = (eventsResult.data ?? []) as ContributorEventRow[];
  const viewCount =
    viewsResult.data && typeof viewsResult.data.view_count === 'number' ? viewsResult.data.view_count : 0;
  return progressFromRows(rows, viewCount);
}

export function viewerKey(): string {
  const existing = window.localStorage.getItem(VIEWER_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(VIEWER_KEY, created);
  return created;
}

export function recordFeedbackView(
  targetType: 'feature' | 'tow' | 'suggestion',
  targetId: string
): void {
  const id = targetId.trim();
  if (!id) return;
  void fetch('/api/feedback-views', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
    body: JSON.stringify({ targetType, targetId: id, viewerKey: viewerKey() })
  }).catch(() => undefined);
}
