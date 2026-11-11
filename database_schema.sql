-- ==============================================================================
-- DATABASE SCHEMA EXTRACTED FROM BACKUP (NOTEINFO-RICH / MAKTABA)
-- Backup file: db_cluster-03-10-2026@14-40-40.backup
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- 3. TABLES DEFINITIONS

-- Subjects Table
CREATE TABLE IF NOT EXISTS public.subjects (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#6366F1',
    icon text,
    created_at timestamp with time zone DEFAULT now()
);

-- Folders Table (with nested folder support)
CREATE TABLE IF NOT EXISTS public.folders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#6366f1',
    icon text DEFAULT 'folder',
    parent_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Lessons Table
CREATE TABLE IF NOT EXISTS public.lessons (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
    folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
    title text NOT NULL,
    content text,
    content_type text DEFAULT 'text',
    file_url text,
    is_favorite boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Highlights Table
CREATE TABLE IF NOT EXISTS public.highlights (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
    text_snippet text NOT NULL,
    start_offset integer,
    end_offset integer,
    color text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now()
);

-- Tags Table
CREATE TABLE IF NOT EXISTS public.tags (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    name text NOT NULL
);

-- Lesson Tags Junction Table
CREATE TABLE IF NOT EXISTS public.lesson_tags (
    lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
    tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (lesson_id, tag_id)
);

-- Color Labels Table
CREATE TABLE IF NOT EXISTS public.color_labels (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    color text NOT NULL,
    label text NOT NULL,
    UNIQUE (user_id, color)
);

-- 4. TRIGGERS FOR UPDATED_AT
DROP TRIGGER IF EXISTS lessons_updated_at ON public.lessons;
CREATE TRIGGER lessons_updated_at
    BEFORE UPDATE ON public.lessons
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_folders_updated_at ON public.folders;
CREATE TRIGGER set_folders_updated_at
    BEFORE UPDATE ON public.folders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. ROW LEVEL SECURITY (RLS)

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.color_labels ENABLE ROW LEVEL SECURITY;

-- Subjects RLS Policies
CREATE POLICY "Users manage own subjects" ON public.subjects
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Folders RLS Policies
CREATE POLICY "folders_select_own" ON public.folders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "folders_insert_own" ON public.folders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "folders_update_own" ON public.folders
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "folders_delete_own" ON public.folders
    FOR DELETE USING (auth.uid() = user_id);

-- Lessons RLS Policies
CREATE POLICY "Users manage own lessons" ON public.lessons
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Highlights RLS Policies (inherited through lesson ownership)
CREATE POLICY "Users manage own highlights" ON public.highlights
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.lessons l
            WHERE l.id = highlights.lesson_id AND l.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.lessons l
            WHERE l.id = highlights.lesson_id AND l.user_id = auth.uid()
        )
    );

-- Tags RLS Policies
CREATE POLICY "Users manage own tags" ON public.tags
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Lesson Tags RLS Policies
CREATE POLICY "Users manage own lesson_tags" ON public.lesson_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_tags.lesson_id AND l.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_tags.lesson_id AND l.user_id = auth.uid()
        )
    );

-- Color Labels RLS Policies
CREATE POLICY "Users manage own color_labels" ON public.color_labels
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. SUPABASE STORAGE BUCKET & POLICIES

-- Storage Bucket for Lesson Files (PDFs, Images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'lesson-files',
    'lesson-files',
    false,
    52428800, -- 50 MB
    ARRAY['application/pdf','image/png','image/jpeg','image/jpg','image/gif','image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Users can only access their own user_id folder
CREATE POLICY "Users upload own files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'lesson-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users read own files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'lesson-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users delete own files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'lesson-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

