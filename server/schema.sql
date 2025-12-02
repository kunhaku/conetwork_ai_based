-- Core schema for nodes/edges/facts/crawl tasks
-- Execute in Supabase SQL editor or migration pipeline
create extension if not exists "pgcrypto";

-- 1) Nodes
create table if not exists public.nodes (
  id               uuid primary key default gen_random_uuid(),
  type             text not null,
  canonical_name   text not null,
  normalized_name  text not null,
  external_ids     jsonb default '{}'::jsonb,
  importance_score numeric default 0,
  first_seen_at    timestamptz not null default now(),
  last_crawled_at  timestamptz,
  updated_at       timestamptz not null default now(),
  unique (type, normalized_name)
);
create index if not exists idx_nodes_normalized_name on public.nodes (normalized_name);
create index if not exists idx_nodes_type_name on public.nodes (type, canonical_name);

-- 2) Node aliases
create table if not exists public.node_aliases (
  id         uuid primary key default gen_random_uuid(),
  node_id    uuid not null references public.nodes(id) on delete cascade,
  alias      text not null,
  created_at timestamptz not null default now(),
  unique (node_id, alias)
);
create index if not exists idx_node_alias_alias on public.node_aliases (alias);

-- 3) Sources
create table if not exists public.sources (
  id              uuid primary key default gen_random_uuid(),
  url             text not null unique,
  domain          text,
  content_hash    text,
  first_seen_at   timestamptz not null default now(),
  last_crawled_at timestamptz,
  status          text not null default 'active',
  metadata        jsonb default '{}'::jsonb
);
create index if not exists idx_sources_domain on public.sources (domain);

-- 4) Edges (relationships)
create table if not exists public.edges (
  id               uuid primary key default gen_random_uuid(),
  src_node_id      uuid not null references public.nodes(id) on delete cascade,
  dst_node_id      uuid not null references public.nodes(id) on delete cascade,
  relation_type    text not null,
  confidence_score numeric default 0.5 check (confidence_score between 0 and 1),
  valid_from       date,
  valid_to         date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_edges_dst_type on public.edges (dst_node_id, relation_type);
-- Expression-based uniqueness must be an index (not inline constraint)
create unique index if not exists uq_edges_unique_rel
  on public.edges (src_node_id, dst_node_id, relation_type, coalesce(valid_from, date '0001-01-01'));

-- 5) Edge sources
create table if not exists public.edge_sources (
  edge_id          uuid not null references public.edges(id) on delete cascade,
  source_id        uuid not null references public.sources(id) on delete cascade,
  evidence_snippet text,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  primary key (edge_id, source_id)
);

-- 6) Facts (node attributes)
create table if not exists public.facts (
  id               uuid primary key default gen_random_uuid(),
  node_id          uuid not null references public.nodes(id) on delete cascade,
  attribute        text not null,
  value_text       text,
  value_numeric    numeric,
  value_json       jsonb,
  unit             text,
  valid_from       date,
  valid_to         date,
  source_id        uuid references public.sources(id),
  confidence_score numeric default 0.5 check (confidence_score between 0 and 1),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (
    (value_text is not null)::int
  + (value_numeric is not null)::int
  + (value_json is not null)::int = 1
  )
);
create index if not exists idx_facts_node_attr_date on public.facts (node_id, attribute, valid_from);

-- 7) Crawl tasks
create table if not exists public.crawl_tasks (
  id            uuid primary key default gen_random_uuid(),
  node_id       uuid references public.nodes(id) on delete set null,
  source_id     uuid references public.sources(id) on delete set null,
  url           text,
  task_type     text not null,
  status        text not null default 'pending',
  priority      int not null default 0,
  scheduled_at  timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  error_message text
);
create index if not exists idx_crawl_tasks_status_priority
  on public.crawl_tasks (status, priority desc, scheduled_at asc);
