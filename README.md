# LNATK Attendance Platform — Frontend & Backend Source Package

This archive contains the complete **Vite + React + TypeScript + Tailwind CSS** project and the **Supabase Backend API service** (excluding the SQL migration file, which is provided separately as `001_lnatk_supabase_migration.sql`).

## Project Structure

- `package.json`, `vite.config.ts`, `tailwind.config.js`, `tsconfig.json` — Complete Vite + React + TypeScript + Tailwind configuration.
- `.env.example` — Environment variable template (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- `src/lib/supabaseApi.ts` — Supabase client, Auth, Realtime subscriptions, and `SECURITY DEFINER` RPC calls.
- `src/types/lnatk.ts` — TypeScript definitions and `STATUS_FULL_LABELS` (`D - Dumalo`, `S - Sumayaw`, `A - Absent`, `P - Program`, `N - No Attendance`).
- `src/data/seedData.ts` — Complete 3-City, 18-Locale seed directory (`Santa Rosa`, `Biñan`, `San Pedro`) and Week 1–Week 4 session data.
- `src/LnatkApp.tsx` — Full React application with the centered Log-In screen, Regular TK City/Locale selector & editable table, Coordinator Batch TG Duty Roster & editable table, and Officer workspace with Per-Locale Live Venue Board.
- `standalone/lnatk_attendance_platform.html` — Ready-to-open single-file standalone version of the platform.

## Quick Start

```bash
npm install
cp .env.example .env.local
# Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local
npm run dev
```
