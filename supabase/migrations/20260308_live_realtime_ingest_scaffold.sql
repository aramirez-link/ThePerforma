-- Scaffold for future realtime ingest pipelines (WebRTC/SRT)
-- Keeps current RTMP behavior unchanged while enabling schema compatibility.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'live_sessions_ingest_type_check'
      and conrelid = 'public.live_sessions'::regclass
  ) then
    alter table public.live_sessions
      drop constraint live_sessions_ingest_type_check;
  end if;
end
$$;

alter table public.live_sessions
  add constraint live_sessions_ingest_type_check
  check (ingest_type in ('rtmp', 'webrtc', 'srt'));

alter table public.live_sessions
  add column if not exists webrtc_publish_url text,
  add column if not exists webrtc_playback_url text,
  add column if not exists srt_ingest_url text,
  add column if not exists srt_stream_id text;

comment on column public.live_sessions.webrtc_publish_url is
  'Provider publish endpoint/token for future WebRTC ingest.';
comment on column public.live_sessions.webrtc_playback_url is
  'Provider low-latency playback endpoint for future WebRTC viewer path.';
comment on column public.live_sessions.srt_ingest_url is
  'Provider SRT ingest endpoint for future SRT pipeline.';
comment on column public.live_sessions.srt_stream_id is
  'Provider SRT streamid/session key for future SRT pipeline.';

