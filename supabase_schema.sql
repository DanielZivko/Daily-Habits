-- Enable Row Level Security
alter default privileges in schema public grant all on tables to postgres, anon, authenticated;

-- Create Groups Table
create table public.cloud_groups (
  user_id uuid references auth.users not null,
  id bigint not null, -- Mapped from Dexie ID
  title text not null,
  icon text,
  color text,
  "order" integer,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  
  primary key (user_id, id)
);

-- Create Tasks Table
create table public.cloud_tasks (
  user_id uuid references auth.users not null,
  id bigint not null, -- Mapped from Dexie ID
  title text not null,
  description text,
  "groupId" bigint, -- Note the quotes to match JSON/JS property if needed, but snake_case is better in SQL. I will map it in JS.
  status boolean default false,
  date timestamp with time zone,
  type text,
  frequency text,
  interval integer,
  "lastCompletedDate" timestamp with time zone,
  measures jsonb, -- Stores the complex object array
  "currentProgress" numeric,
  "targetProgress" numeric,
  unit text,
  deadline timestamp with time zone,
  "colorTag" text,
  tags text[],
  updated_at timestamp with time zone default timezone('utc'::text, now()),

  primary key (user_id, id)
);

-- Enable RLS
alter table public.cloud_groups enable row level security;
alter table public.cloud_tasks enable row level security;

-- Policies for Groups
create policy "Users can view their own groups"
  on public.cloud_groups for select
  using (auth.uid() = user_id);

create policy "Users can insert their own groups"
  on public.cloud_groups for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own groups"
  on public.cloud_groups for update
  using (auth.uid() = user_id);

create policy "Users can delete their own groups"
  on public.cloud_groups for delete
  using (auth.uid() = user_id);

-- Policies for Tasks
create policy "Users can view their own tasks"
  on public.cloud_tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own tasks"
  on public.cloud_tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tasks"
  on public.cloud_tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete their own tasks"
  on public.cloud_tasks for delete
  using (auth.uid() = user_id);





