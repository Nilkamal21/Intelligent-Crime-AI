# Karnataka State Police (KSP) Crime AI & Analytics Platform: System Documentation & Architectural Specification

---

## 1. Executive Summary & Tech Stack

The **KSP Crime AI & Analytics Platform** is an intelligent, multi-lingual conversational interface and crime forecasting dashboard. Designed for law enforcement investigators, analysts, supervisors, and policymakers, this platform provides a unified interface to query the Karnataka State Crime Database, analyze repeat offenders, map syndicates and money trails, identify crime hotspots, and predict future trends with early warnings.

### Tech Stack Specification

| Component | Technology | Version | Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | React.js (Vite build system) | 18.2 | Fast virtual DOM renders, hot module replacement, and modern hooks structure. |
| **Frontend Styling**| CSS3 / CSS Modules | Vanilla | Custom glassmorphism design, theme variables, and hardware-accelerated transitions. |
| **Data Visualization**| Recharts (SVG) | 2.10 | Interactive, responsive statistical graphs with tooltips and trend-lines. |
| **Mapping Layer** | React-Leaflet / Leaflet.js | 1.9 | High-performance geospatial mapping, custom icons, and clustered markers. |
| **Network Visualization**| vis-react (Vis.js Wrapper) | 0.8 | Dynamic, interactive force-directed graph node-link representations. |
| **Backend API** | FastAPI (Python-based) | 0.95 | High-speed ASGI micro-framework, asynchronous route handlers, auto Swagger documentation. |
| **LLM & NLP Engine** | Groq Cloud (Llama-3.1-8b) | Latest | Sub-100ms inference for conversational search, entity extraction, and briefing narratives. |
| **SQL Database** | SQLite (via SQLAlchemy) | 3.x | Lightweight, relational local ledger for users, session chats, audit trails, and mock transactions. |
| **Time-Series Models**| Statsmodels (Holt-Winters, ARIMA) | 0.14 | Criminology trend projections and statistical anomaly threshold calculations. |
| **Data Engineering**| Pandas, NumPy, Scikit-Learn | Latest | Vector similarity (TF-IDF), dataframe slicing, and fast database-to-CSV synchronization. |
| **PDF Generation** | ReportLab | 4.0 | Generates official KSP intelligence briefing reports with Kannada character support. |

---

## 2. Decoupled System Architecture

The platform operates on a decoupled Client-Server architecture. The FastAPI backend handles computational heavy-lifting, databases, statistical models, and Groq API calls. The React frontend handles user authentication, visual mapping layers (Leaflet, Vis.js), charts (Recharts), voice integration, state hoisting, and dashboard tab coordination.

### High-Level Schematic Flow

```
[1. INGESTION & LOADING]     [2. SYNTHESIZED LEDGER]        [3. CORE ENGINES]             [4. ANALYTICS & NLP]          [5. SECURITY & UI]

+---------------------+
| CSV Dataset         |------>+---------------------+
| (SCRB 10-Yr Master) |       | Suspect Mapper      |
+---------------------+       | (Extracts monikers) |-.
                              +---------------------+  \
                                                         \   +----------------------+
+---------------------+                                   \->| SQLAlchemy Seeder    |
| SQLite seed.db      |<=====================================| (Mock Bank/Ledger)   |
| (Local Database)    |                                      +----------+-----------+
+---------------------+                                                 |
                                                                        |
                                                                        v
                                                         _______________|_______________
                                                        /                               \
                                                       /       (FastAPI Endpoint Router) \
                                                      /                                   \
                                                     v                                     v
                                          +--------------------+                +--------------------+
                                          | CONVERSATIONAL NLP |                | RELATION ANALYZER  |
                                          |                    |                |                    |
                                          | 1. LangDetect (KN) |                | 1. NetworkX Multi  |
                                          | 2. Regex Filters   |                |    DiGraph         |
                                          | 3. Local TF-IDF    |                | 2. Syndicate Links |
                                          | 4. Groq RAG Engine |                | 3. Hawala Flags    |
                                          +---------+----------+                +---------+----------+
                                                    |                                     |
                                                    |                                     |
                                                    v                                     v
                                          +--------------------+                +--------------------+
                                          | FORECASTING ENGINE |                | ALERTS PANEL       |
                                          |                    |                |                    |
                                          | 1. Holt-Winters    |                | 1. Check-Rules     |
                                          | 2. ARIMA (1,0,0)   |                |    (1.5 SD bounds) |
                                          | 3. Anomaly Warning |                | 2. Live Simulator  |
                                          +---------+----------+                +---------+----------+
                                                    |                                     |
                                                    \                                     /
                                                     \                                   /
                                                      \      (RESTful JSON Payloads)    /
                                                       \_________________   ___________/
                                                                         \ /
                                                                          v
                                                               +----------+----------+
                                                               |   SECURITY BOUNDARY |
                                                               |                     |
                                                               |  * RBAC Filter Auth |
                                                               |  * SQLite Audit Log |
                                                               |  * PDF Export File  |
                                                               +----------+----------+
                                                                          |
                                                                          v
                                                               +----------+----------+
                                                               |   VITE REACT CLIENT |
                                                               |  * Chatbot RAG Box  |
                                                               |  * Leaflet Maps     |
                                                               |  * Vis.js Networks  |
                                                               |  * Recharts Trends  |
                                                               +---------------------+
```

### Key Subsystem Configurations

* **Conversational NLP Interface**: Detects Kannada text through Unicode block scanners. Pre-filters queries using regex arrays (looking for Years, Districts, Crime Types, and Suspects) to guide search contexts before passing them to the Groq API. Falls back to a local TF-IDF semantic template if the API key is absent.
* **Criminal Relationship Graph**: Reads suspect metadata from CSV and merges it with SQLite transactional history. Builds a NetworkX directed multi-graph mapping suspects to cases, syndicates, locations, bank accounts, and funds routing.
* **Predictive Forecasting & Anomaly Warnings**: Groupby year aggregates. Fits Holt-Winters (Exponential Smoothing with additive trends) and ARIMA (1, 0, 0) parameters to project crime counts and risk levels. Generates warning structures if the projection exceeds the historical mean by $+1.5\sigma$ (standard deviations).
* **Automated Checking & Alerting**: Scans all suspects and districts dynamically. Flags alerts based on:
  1. Offender Risk Index $\ge 0.85$ (High/Medium risk priority offender warnings).
  2. Syndicate affiliation combined with $\ge 3$ active suspicious financial flags.
  3. High-volume hotspot escalation (District crime count $> 75\text{th}$ percentile of all districts).

---

## 3. End-to-End System Workflow & Pipeline Logic

The system functions as a secure, real-time decision support pipeline. Below are the execution details for each phase.

### Phase A: Data Loading & Cache Warming
1. During FastAPI startup, the singleton `data_reader` initializes.
2. It parses [ksp_final_datathon_master.csv](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/ksp_final_datathon_master.csv), maps column headers, replaces null values, and appends a `case_index` primary key.
3. A local TF-IDF Vectorizer is trained on the English `FIR_Text_Summary_EN` corpus to enable RAG.
4. The list of unique suspects is parsed, sorted by length (descending) to avoid sub-string collisions during regex keyword parsing, and cached in memory.

### Phase B: Database Seeding & Transaction Synthesis
1. The server checks the SQLAlchemy SQLite database [seed.db](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/seed.db).
2. If tables are empty, it writes four default Role-Based Access Control (RBAC) user credentials: `investigator`, `analyst`, `supervisor`, and `policymaker` (all passwords default to `ksp123`).
3. Using the cached list of suspects, the seeder creates mock bank accounts. Accounts are flagged if the offender recidivism count is $>3$ or if they belong to a syndicate.
4. Generates 3,000 transactions. Out of these, 40% are syndicate transactions (with a chance of wire hawala flags), 50% are inter-suspect transfers, and 10% are cash deposits.

### Phase C: Offender Profile Metrics Calculation
The composite Priority Offender Risk Score ($0.0 - 10.0$) is computed mathematically:
$$Risk = \text{Min}\left(10.0, \quad W_{\text{recidivism}} + W_{\text{syndicate}} + W_{\text{cases}} + W_{\text{convictions}}\right)$$
* **Recidivism Weight ($W_{\text{recidivism}}$)**: $\text{Min}(\text{Recidivism\_Count} \times 1.5, \quad 4.0)$
* **Syndicate Weight ($W_{\text{syndicate}}$)**: $2.0$ if the suspect belongs to an active crime syndicate; else $0.0$
* **Case Volume Weight ($W_{\text{cases}}$)**: $\text{Min}(\text{Total\_Linked\_Cases} \times 0.4, \quad 2.0)$
* **Conviction Weight ($W_{\text{convictions}}$)**: $(\text{Convictions} / \text{Cases\_Reported}) \times 2.0$

### Phase D: NLP Conversational Pipeline
1. **Language Detection**: Character blocks are scanned. If Kannada characters exceed $5\%$ or count $\ge 2$, `language` is set to `KN`.
2. **Filter Extraction**: Text matches against the cached maps of Karnataka districts, crime categories, and suspects.
3. **Context Construction**:
   * If a suspect is matched, it computes their offender metrics.
   * If filters are found, it queries aggregate statistics from the CSV.
   * Runs cosine similarity to retrieve similar case summaries (RAG).
   * Aggregates historical yearly timelines to handle trend requests.
4. **LLM Execution**: System prompts instruct Llama-3.1 to generate a professional Police Intelligence Briefing. It reformats mathematical calculations to plain language, uses structured headings and bullet points, translates output to the target language, and hides raw database dictionaries.
5. **Auditing**: Writes the user's action and query text to `audit_logs` in SQLite.

### Phase E: Interactive Graph Mapping
1. When searching a suspect or syndicate, FastAPI builds a NetworkX sub-graph.
2. Nodes represent Suspects, Crime Incidents, Bank Accounts, Syndicates, and Sub-locations. Edges depict relationships like `ACCUSED_IN`, `MEMBER_OF`, `OWNS_ACCOUNT`, and `OWNS_ACCOUNT -> bank transaction`.
3. Computes node degree centrality to size nodes in the UI.
4. Limits returned entities for performance and visual clarity.
5. Generates a tactical briefing using a deterministic template mapping the suspect's patterns, legal status, and modus operandi.

### Phase F: Time-Series Forecasting
1. Groups historical records by year for the specified district.
2. Fits statsmodels `ExponentialSmoothing` (Holt-Winters double exponential smoothing with additive trends) to project cases. Fits `ARIMA(1, 0, 0)` to project risk scores.
3. Computes the historical mean ($\mu$) and standard deviation ($\sigma$). Sets the anomaly warning threshold to:
$$\text{Threshold} = \mu + 1.5 \sigma$$
4. Returns projected data points for the next 3 years along with warnings if forecasted volumes cross the threshold.

### Phase G: Automated Alerting & Mock FIR Simulation
1. **Standing Alerts**: Checks CSV and SQLite. Triggers alerts for high-risk indexes ($\ge 0.85$), syndicate financial links, and district hotspots. Backdates alerts dynamically (spread across 3-7 days) using stable hashing to ensure realistic timestamps on dashboard load.
2. **FIR Simulation**:
   * Picks a random suspect, a random district, and a random crime.
   * 40% of simulations force a threshold breach (either raising recidivism to critical values or seeding suspicious transactions to cross the bank flags threshold).
   * Appends the new record to the global Pandas DataFrame.
   * Re-evaluates rules. If a new alert crosses the threshold, it pushes the alert with a real-time timestamp and increments the sidebar alert badge.

### Phase H: PDF Briefing Generator
1. Queries conversation tables in SQLite for the selected session.
2. Builds page templates using ReportLab's flowable objects.
3. Uses a dark navy banner and structured card layouts with blue/purple borders to indicate investigator and agent replies.
4. **Kannada Font Compatibility**: Attempts to load the `Tunga` font. If it fails or encounters rendering issues, the script cleans the text (removes non-ASCII characters) and falls back to Helvetica to ensure a crash-free export.

---

## 5. API Endpoints Schema Specification

### A. Authentication & Access
* **Endpoint**: `POST /api/auth/login`
  * **Payload**: `{"username": "investigator", "password": "..."}`
  * **Response**: `{"access_token": "...", "token_type": "bearer", "username": "investigator", "role": "Investigator"}`
* **Endpoint**: `GET /api/auth/me`
  * **Headers**: `Authorization: Bearer <token>`
  * **Response**: `{"username": "investigator", "role": "Investigator"}`
* **Endpoint**: `GET /api/auth/audit-logs`
  * **Access**: Restricted to `Supervisor` role.
  * **Response**: `[{"id": 1, "username": "investigator", "action": "SIMULATE_FIR", "query_text": null, "timestamp": "2026-06-17 21:18:00"}]`

### B. Chatbot Interface
* **Endpoint**: `POST /api/chat/query`
  * **Payload**: `{"session_id": "sess-xyz", "query_text": "List burglaries in Udupi", "language": "EN"}`
  * **Response**:
    ```json
    {
      "response_text": "### Summary\n• District: Udupi...",
      "language": "EN",
      "extracted_filters": {"District": "Udupi", "Year": null, "Crime_Type": "Burglary", "Suspect": null},
      "evidence_trail": [
        {"type": "fir_record", "source": "CSV Case Index #142", "details": "Udupi (2021) - Burglary"}
      ]
    }
    ```
* **Endpoint**: `GET /api/chat/export-pdf/{session_id}`
  * **Headers**: `Authorization: Bearer <token>` or `?token=<jwt>`
  * **Response**: Returns the compiled restricted PDF file (`application/pdf`).

### C. Relationship Graph
* **Endpoint**: `GET /api/network/suggestions`
  * **Response**: lists search suggestions for autocomplete: `{"suspects": [...], "suspect_ids": [...], "syndicates": [...], "cases": [...]}`
* **Endpoint**: `GET /api/network/graph`
  * **Query Parameters**: `?search_query=Suresh K.`
  * **Response**:
    ```json
    {
      "nodes": [
        {"id": "Suresh K.", "label": "Suresh K.", "type": "suspect", "size": 45, "recidivism": 5, "syndicate": "Coastal Smuggling Crew"}
      ],
      "edges": [
        {"source": "Suresh K.", "target": "CASE-142", "label": "ACCUSED_IN", "type": "accused_in", "case_id": "FIR #KA-2021-10142"}
      ],
      "summary": {"total_nodes": 1, "total_edges": 1, "suspects_count": 1, "cases_count": 0, "accounts_count": 0, "suspicious_tx_count": 0},
      "ai_insight": "• TARGET NARRATIVE: Suspect Suresh K. is linked to..."
    }
    ```

### D. Analytics & Datasets
* **Endpoint**: `GET /api/analytics/overview`
  * **Query Parameters**: `?district=Mysuru&year=2021`
  * **Response**: Returns aggregate numbers, yearly trends, crime types, and top districts.
* **Endpoint**: `GET /api/analytics/hotspots`
  * **Query Parameters**: `?crime_type=Murder&year=2021`
  * **Response**: `{"hotspots": [{"district": "Mysuru", "lat": 12.29, "lng": 76.63, "cases": 3, "risk_score": 0.76, "primary_crime": "Murder"}]}`
* **Endpoint**: `GET /api/analytics/offenders`
  * **Query Parameters**: `?district=Udupi&min_recidivism=3&page=1&limit=25`
  * **Response**: Returns sorted list of offenders based on Priority Risk Score, with total count and page pagination.

### E. Time-Series Forecasting
* **Endpoint**: `GET /api/forecasting/predict`
  * **Query Parameters**: `?district=Mysuru&crime_type=Robbery`
  * **Response**:
    ```json
    {
      "district": "Mysuru",
      "crime_type": "Robbery",
      "historical": [{"year": 2021, "cases": 12, "risk_score": 0.42}],
      "forecast": [{"year": 2024, "cases": 13.5, "risk_score": 0.45}],
      "early_warnings": [],
      "statistics": {"historical_mean": 11.2, "historical_std_dev": 1.4, "warning_threshold": 13.3, "r_squared": 0.82}
    }
    ```

### F. Alerts System
* **Endpoint**: `GET /api/alerts/standing`
  * **Response**: lists standing alerts: `{"alerts": [{"id": "alert-risk-123", "type": "risk", "severity": "high", "message": "...", "timestamp": "..."}]}`
* **Endpoint**: `POST /api/alerts/simulate`
  * **Access**: Restricted to `Investigator` or `Analyst` roles.
  * **Response**: returns trigger status, new alert arrays, and simulated FIR details:
    ```json
    {
      "triggered": true,
      "new_alerts": [{"id": "alert-risk-102-sim-123", "type": "risk", "severity": "high", "message": "Critical high-risk offender...", "timestamp": "..."}],
      "message": "Critical high-risk offender...",
      "mock_fir": {"case_id": "CASE-2501", "district": "Kalaburagi", "crime_type": "Online Harassment", "suspect": "Santhosh D. Hiremath"}
    }
    ```
