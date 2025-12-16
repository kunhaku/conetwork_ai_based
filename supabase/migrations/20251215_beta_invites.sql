create table if not exists public.beta_invites (
  email text primary key,
  code text not null,
  max_uses int not null default 1,
  used_count int not null default 0,
  expires_at timestamptz,
  is_revoked boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists beta_invites_code_key on public.beta_invites (code);

create or replace function public.set_beta_invites_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_beta_invites_updated_at on public.beta_invites;
create trigger trg_beta_invites_updated_at
before update on public.beta_invites
for each row
execute procedure public.set_beta_invites_updated_at();
