# Care Compass — development handoff and recovery guide

This repository contains the React/Vite application, a FastAPI backend, PostgreSQL schema/import assets, the synthetic workbook and project reference documents.

## Source-of-truth assets
- `server/data/Care_Compass_Synthetic_Data.xlsx` — synthetic workbook.
- `docs/reference/Care_Compass_Data_Schema_v1.0.pdf` — ERD and data dictionary (27 operational tables / 275 columns).
- `docs/reference/Care_Compass_User_Stories.xlsx` — user stories.
- `docs/reference/Care_Compass_Enterprise_Ontology.docx` — enterprise ontology.
- `server/sql/001_care_compass_schema.sql` — PostgreSQL DDL and FK constraints.
- `server/sql/schema-manifest.json` — table, column, primary-key and row-count manifest.
- `backend/app/` — active FastAPI application and API routes.
- `server/src/` — legacy Express API; it is not the API used by the current React app by default.

## Requirements
- Node.js 20+
- Python version compatible with the pinned backend dependencies
- PostgreSQL 15+
- Windows PowerShell, macOS Terminal or Linux shell

## 1. Start the React UI

From the repository root:

```bash
npm install
npm run dev
```

Vite normally starts at `http://localhost:5173`. If that port is already occupied, Vite selects the next available port (for example, `5175`). Keep using the URL printed in the terminal.

The frontend reads `VITE_API_URL` when supplied. Otherwise, in development it uses `http://localhost:8000` for the FastAPI backend. If the API is unavailable, the UI can use its bundled local preview data; that preview is not proof that PostgreSQL is connected.

## 2. Configure PostgreSQL

The SQL schema and workbook import assets are under `server/`.

Create or select the intended development database. Apply the schema once:

```bash
cd server
psql "postgresql://USER:PASSWORD@HOST:5432/DATABASE" -f sql/001_care_compass_schema.sql
```

For a hosted database, use the provider's connection string and required SSL settings. Do not run destructive import/replace commands against production data.

## 3. Import the synthetic workbook (only if the database needs loading)

From `server/`:

```bash
npm install
npm run db:import
```

The importer loads the operational sheets. The workbook's guidance/metadata sheets are not operational tables. The optional `--replace` mode truncates operational tables before importing and must only be used against a disposable development/test database.

## 4. Configure and start the active FastAPI backend

Open a second terminal at the repository root:

```powershell
cd backend
copy .env.example .env
```

Edit `backend/.env` and set `DATABASE_URL` to the same PostgreSQL database used above. Keep this file private and do not commit it.

Create a virtual environment and install the pinned dependencies:

**Windows PowerShell**
```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**macOS / Linux**
```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend configuration is read from `backend/.env`. The relevant settings are `DATABASE_URL`, `PGSSLMODE`, `PORT` and `CORS_ORIGINS`. The current CORS middleware also permits localhost/127.0.0.1 Vite ports in the 5170–5179 range.

Useful checks:
- API root: `http://localhost:8000/`
- Database health: `http://localhost:8000/api/health`
- Interactive API docs: `http://localhost:8000/docs`
- Operational table names: `http://localhost:8000/api/tables`
- Database row counts: `http://localhost:8000/api/summary`
- Patient rows: `http://localhost:8000/api/data/patients?limit=100`
- Scenario list: `http://localhost:8000/api/scenarios`

The active FastAPI app registers data, mutation, scenario and automation routers. The Express service in `server/` remains in the repository for legacy/import tooling; its port-4000 instructions are not the current frontend's default API setup.

## 5. Main application areas

The React application includes the leadership dashboard, Patient Command, Nurse workflows, Logistics, Automation, Service Operations, Resilience and the separate IoT Device Simulator route at `/iot-device`. Preserve the existing Patient Command UI and separate IoT route when making future changes unless a specific change is requested.

The API exposes 27 operational PostgreSQL tables. The table-data endpoint supports pagination with `limit` and `offset`; its maximum page size is 50,000. UI preview data and live PostgreSQL data must be distinguished when validating records.

## 6. Deployment outline

- Frontend: deploy the root Vite project; build command `npm run build`, output directory `dist`; configure `VITE_API_URL` to the deployed FastAPI API URL.
- API: deploy the `backend/` FastAPI application with an ASGI server such as Uvicorn; configure `DATABASE_URL`, `PGSSLMODE`, `PORT` and `CORS_ORIGINS`.
- Database: provision managed PostgreSQL, apply the SQL migration once, then import synthetic data from a secure environment if needed.
- Never commit `.env` files, database credentials or real patient information.

## Important data and safety notes

- IDs remain strings; do not cast them to numbers or regenerate them.
- `scenario_id` is descriptive metadata, not an FK to a database scenario table.
- `audit_log.entity_id` is polymorphic and intentionally has no ordinary FK.
- `inventory.available_qty` must equal `on_hand_qty - reserved_qty`.
- Hospital-wide shipments may have no patient allocation; patient linkage is through `shipment_patient_allocation`.
- Lifecycle history remains in `shipment_events` and `ticket_status_history`; do not replace it with only a current status.
- Synthetic coordinates are approximate and are not navigation-grade.
- This dataset is fictional. Never upload real patient data to a public demo.

## Golden scenario engine

The FastAPI service exposes:
- `GET /api/scenarios` — lists SCN1–SCN5.
- `GET /api/scenarios/{scenario_id}` — returns linked source records.
- `POST /api/scenarios/{scenario_id}/execute` — executes the scenario in a PostgreSQL transaction and validates its final state.

Run scenario checks only against a development/test database whose state you are prepared to modify. Do not execute scenarios against production data.

## Automation

The FastAPI automation router exposes:
- `GET /api/automation/status`
- `GET /api/automation/events`
- `POST /api/automation/run`
- `POST /api/automation/events/{event_id}/acknowledge`

The scheduler runs an initial scan after startup and then every 15 minutes. It checks shipment delays/weather, upcoming home-visit weather and low inventory. Weather/geocoding checks depend on external Open-Meteo services; external failures are reported and should not be treated as proof that no risk exists.

## Production limitations

This is a development/demo system. Production authentication and server-enforced RBAC, verified live GIS routing, real EHR/device integrations, automated browser end-to-end tests and validation against the target hosted PostgreSQL environment are still required. The Operations Copilot is rule-based, not an LLM service. This is not a certified clinical system.
