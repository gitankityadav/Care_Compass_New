# Care Compass — Local Patient QR Trigger + Nurse Sync

## What this branch changes
- Adds a patient-specific QR panel to the existing Patient Emergency Support page.
- QR opens `/patient?patient_id=<patient>` on the device that scans it.
- The selected patient is restored from the URL, and the active nurse assignment is loaded from PostgreSQL.
- Phone and desktop send through the existing `POST /api/iot/trigger` endpoint. The backend transaction creates the risk and nurse intervention records; it does not create a separate QR alert system.
- The Nurse Command Center already polls new high/critical risk records every 2.5 seconds. The patient trigger therefore appears through the existing nurse alert/toast workflow.
- In development, the frontend derives the API host from the browser hostname, Vite listens on the LAN, and FastAPI CORS accepts private LAN origins.

## Requirements
- Node.js 20 LTS (or compatible current LTS) and npm
- Python 3.12+
- Access to the Care Compass PostgreSQL database
- For phone testing: laptop and phone on the same Wi-Fi

## Start on Windows PowerShell

### 1. Frontend terminal — from repository root
```powershell
npm install
npm run dev -- --host 0.0.0.0
```
Open `http://localhost:5173` on the laptop.

### 2. Backend terminal — open a second PowerShell window
```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
Create `backend\.env` by copying `backend\.env.example`, then set the real PostgreSQL `DATABASE_URL`. Do not commit or share this file.
```powershell
Copy-Item .env.example .env
notepad .env
```
Start the API:
```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Check `http://localhost:8000/api/health` — it must report database connected.

### 3. Open on a phone on the same Wi-Fi
Find the laptop IPv4 address:
```powershell
ipconfig
```
Use the Wi-Fi adapter's IPv4 address, for example `192.168.1.25`. On the phone open:
```text
http://192.168.1.25:5173/iot-device
```
The Windows firewall may ask permission; allow Node.js on your private network. The QR code generated on that page will encode the same LAN URL and selected patient. Scan it using the phone camera. If already viewing the page on the phone, the QR is mainly useful for handing the patient link to another device.

### 4. End-to-end test
1. Keep the Nurse Command Center open and sign in as the nurse assigned to the selected patient.
2. Open the Patient Emergency Support page on another device (or another browser tab).
3. Scan/open the patient-specific QR link.
4. Press **REQUEST NURSE ASSISTANCE** once.
5. Confirm the patient page shows the transmitted event.
6. Within the existing 2.5-second nurse polling cycle, the assigned nurse should see the new high/critical alert/toast. Open it and acknowledge/progress it using the existing nurse workflow.
7. Confirm the patient page reflects the intervention status where the UI displays it.

## Access from anywhere
A LAN address only works on the same Wi-Fi/network. To scan from a device anywhere on the internet, deploy the frontend and API on publicly reachable HTTPS hosts, configure the deployed frontend's `VITE_API_URL` to the deployed API, and add the deployed frontend origin to backend `CORS_ORIGINS`. Then generate the QR while viewing the deployed patient page; its URL will be the deployed HTTPS origin.

## Notes
- This is a demonstration workflow, not a certified medical emergency system. It is not connected to physical bedside hardware or emergency services.
- The QR URL contains the patient identifier. Treat it as sensitive and use only with approved demo data; production should use expiring, opaque patient access tokens and authentication.
- The 2.5-second polling interval is the existing nurse-console refresh cadence, not a guaranteed delivery SLA. Network, browser, API and database availability affect delivery.
