Reality Check — Frontend MVP
A React + Vite prototype for the Alexa+ hackathon. It is designed around the product loop:
PROMISE → OBSERVE → COMPARE → DETECT → CHALLENGE → PLAN
Important: demo data
The current UI uses src/demoData.js. The sample metrics and commitment history are illustrative and are visibly marked as demo data in the UI. Adding a commitment or running a check currently updates local frontend state only; it does not persist to a backend.
Run locally
Install Node.js LTS from https://nodejs.org/ if it is not installed.
Extract this folder and open it in VS Code.
In VS Code, open Terminal → New Terminal.
Run:
npm install
npm run dev
Open the local URL printed by Vite (usually http://localhost:5173).
To check the production build, run npm run build.
Integration contract for Person A
The frontend API boundary is in src/api.js. Proposed routes:
GET /api/dashboard — returns the dashboard object shaped like demoDashboard.
POST /api/reality-check — accepts { "decision": "..." }; returns { "realityCheck": { ... } }.
POST /api/commitments — accepts { title, category, plannedMinutes, dueAt? }.
PATCH /api/commitments/:id/outcome — accepts { status, actualMinutes?, note? }.
Set VITE_API_BASE_URL=http://localhost:8000 (or Person A's actual backend URL) in a .env file at the project root. Confirm route names and payload shapes with Person A before wiring the calls into App.jsx.
Files
src/App.jsx — single-page dashboard and Reality Check experience
src/styles.css — responsive warm-white / forest-green visual system
src/demoData.js — clearly labelled demo fixture
src/api.js — proposed backend API boundary
Scope intentionally excluded
No real Alexa integration, authentication, calendar integrations, or real persistence yet. The first milestone is a polished frontend that can later display backend-generated evidence without inventing metrics.