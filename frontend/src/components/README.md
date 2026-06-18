# Dashboard UI Components (`src/components`)

This directory houses the React components that build the KSP interface widgets, visual maps, charts, and chatbot blocks.

---

## Component Profiles & Function Specifications

### 1. [Sidebar.tsx](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/src/components/Sidebar.tsx) (Navigation Bar Layout)
* **What it does**: Displays the left-hand navigation menu, showing user profiles, active roles, and tab buttons.
* **Interface Props**:
  * `currentTab`: The active tab panel ID.
  * `onChangeTab`: Function to trigger tab switches.
  * `unreadAlertsCount`: Unread alerts counter.
  * `onLogout`: Handler to terminate session JWT tokens.
* **Why we do it**: Provides navigation across the platform, highlighting new notifications with unread counts.

---

### 2. [RoleSelector.tsx](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/src/components/RoleSelector.tsx) (Authentication Component)
* **What it does**: Renders the login card layout, prompting for username and password credentials.
* **Core Functions**:
  * `handleLogin(e)`: Intercepts form submissions. Calls `/api/auth/login`, saves tokens, and executes `onLoginSuccess`.
* **Why we do it**: Prevents unauthorized access by enforcing credentials at startup.

---

### 3. [ChatBot.tsx](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/src/components/ChatBot.tsx) (Conversational AI Dashboard)
* **What it does**: Renders the chat history, input field, microphones, and evidence trail sidebar.
* **Core Functions**:
  * `handleSend(text)`: Sends query text to `/api/chat/query`, updates message state, and highlights sources.
  * `toggleListening()`: Connects to the browser's `webkitSpeechRecognition` API. Converts voice inputs in English and Kannada script to text.
  * `handleSpeechOutput(text)`: Utilizes the browser's `SpeechSynthesis` API to read replies aloud in the target language.
  * `handleExportPDF()`: Downloads compiled PDF transcripts via `/api/chat/export-pdf/{session_id}`.
* **Why we do it**: Provides a hands-free, multilingual RAG interface to search databases.

---

### 4. [AlertsPanel.tsx](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/src/components/AlertsPanel.tsx) (Early Warning Alert Feed)
* **What it does**: Displays notifications, categorized by risk rating, network connection, and hotspot escalation.
* **Core Functions**:
  * `triggerSimulation()`: Calls `/api/alerts/simulate` to log a new incident. If a threshold is crossed, it plays an alert tone and updates the notification list.
* **Why we do it**: Enables real-time incident monitoring and lets operators test alert conditions by simulating new cases.

---

### 5. [AnalyticsBoard.tsx](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/src/components/AnalyticsBoard.tsx) (Crime Trends & Forecaster)
* **What it does**: Displays historical statistics using Recharts (Line/Bar graphs) and displays time-series forecasts.
* **Core Functions**:
  * `fetchForecast()`: Calls `/api/forecasting/predict` for the selected district and category. Loads Holt-Winters forecast matrices and early warnings.
* **Why we do it**: Integrates historical statistics with statistical forecasts, highlighting projected anomalies.

---

### 6. [GeospatialMap.tsx](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/src/components/GeospatialMap.tsx) (Hotspot Mapping widget)
* **What it does**: Displays district coordinates and case densities on a Leaflet map.
* **Core Functions**:
  * `loadHotspots()`: Queries `/api/analytics/hotspots` using filter parameters. Renders markers and popups on the map.
* **Why we do it**: Helps investigators identify crime concentrations geographically.

---

### 7. [NetworkMap.tsx](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/src/components/NetworkMap.tsx) (Criminal Network Node-Link graph)
* **What it does**: Displays relationship networks using Vis.js. Clicking a node opens a sidebar with a tactical briefing.
* **Core Functions**:
  * `loadGraph()`: Queries `/api/network/graph` for suspects or syndicates. Formats nodes (by centrality) and links (highlighting suspicious transactions).
* **Why we do it**: Maps relationships between suspects, cases, bank details, and transactions to help trace criminal networks.

---

### 8. [OffenderRegistry.tsx](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/src/components/OffenderRegistry.tsx) (Repeat Offender Database)
* **What it does**: Lists repeat offenders in a paginated table.
* **Core Functions**:
  * `loadOffenders()`: Queries `/api/analytics/offenders` using searches, pages, and recidivism filters.
* **Why we do it**: Centralizes offender tracking, highlighting priority suspects.

---

### 9. [AuditLogs.tsx](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/frontend/src/components/AuditLogs.tsx) (Security Audit Ledger)
* **What it does**: Displays search histories in a table. Restricted to the `Supervisor` role.
* **Core Functions**:
  * `loadLogs()`: Queries `/api/auth/audit-logs` on mount to show the log entries.
* **Why we do it**: Provides compliance monitoring for audit reviews.
