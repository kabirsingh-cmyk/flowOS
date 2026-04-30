// FlowOS — Supabase client
// The anon key is intentionally public — all data is protected by Row Level Security
const _sbUrl  = 'https://rlrfffnkoxwzgfzklxyo.supabase.co';
const _sbAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJscmZmZm5rb3h3emdmemtseHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjkyMzcsImV4cCI6MjA5MzE0NTIzN30.yCyggFjqOw0uLg6gQd5cBy4cgexy8grcIi-AmyPF_A8';

const sb = window.supabase.createClient(_sbUrl, _sbAnon);
window.sb = sb;
