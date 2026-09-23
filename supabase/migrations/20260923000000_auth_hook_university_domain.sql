-- Auth Hook "before user created": rechaza el registro si el dominio del
-- correo no pertenece a ninguna universidad de `universities`. Se conecta
-- como el hook de Supabase Auth en supabase/config.toml (local) y en
-- Authentication > Hooks del dashboard (proyecto hosteado).
create or replace function public.auth_hook_check_university_domain(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  user_email text;
  user_email_domain text;
  domain_is_registered boolean;
begin
  user_email := event->'user'->>'email';

  if user_email is null or position('@' in user_email) = 0 then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'No pudimos verificar ese correo.',
        'http_code', 400
      )
    );
  end if;

  user_email_domain := lower(split_part(user_email, '@', 2));

  select exists (
    select 1
    from public.universities
    where public.universities.email_domain = user_email_domain
  ) into domain_is_registered;

  if not domain_is_registered then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Ese dominio de correo no está habilitado todavía. Si tu universidad no aparece, pedinos que la agreguemos.',
        'http_code', 403
      )
    );
  end if;

  return jsonb_build_object();
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant select on public.universities to supabase_auth_admin;
grant execute on function public.auth_hook_check_university_domain to supabase_auth_admin;
revoke execute on function public.auth_hook_check_university_domain from authenticated, anon, public;
