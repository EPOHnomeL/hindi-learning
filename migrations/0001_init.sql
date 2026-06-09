-- Hub schema (Neon / Postgres). Mirrors the HubRepository port in
-- src/hub/repository.ts. Referential integrity is intentionally NOT enforced
-- with FK constraints in v1 so the shared contract tests can exercise each
-- aggregate in isolation without seeding a full graph; the app layer owns
-- integrity. `user_id` scoping is carried throughout per ADR-0004.

create table if not exists users (
  id text primary key
);

create table if not exists topics (
  id text primary key,
  user_id text not null,
  title text not null,
  mission text not null default ''
);

create table if not exists lessons (
  id text primary key,
  topic_id text not null,
  seq integer not null,
  title text not null,
  r2_key text not null,
  superseded_by text
);

-- "Reference" in the glossary; table named to avoid the SQL keyword and the
-- glossary-avoided word "doc".
create table if not exists topic_references (
  id text primary key,
  topic_id text not null,
  title text not null,
  r2_key text not null,
  content_hash text not null
);

create table if not exists responses (
  id text primary key,
  lesson_id text not null,
  prompt_id text not null,
  kind text not null,
  value text not null,
  correctness boolean,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id text primary key,
  lesson_id text not null,
  text text not null,
  state text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists replies (
  question_id text primary key,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists progress (
  user_id text not null,
  lesson_id text not null,
  state text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
