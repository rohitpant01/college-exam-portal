-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (linked to auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null,
  role text not null default 'student' check (role in ('admin', 'student')),
  enrollment_no text,
  created_at timestamptz default now()
);

-- Subjects table
create table public.subjects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- Notes table
create table public.notes (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  subject_id uuid references public.subjects on delete set null,
  file_url text not null,
  file_name text not null,
  file_size bigint default 0,
  uploaded_by uuid references public.profiles on delete set null,
  created_at timestamptz default now()
);

-- Exams table
create table public.exams (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  subject_id uuid references public.subjects on delete set null,
  duration_minutes integer not null default 30,
  total_marks integer not null default 0,
  pass_marks integer not null default 0,
  is_published boolean default false,
  created_by uuid references public.profiles on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz default now()
);

-- Questions table
create table public.questions (
  id uuid default uuid_generate_v4() primary key,
  exam_id uuid references public.exams on delete cascade not null,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('a', 'b', 'c', 'd')),
  marks integer default 1,
  order_num integer default 0,
  explanation text
);

-- Exam attempts table
create table public.exam_attempts (
  id uuid default uuid_generate_v4() primary key,
  exam_id uuid references public.exams on delete cascade not null,
  student_id uuid references public.profiles on delete cascade not null,
  started_at timestamptz default now(),
  submitted_at timestamptz,
  score integer default 0,
  total_marks integer default 0,
  status text default 'in_progress' check (status in ('in_progress', 'completed'))
);

-- Exam responses table
create table public.exam_responses (
  id uuid default uuid_generate_v4() primary key,
  attempt_id uuid references public.exam_attempts on delete cascade not null,
  question_id uuid references public.questions on delete cascade not null,
  selected_option text,
  is_correct boolean default false
);

-- Row Level Security policies
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.notes enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_responses enable row level security;

-- Profiles: users can read all profiles, only update own
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Trigger to automatically insert a profile row when a new user signs up in auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, enrollment_no)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Student'),
    new.email,
    'student',
    new.raw_user_meta_data->>'enrollment_no'
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    enrollment_no = coalesce(excluded.enrollment_no, profiles.enrollment_no);
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Subjects: everyone can read, admin can manage
create policy "Subjects are viewable by everyone" on subjects for select using (true);
create policy "Admins can insert subjects" on subjects for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can update subjects" on subjects for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can delete subjects" on subjects for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Notes: everyone can read, admin can manage
create policy "Notes are viewable by everyone" on notes for select using (true);
create policy "Admins can insert notes" on notes for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can update notes" on notes for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can delete notes" on notes for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Exams: published exams visible to all, admin can manage all
create policy "Published exams visible to all" on exams for select using (true);
create policy "Admins can insert exams" on exams for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can update exams" on exams for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can delete exams" on exams for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Questions: viewable when taking exam, admin can manage
create policy "Questions viewable by authenticated" on questions for select using (auth.role() = 'authenticated');
create policy "Admins can insert questions" on questions for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can update questions" on questions for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can delete questions" on questions for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Exam attempts: students can read own, admins can read all
create policy "Users can view own attempts" on exam_attempts for select using (
  student_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Students can create attempts" on exam_attempts for insert with check (student_id = auth.uid());
create policy "Students can update own attempts" on exam_attempts for update using (student_id = auth.uid());

-- Exam responses: students can manage own, admins can read all
create policy "Users can view own responses" on exam_responses for select using (
  exists (
    select 1 from exam_attempts where exam_attempts.id = exam_responses.attempt_id 
    and (exam_attempts.student_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  )
);
create policy "Students can insert responses" on exam_responses for insert with check (
  exists (select 1 from exam_attempts where id = attempt_id and student_id = auth.uid())
);
create policy "Students can update responses" on exam_responses for update using (
  exists (select 1 from exam_attempts where id = attempt_id and student_id = auth.uid())
);

-- Create storage bucket for notes (100 MB per file, common document types)
-- If the bucket already exists, update its settings instead
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notes',
  'notes',
  true,
  104857600,  -- 100 MB in bytes
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  file_size_limit = 104857600,
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ];

-- Storage policies
create policy "Anyone can read notes files" on storage.objects for select using (bucket_id = 'notes');
create policy "Admins can upload notes files" on storage.objects for insert with check (
  bucket_id = 'notes' and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins can delete notes files" on storage.objects for delete using (
  bucket_id = 'notes' and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
