-- Contributor points, private view totals, and occasional milestone mail.
-- parking_corrections is a view over problem reports, so it has no trigger.

create table public.contributor_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null check (
    event in (
      'validation_submit',
      'photo',
      'tow_submit',
      'suggestion_submit',
      'review_fixed',
      'suggestion_approved'
    )
  ),
  points integer not null check (points > 0),
  source_table text not null,
  source_id text not null,
  detail text,
  created_at timestamptz not null default now(),
  unique (user_id, event, source_table, source_id)
);

create index contributor_events_user_id_idx on public.contributor_events (user_id, created_at);

create table public.contributor_view_totals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  view_count integer not null default 0 check (view_count >= 0),
  updated_at timestamptz not null default now()
);

create table public.feedback_views (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('feature', 'tow', 'suggestion')),
  target_id text not null,
  viewer_key text not null,
  viewed_on date not null,
  created_at timestamptz not null default now(),
  unique (target_type, target_id, viewer_key, viewed_on)
);

create index feedback_views_viewer_day_idx on public.feedback_views (viewer_key, viewed_on);

create table public.contributor_milestones (
  user_id uuid not null references auth.users (id) on delete cascade,
  milestone integer not null check (milestone > 0),
  reached_at timestamptz not null default now(),
  emailed_at timestamptz,
  primary key (user_id, milestone)
);

create table public.feedback_view_mail (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  milestone integer not null,
  view_count integer not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create unique index feedback_view_mail_one_pending
  on public.feedback_view_mail (user_id)
  where sent_at is null;

create table public.contributor_email_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  unsubscribed_at timestamptz
);

alter table public.contributor_events enable row level security;
alter table public.contributor_view_totals enable row level security;
alter table public.feedback_views enable row level security;
alter table public.contributor_milestones enable row level security;
alter table public.feedback_view_mail enable row level security;
alter table public.contributor_email_prefs enable row level security;

create policy "read own contributor events"
  on public.contributor_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "read own view total"
  on public.contributor_view_totals
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.contributor_events from public, anon, authenticated;
revoke all on table public.contributor_view_totals from public, anon, authenticated;
revoke all on table public.feedback_views from public, anon, authenticated;
revoke all on table public.contributor_milestones from public, anon, authenticated;
revoke all on table public.feedback_view_mail from public, anon, authenticated;
revoke all on table public.contributor_email_prefs from public, anon, authenticated;

grant select on table public.contributor_events to authenticated;
grant select on table public.contributor_view_totals to authenticated;
grant all on table public.contributor_events to service_role;
grant all on table public.contributor_view_totals to service_role;
grant all on table public.feedback_views to service_role;
grant all on table public.contributor_milestones to service_role;
grant all on table public.feedback_view_mail to service_role;
grant all on table public.contributor_email_prefs to service_role;

create or replace function private.award_contributor_event(
  p_user_id uuid,
  p_event text,
  p_points integer,
  p_source_table text,
  p_source_id text,
  p_detail text,
  p_daily_cap integer,
  p_created_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_daily_cap is not null and (
    select count(*)
    from public.contributor_events
    where user_id = p_user_id
      and event = p_event
      and created_at >= (date_trunc('day', timezone('utc', now())) at time zone 'utc')
  ) >= p_daily_cap then
    return;
  end if;

  insert into public.contributor_events (
    user_id, event, points, source_table, source_id, detail, created_at
  ) values (
    p_user_id,
    p_event,
    p_points,
    p_source_table,
    p_source_id,
    p_detail,
    coalesce(p_created_at, now())
  )
  on conflict (user_id, event, source_table, source_id) do nothing;
end;
$$;

create or replace function private.award_validation_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform private.award_contributor_event(
      new.user_id,
      'validation_submit',
      case when new.kind = 'confirm' then 5 else 10 end,
      'parking_validations',
      new.feature_id,
      new.kind,
      null,
      null
    );
    if new.photo_path is not null and length(btrim(new.photo_path)) > 0 then
      perform private.award_contributor_event(
        new.user_id, 'photo', 5, 'parking_validations', new.feature_id, null, null, null
      );
    end if;
  elsif tg_op = 'UPDATE'
    and new.photo_path is not null
    and length(btrim(new.photo_path)) > 0
    and (old.photo_path is null or length(btrim(old.photo_path)) = 0)
  then
    perform private.award_contributor_event(
      new.user_id, 'photo', 5, 'parking_validations', new.feature_id, null, null, null
    );
  end if;
  return new;
end;
$$;

create or replace function private.award_tow_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.award_contributor_event(
    new.user_id, 'tow_submit', 5, 'tow_alerts', new.id::text, null, 3, null
  );
  return new;
end;
$$;

create or replace function private.award_suggestion_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform private.award_contributor_event(
      new.user_id, 'suggestion_submit', 10, 'parking_suggestions', new.id::text, null, 5, null
    );
  end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    perform private.award_contributor_event(
      new.user_id, 'suggestion_approved', 25, 'parking_suggestions', new.id::text, null, null, null
    );
  end if;
  return new;
end;
$$;

create or replace function private.award_review_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
begin
  if new.status = 'fixed' and (tg_op = 'INSERT' or old.status is distinct from 'fixed') then
    select user_id into author_id
    from public.parking_validations
    where id = new.validation_id;
    if author_id is not null then
      perform private.award_contributor_event(
        author_id, 'review_fixed', 20, 'validation_reviews', new.validation_id::text, null, null, null
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.queue_view_milestone(p_user_id uuid, p_count integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  milestone_value integer;
begin
  insert into public.contributor_milestones (user_id, milestone)
  select p_user_id, milestone
  from unnest(array[10, 50, 100, 500, 1000, 5000, 10000]) as milestone
  where milestone <= p_count
  on conflict (user_id, milestone) do nothing;

  if exists (
    select 1
    from public.contributor_email_prefs
    where user_id = p_user_id
      and unsubscribed_at is not null
  ) then
    return;
  end if;

  select max(milestone) into milestone_value
  from public.contributor_milestones
  where user_id = p_user_id
    and emailed_at is null;

  if milestone_value is null then
    return;
  end if;

  update public.feedback_view_mail
  set milestone = milestone_value,
      view_count = p_count
  where user_id = p_user_id
    and sent_at is null;

  if found then
    return;
  end if;

  if exists (
    select 1
    from public.feedback_view_mail
    where user_id = p_user_id
      and sent_at > now() - interval '14 days'
  ) then
    return;
  end if;

  insert into public.feedback_view_mail (user_id, milestone, view_count)
  values (p_user_id, milestone_value, p_count);
end;
$$;

create or replace function private.record_feedback_view(
  p_target_type text,
  p_target_id text,
  p_viewer_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid;
  v_viewer_key text;
  authors uuid[];
  author_id uuid;
  inserted_id uuid;
  next_count integer;
begin
  if p_target_type not in ('feature', 'tow', 'suggestion')
    or p_target_id is null
    or length(btrim(p_target_id)) = 0
    or length(p_target_id) > 200
  then
    return jsonb_build_object('counted', false);
  end if;

  viewer := auth.uid();
  if viewer is not null then
    v_viewer_key := 'user:' || viewer::text;
  elsif p_viewer_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_viewer_key := 'anon:' || lower(p_viewer_key);
  else
    return jsonb_build_object('counted', false);
  end if;

  if (
    select count(*)
    from public.feedback_views
    where feedback_views.viewer_key = v_viewer_key
      and viewed_on = (timezone('utc', now()))::date
  ) >= 200 then
    return jsonb_build_object('counted', false);
  end if;

  if p_target_type = 'feature' then
    select coalesce(array_agg(distinct user_id), '{}')
    into authors
    from public.parking_validations
    where feature_id = p_target_id
      and (viewer is null or user_id <> viewer);
  elsif p_target_type = 'tow' then
    begin
      select coalesce(array_agg(user_id), '{}')
      into authors
      from public.tow_alerts
      where id = p_target_id::uuid
        and (viewer is null or user_id <> viewer);
    exception
      when invalid_text_representation then
        return jsonb_build_object('counted', false);
    end;
  else
    begin
      select coalesce(array_agg(user_id), '{}')
      into authors
      from public.parking_suggestions
      where id = p_target_id::uuid
        and status = 'approved'
        and (viewer is null or user_id <> viewer);
    exception
      when invalid_text_representation then
        return jsonb_build_object('counted', false);
    end;
  end if;

  if authors is null or cardinality(authors) = 0 then
    return jsonb_build_object('counted', false);
  end if;

  insert into public.feedback_views (target_type, target_id, viewer_key, viewed_on)
  values (p_target_type, p_target_id, v_viewer_key, (timezone('utc', now()))::date)
  on conflict (target_type, target_id, viewer_key, viewed_on) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    return jsonb_build_object('counted', false);
  end if;

  foreach author_id in array authors loop
    insert into public.contributor_view_totals (user_id, view_count)
    values (author_id, 1)
    on conflict (user_id) do update
      set view_count = public.contributor_view_totals.view_count + 1,
          updated_at = now()
      returning view_count into next_count;

    perform private.queue_view_milestone(author_id, next_count);
  end loop;

  return jsonb_build_object('counted', true);
end;
$$;

create or replace function public.record_feedback_view(
  p_target_type text,
  p_target_id text,
  p_viewer_key text
) returns jsonb
language sql
security invoker
set search_path = public
as $$
  select private.record_feedback_view(p_target_type, p_target_id, p_viewer_key);
$$;

revoke all on function private.award_contributor_event(uuid, text, integer, text, text, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function private.award_validation_feedback() from public, anon, authenticated;
revoke all on function private.award_tow_feedback() from public, anon, authenticated;
revoke all on function private.award_suggestion_feedback() from public, anon, authenticated;
revoke all on function private.award_review_feedback() from public, anon, authenticated;
revoke all on function private.queue_view_milestone(uuid, integer) from public, anon, authenticated;
revoke all on function private.record_feedback_view(text, text, text) from public, anon, authenticated;
revoke all on function public.record_feedback_view(text, text, text) from public;

grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.record_feedback_view(text, text, text) to anon, authenticated, service_role;
grant execute on function public.record_feedback_view(text, text, text) to anon, authenticated, service_role;

drop trigger if exists award_validation_feedback on public.parking_validations;
create trigger award_validation_feedback
  after insert or update of photo_path on public.parking_validations
  for each row execute function private.award_validation_feedback();

drop trigger if exists award_tow_feedback on public.tow_alerts;
create trigger award_tow_feedback
  after insert on public.tow_alerts
  for each row execute function private.award_tow_feedback();

drop trigger if exists award_suggestion_feedback on public.parking_suggestions;
create trigger award_suggestion_feedback
  after insert or update of status on public.parking_suggestions
  for each row execute function private.award_suggestion_feedback();

drop trigger if exists award_review_feedback on public.validation_reviews;
create trigger award_review_feedback
  after insert or update of status on public.validation_reviews
  for each row execute function private.award_review_feedback();

insert into public.contributor_events (user_id, event, points, source_table, source_id, detail, created_at)
select distinct on (user_id, feature_id)
  user_id,
  'validation_submit',
  case when kind = 'confirm' then 5 else 10 end,
  'parking_validations',
  feature_id,
  kind,
  created_at
from public.parking_validations
order by user_id, feature_id, created_at
on conflict (user_id, event, source_table, source_id) do nothing;

insert into public.contributor_events (user_id, event, points, source_table, source_id, detail, created_at)
select distinct on (user_id, feature_id)
  user_id,
  'photo',
  5,
  'parking_validations',
  feature_id,
  null,
  created_at
from public.parking_validations
where photo_path is not null
  and length(btrim(photo_path)) > 0
order by user_id, feature_id, created_at
on conflict (user_id, event, source_table, source_id) do nothing;

insert into public.contributor_events (user_id, event, points, source_table, source_id, detail, created_at)
select user_id, 'tow_submit', 5, 'tow_alerts', id::text, null, created_at
from (
  select
    id,
    user_id,
    created_at,
    row_number() over (
      partition by user_id, (created_at at time zone 'utc')::date
      order by created_at
    ) as day_rank
  from public.tow_alerts
) ranked
where day_rank <= 3
on conflict (user_id, event, source_table, source_id) do nothing;

insert into public.contributor_events (user_id, event, points, source_table, source_id, detail, created_at)
select user_id, 'suggestion_submit', 10, 'parking_suggestions', id::text, null, created_at
from (
  select
    id,
    user_id,
    created_at,
    row_number() over (
      partition by user_id, (created_at at time zone 'utc')::date
      order by created_at
    ) as day_rank
  from public.parking_suggestions
) ranked
where day_rank <= 5
on conflict (user_id, event, source_table, source_id) do nothing;

insert into public.contributor_events (user_id, event, points, source_table, source_id, detail, created_at)
select v.user_id, 'review_fixed', 20, 'validation_reviews', r.validation_id::text, null, r.updated_at
from public.validation_reviews r
join public.parking_validations v on v.id = r.validation_id
where r.status = 'fixed'
on conflict (user_id, event, source_table, source_id) do nothing;

insert into public.contributor_events (user_id, event, points, source_table, source_id, detail, created_at)
select user_id, 'suggestion_approved', 25, 'parking_suggestions', id::text, null, created_at
from public.parking_suggestions
where status = 'approved'
on conflict (user_id, event, source_table, source_id) do nothing;
