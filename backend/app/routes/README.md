# KSP Crime AI - Backend API Routes (`backend/app/routes`)

This folder houses the route controller files that handle HTTP requests and responses for the platform.

---

## Route File Contents & Functions

### 1. [auth.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/routes/auth.py) (User Session & RBAC Routing)

#### `log_action(db, username, action, query_text)`
* **What it does**: Creates an `AuditLog` entry in the database.
* **Why we do it**: Provides audit trails to track queries and system use for security compliance.

#### `create_access_token(data, expires_delta)`
* **What it does**: Encodes user details into an encrypted JWT bearer token with a specified expiration time.
* **Why we do it**: Enables secure, stateless token authentication for subsequent API calls.

#### `get_current_user(token, db)`
* **What it does**: Decodes access tokens, validates signatures, and returns the requesting `User` object.
* **Why we do it**: Restricts API endpoints to authenticated users and verifies their role permissions.

#### `login(request, db)` (POST `/api/auth/login`)
* **What it does**: Validates usernames and passwords against hashes in the database. Returns a JWT access token if valid.
* **Why we do it**: Standard login endpoint for the React frontend client.

#### `get_audit_logs(db, current_user)` (GET `/api/auth/audit-logs`)
* **What it does**: Returns the last 100 logged user actions. Restricted to the `Supervisor` role.
* **Why we do it**: Allows supervisors to review search histories and verify data access compliance.

---

### 2. [chat.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/routes/chat.py) (Bilingual Conversational Interface)

#### `get_groq_client()`
* **What it does**: Attempts to load API keys and initialize a connection client to the Groq Cloud endpoint.
* **Why we do it**: Centralizes the Groq client setup, supporting fallback options if keys are missing.

#### `query_crime_chat(request, db, current_user)` (POST `/api/chat/query`)
* **What it does**: Handles chatbot requests. Extracts filters, runs semantic case searches, retrieves stats, builds a context string, and calls the Groq API. Writes audit logs and returns the generated briefing.
* **Why we do it**: Orchestrates the RAG chat loop, converting search queries into structured briefings.

#### `generate_fallback_response(query, lang, filters, stats, suspect_profile, rag_results)`
* **What it does**: Generates structured markdown summaries from local data.
* **Why we do it**: Provides a reliable offline fallback response if the Groq API is unavailable.

#### `export_chat_pdf(session_id, db, current_user)` (GET `/api/chat/export-pdf/{session_id}`)
* **What it does**: Queries the conversation database for a session, compiles messages, and returns a formatted PDF file.
* **Why we do it**: Allows investigators to download clean, printable records of chat transcripts.

---

### 3. [network.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/routes/network.py) (Network Relationship Analysis)

#### `generate_ai_insight(suspects, cases)`
* **What it does**: Formulates detailed bulleted briefings summarizing suspect statuses, prior convictions, preferred locations, and modus operandi.
* **Why we do it**: Translates complex network graph connections into clear, actionable tactical intelligence for field agents.

#### `get_network_graph(...)` (GET `/api/network/graph`)
* **What it does**: Queries nodes and edges based on filters. Identifies relationships (e.g. accused in, syndicate member, account owner) and returns formatted JSON data.
* **Why we do it**: Builds the data structures needed to render interactive force-directed relationship graphs in the UI.

---

### 4. [analytics.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/routes/analytics.py) (Overview Stats & Hotspots)

#### `get_dashboard_overview(district, year, db, current_user)` (GET `/api/analytics/overview`)
* **What it does**: Filters cases by district and year. Computes aggregates (cases, chargesheets, conviction rates) and returns yearly trend charts.
* **Why we do it**: Powers the main dashboard widgets with statistics and trends.

#### `get_crime_hotspots(crime_type, year, db, current_user)` (GET `/api/analytics/hotspots`)
* **What it does**: Groups incidents by district coordinates and crime types, returning markers with case counts and risk ratings.
* **Why we do it**: Supplies coordinate markers to render heatmaps and hotspots on the Leaflet map.

#### `get_sociological_correlations(...)` (GET `/api/analytics/sociological`)
* **What it does**: Merges crime statistics with district profiles to calculate Pearson correlations for urbanization, migration, and economic stress.
* **Why we do it**: Helps policymakers examine how sociological factors relate to crime rates.

#### `get_repeat_offenders(...)` (GET `/api/analytics/offenders`)
* **What it does**: Returns a sorted, paginated list of repeat offenders, including their risk scores, syndicate links, and account statuses.
* **Why we do it**: Provides the data source for the offender registry dashboard.

---

### 5. [forecasting.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/routes/forecasting.py) (Predictive Forecaster)

#### `predict_crime_trends(...)` (GET `/api/forecasting/predict`)
* **What it does**: Fits Holt-Winters and ARIMA models on yearly stats to forecast cases and risk scores. Triggers alerts if projected volumes cross $+1.5\sigma$ limits.
* **Why we do it**: Integrates statistical forecasts and early warnings to support proactive policing.

---

### 6. [alerts.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/routes/alerts.py) (Early Warning Alert Center)

#### `check_rules(df, db, use_stable_time)`
* **What it does**: Evaluates three early-warning rules:
  1. Priority Offender Risk Index $\ge 0.85$.
  2. Syndicate affiliation with $\ge 3$ active suspicious transactions.
  3. District case counts $> 75\text{th}$ percentile threshold.
* **Why we do it**: Automatically flags high-risk suspects, coordinate funds routing, and hotspot escalations.

#### `simulate_new_fir(db, current_user)` (POST `/api/alerts/simulate`)
* **What it does**: Simulates a new crime incident. 40% of runs force a threshold breach to trigger a new alert. Appends records to the DataFrame and returns alerts.
* **Why we do it**: Demonstrates the real-time alerting system by simulating new incidents and verifying threshold triggers.
