# Pishran | Intelligent Feasibility Platform

A bilingual-ready, Persian-first Progressive Web App (PWA) starter for industrial and business feasibility studies.

## Architecture

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + ECharts + PWA (Workbox)
- **Hosting:** GitHub Pages (static frontend)
- **Backend:** Python + FastAPI (deploy independently, e.g. Render)
- **Database:** Managed PostgreSQL (Render, Supabase, Neon, or private cloud)
- **AI:** Provider-agnostic adapter; API keys stay on the backend
- **Mobile:** Installable PWA; optional Android packaging through PWABuilder

GitHub Pages serves static files only. It does not run FastAPI or PostgreSQL.

## Repository layout

```text
frontend/          React PWA
backend/           FastAPI and calculation modules
.github/workflows/ GitHub Pages deployment
docs/              Architecture and implementation roadmap
```

## Run locally

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend expects `VITE_API_BASE_URL` (default `http://localhost:8000`).

### PostgreSQL with Docker
From repository root:
```bash
docker compose up -d db
```
Set `DATABASE_URL` in `backend/.env` to your PostgreSQL connection string. For local development, the API starter currently works without a database; persistence is the next implementation milestone.

## GitHub Pages setup

1. In GitHub, open **Settings → Pages → Build and deployment**.
2. Set **Source** to **GitHub Actions**.
3. In **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_API_BASE_URL`: public HTTPS URL of the deployed FastAPI service.
4. Push to `main`; workflow builds and deploys `frontend/dist`.

The Vite base path is configured for `/pishran/`. If using a custom domain, change `base` in `frontend/vite.config.ts` to `/`.

## Backend deployment

A `render.yaml` blueprint is included as a starting point. Before production:
- create a managed PostgreSQL database;
- set `DATABASE_URL`;
- set `CORS_ORIGINS` to the exact GitHub Pages origin and any custom domain;
- set AI provider credentials as backend environment secrets only;
- enable backups, monitoring, TLS, and a migration process.

## Product modules (planned)

1. Project workspace and assumptions register
2. Process engineering and capacity / mass-energy balance
3. Market intelligence and source provenance
4. CAPEX / OPEX and financial model
5. NPV, IRR, MIRR, DSCR, break-even and debt schedule
6. Scenario manager, sensitivity and Monte Carlo
7. Risk register and investment committee dashboard
8. AI copilot with citations, audit trail and human approval
9. Report builder (bank / investor / internal)

## Important

This repository is a **working foundation**, not a validated feasibility-study engine. Financial and engineering calculations must be implemented with documented formulas, units, tests, source references, and independent domain review before being used for investment decisions.
