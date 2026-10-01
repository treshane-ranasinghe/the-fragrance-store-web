-- Google sign-in: new accounts created through Google get their name from the Google profile
-- (Google sends "full_name" and "name"; email/password sign-up sends "full_name").
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone, is_anonymous)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', '')),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
