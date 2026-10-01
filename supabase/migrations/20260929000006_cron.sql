-- Scheduled jobs (pg_cron) and calls back to Next.js (pg_net)
-- Needs the pg_cron and pg_net extensions (Supabase: Database → Extensions).
-- After deploying, set the site URL and shared secret (same as REVALIDATE_SECRET on Vercel):
--   insert into private.app_config (key, value) values
--     ('site_url', 'https://thefragrancestore.lk'), ('revalidate_secret', '<long random string>')
--   on conflict (key) do update set value = excluded.value;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- POST to a Next.js route with the shared secret (no-op until configured)
create or replace function private.call_site(p_path text, p_body jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text := private.app_config_value('site_url');
  v_secret text := private.app_config_value('revalidate_secret');
begin
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || p_path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-revalidate-secret', v_secret),
    body := p_body
  );
end;
$$;

-- Every 5 minutes: find content that started or ended since the last run and refresh pages
create or replace function public.cms_schedule_tick()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_last timestamptz;
  v_now timestamptz := now();
  v_paths text[] := '{}';
  v_tags text[] := '{}';
  r record;
begin
  select value into v_last from private.cron_state where key = 'cms_tick';
  v_last := coalesce(v_last, v_now - interval '5 minutes');

  if exists (select 1 from public.hero_banners where starts_at > v_last and starts_at <= v_now or ends_at > v_last and ends_at <= v_now)
     or exists (select 1 from public.home_sections where starts_at > v_last and starts_at <= v_now or ends_at > v_last and ends_at <= v_now)
     or exists (select 1 from public.announcements where starts_at > v_last and starts_at <= v_now or ends_at > v_last and ends_at <= v_now) then
    v_tags := v_tags || array['cms'];
    v_paths := v_paths || array['/'];
  end if;

  for r in select slug from public.promotions
            where starts_at > v_last and starts_at <= v_now or ends_at > v_last and ends_at <= v_now loop
    v_tags := v_tags || array['catalog', 'cms'];
    v_paths := v_paths || array['/promotions/' || r.slug];
  end loop;

  for r in select slug from public.bundles
            where starts_at > v_last and starts_at <= v_now or ends_at > v_last and ends_at <= v_now loop
    v_tags := v_tags || array['catalog', 'bundles'];
    v_paths := v_paths || array['/bundle/' || r.slug, '/bundles'];
  end loop;

  insert into private.cron_state (key, value) values ('cms_tick', v_now)
  on conflict (key) do update set value = excluded.value;

  if cardinality(v_tags) > 0 then
    perform private.call_site('/api/revalidate', jsonb_build_object(
      'tags', (select to_jsonb(array_agg(distinct t)) from unnest(v_tags) t),
      'paths', (select to_jsonb(array_agg(distinct p)) from unnest(v_paths) p)));
  end if;
  return jsonb_build_object('tags', v_tags, 'paths', v_paths);
end;
$$;
revoke execute on function public.cms_schedule_tick() from public, anon, authenticated;

-- Kick the email route whenever emails are waiting
create or replace function public.email_tick()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.email_outbox where status = 'pending' or (status = 'failed' and attempts < 3)) then
    perform private.call_site('/api/emails/process', '{}'::jsonb);
  end if;
end;
$$;
revoke execute on function public.email_tick() from public, anon, authenticated;

select cron.schedule('fs-cms-schedule-tick', '*/5 * * * *', $$select public.cms_schedule_tick()$$);
select cron.schedule('fs-process-overdue-orders', '7 * * * *', $$select public.process_overdue_orders()$$);
select cron.schedule('fs-email-tick', '* * * * *', $$select public.email_tick()$$);
