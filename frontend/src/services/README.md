# API Services Subsystem (`src/services`)

This directory contains the Axios client that handles requests to the FastAPI backend.

---

## Service Modules & Functions

All endpoints are organized into namespaces within [api.ts](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/src/services/api.ts):

### 1. `authService` (Authentication Requests)
* **`login(username, password)`**
  * *What it does*: Sends credentials to `/api/auth/login`. Saves the token, username, and role to `localStorage` on success.
  * *Why we do it*: Logs users in securely and saves session tokens for subsequent requests.
* **`getMe()`**
  * *What it does*: Fetches the current user profile from `/api/auth/me`.
  * *Why we do it*: Verifies active session tokens on app startup.
* **`getAuditLogs()`**
  * *What it does*: Fetches logged user actions from `/api/auth/audit-logs`.
  * *Why we do it*: Enables Supervisors to view logs.

### 2. `chatService` (Conversational AI)
* **`queryChat(sessionId, queryText, language)`**
  * *What it does*: Sends queries to `/api/chat/query`, returning briefings and RAG evidence.
  * *Why we do it*: Connects the chatbot UI to the bilingual NLP engine.
* **`exportPdfUrl(sessionId)`**
  * *What it does*: Returns the API URL for the PDF endpoint `/api/chat/export-pdf/{session_id}`.
  * *Why we do it*: Provides download links for conversation PDFs.

### 3. `networkService` (Relationship Mappings)
* **`getSuggestions()`**
  * *What it does*: Fetches suspects, syndicates, and cases from `/api/network/suggestions`.
  * *Why we do it*: Powers autocomplete suggestions in the search bar.
* **`getGraph(params)`**
  * *What it does*: Queries `/api/network/graph` using filters.
  * *Why we do it*: Fetches the node and edge lists needed to render relationship graphs.

### 4. `analyticsService` (Crime Stats)
* **`getOverview(params)`**
  * *What it does*: Queries `/api/analytics/overview` with year or district filters.
  * *Why we do it*: Populates the dashboard's charts and stats.
* **`getHotspots(params)`**
  * *What it does*: Fetches coordinates and case weights from `/api/analytics/hotspots`.
  * *Why we do it*: Supplies markers to render Heatmaps and maps.
* **`getTemporal(district)`**
  * *What it does*: Fetches crime distributions by hour, time block, and day profile.
  * *Why we do it*: Populates the temporal dashboard charts.
* **`getSociological(crimeType)`**
  * *What it does*: Fetches correlations between crime rates and sociological factors.
  * *Why we do it*: Supplies data to draw sociological correlation charts.
* **`getOffenders(params)`**
  * *What it does*: Queries `/api/analytics/offenders` using searches, page offsets, and limits.
  * *Why we do it*: Powers the offender registry grid.

### 5. `forecastingService` (Projections)
* **`predict(district, crimeType)`**
  * *What it does*: Queries `/api/forecasting/predict` for Holt-Winters forecasts and early warnings.
  * *Why we do it*: Fetches statistical forecasts and warning messages.

### 6. `alertsService` (Warning Systems)
* **`getStandingAlerts()`**
  * *What it does*: Queries `/api/alerts/standing` to get the list of active alerts.
  * *Why we do it*: Populates the notifications feed on login.
* **`simulateNewFIR()`**
  * *What it does*: Triggers a POST to `/api/alerts/simulate` to simulate a new incident.
  * *Why we do it*: Demonstrates the alerting system by simulating new cases.
