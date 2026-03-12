-- ========================================================
-- TELAWA ULTIMATE PROFESSIONAL SCHEMA (V3)
-- ========================================================
-- This script merges data integrity, performance, and functionality.
-- Execute this in the Supabase SQL Editor.

-- 1. CLEANUP
DROP TABLE IF EXISTS public.recordings CASCADE;
DROP TABLE IF EXISTS public.rounds CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. USERS TABLE
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) > 0),
    is_anonymous BOOLEAN DEFAULT false,
    photo_url TEXT,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    total_score BIGINT DEFAULT 0,
    recording_count BIGINT DEFAULT 0,
    average_score DOUBLE PRECISION DEFAULT 0
);

-- Performance Index for Leaderboard
CREATE INDEX IF NOT EXISTS idx_users_total_score ON public.users(total_score DESC);

-- 3. ROOMS TABLE
CREATE TABLE public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
    host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
    participants UUID[] DEFAULT '{}',
    max_participants INTEGER DEFAULT 10 CHECK (max_participants > 0),
    recording_duration INTEGER DEFAULT 60 CHECK (recording_duration > 0),
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    theme JSONB DEFAULT '{"color": "emerald"}'::jsonb,
    ready_users UUID[] DEFAULT '{}',
    current_round INTEGER DEFAULT 0,
    active_recording JSONB
);

-- Performance Indexes for Dashboard
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON public.rooms(created_at DESC);

-- 4. ROUNDS TABLE
CREATE TABLE public.rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    verse_text TEXT,
    surah_name TEXT,
    ayah_number INTEGER,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_rounds_room_id ON public.rounds(room_id);

-- 5. RECORDINGS TABLE
CREATE TABLE public.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    audio_data TEXT NOT NULL,
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    likes UUID[] DEFAULT '{}',
    score INTEGER CHECK (score >= 0 AND score <= 100 OR score IS NULL),
    status TEXT DEFAULT 'active'
);

-- Performance Indexes for Playback
CREATE INDEX IF NOT EXISTS idx_recordings_room_id ON public.recordings(room_id);
CREATE INDEX IF NOT EXISTS idx_recordings_round_id ON public.recordings(round_id);
CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON public.recordings(user_id);

-- 6. SECURITY (RLS POLICIES)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- Dynamic Policies for Authenticated Users
CREATE POLICY "Public Read Access" ON public.users FOR SELECT USING (true);
CREATE POLICY "User Self Management" ON public.users FOR ALL USING (auth.uid() = id);

CREATE POLICY "Public Room Access" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Auth Room Management" ON public.rooms FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public Round Access" ON public.rounds FOR SELECT USING (true);
CREATE POLICY "Auth Round Management" ON public.rounds FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public Recording Access" ON public.recordings FOR SELECT USING (true);
CREATE POLICY "Auth Recording Management" ON public.recordings FOR ALL USING (auth.role() = 'authenticated');

-- 7. REALTIME DELIVERY
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms, public.users, public.recordings, public.rounds;

-- 8. ATOMIC SCORE FUNCTION
CREATE OR REPLACE FUNCTION public.sync_user_score(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.users
    SET 
        total_score = (SELECT COALESCE(SUM(score), 0) FROM public.recordings WHERE user_id = $1),
        recording_count = (SELECT COUNT(*) FROM public.recordings WHERE user_id = $1),
        average_score = (SELECT COALESCE(AVG(score), 0) FROM public.recordings WHERE user_id = $1)
    WHERE id = $1;
END;
$$;
