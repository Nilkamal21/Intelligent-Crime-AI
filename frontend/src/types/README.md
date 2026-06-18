# TypeScript Type Definitions (`src/types`)

This folder contains global TypeScript interface definitions to ensure type safety across the frontend.

---

## Interface Type Declarations

### 1. `UserSession`
* **What it does**: Represents the active logged-in user session, containing attributes:
  * `username` (string)
  * `role` ('Investigator' | 'Analyst' | 'Supervisor' | 'Policymaker')
  * `access_token` (JWT string)
* **Why we do it**: Standardizes session structures, enabling role-based navigation and authentication checks.

---

### 2. `ChatMessage`
* **What it does**: Models messages inside the chatbot conversation stream, containing:
  * `sender` ('User' | 'Agent')
  * `text` (string message body)
  * `timestamp` (string ISO timestamp)
  * `language` ('EN' | 'KN')
  * `evidence_trail` (optional array of `EvidenceItem` records)
* **Why we do it**: Structures chat bubbles, supporting evidence indicators and bilingual translations.

---

### 3. `EvidenceItem`
* **What it does**: Models metadata matches retrieved via RAG, containing:
  * `type` ('aggregate_stats' | 'suspect_profile' | 'fir_record')
  * `source` (string source location)
  * `details` (arbitrary payload dictionaries containing statistics or suspect lists)
* **Why we do it**: Powers the evidence sidebar, showing sources for chatbot responses.

---

### 4. `NetworkNode`
* **What it does**: Defines nodes in the Vis.js relationship maps, containing:
  * `id` & `label` (string identifiers)
  * `type` ('suspect' | 'syndicate' | 'district' | 'crime_incident' | 'bank_account' | 'sub_location')
  * `size` (number based on centrality weighting)
  * *Optional specifics*: `recidivism`, `syndicate`, `district`, `year`, `crime_type`, `balance`, `status`, `sub_location`, `legal_sections`, `convictions`, `risk_score`, etc.
* **Why we do it**: Formats network nodes, rendering icons and tooltips dynamically based on entity types.

---

### 5. `NetworkEdge`
* **What it does**: Defines connection links between nodes, containing:
  * `source` & `target` (endpoints)
  * `label` & `type` (relationship names)
  * *Optional transactional metrics*: `amount`, `is_suspicious` (Hawala flags), `txn_id`, `case_id`.
* **Why we do it**: Formats connections, rendering transactions, Hawala highlights, and links in the graph.

---

### 6. `NetworkGraphData`
* **What it does**: Models the data returned by `/api/network/graph`, containing:
  * `nodes` & `edges` (lists matching the interfaces above)
  * `summary` (statistics counts for suspects, accounts, and cases)
  * `ai_insight` (bulleted briefing narrative summary)
* **Why we do it**: Passes graph structures and tactical briefings to the network dashboard.

---

### 7. `HotspotMarker`
* **What it does**: Models geographical coordinates for crime events, containing:
  * `district`, `sub_location`, `sub_location_kn` (names)
  * `lat` & `lng` (coordinates)
  * `cases` (count)
  * `risk_score` (risk rating)
  * `primary_crime` (crime category)
* **Why we do it**: Models coordinate maps, allowing Leaflet to plot markers and clusters.

---

### 8. `ForecastRecord`
* **What it does**: Models a data point in the forecasting timeline, containing:
  * `year` (integer)
  * `cases` & `risk_score` (values)
  * `type` ('Historical' | 'Forecasted')
* **Why we do it**: Groups timeline points to render Recharts line and bar graphs.

---

### 9. `EarlyWarningAlert`
* **What it does**: Models anomaly warnings returned by time-series forecasts, containing:
  * `severity` ('CRITICAL' | 'WARNING')
  * `indicator` & `message` (details)
  * `recommended_action` (suggested field responses)
* **Why we do it**: Structures warning messages, displaying them as banners in the forecasting tab.

---

### 10. `Alert`
* **What it does**: Models active warning notifications, containing:
  * `id` & `type` ('risk' | 'hotspot' | 'network')
  * `severity` ('high' | 'medium')
  * `message` (alert details)
  * `related_entity_id` & `timestamp` (identifiers)
* **Why we do it**: Maps notifications in the alerts panel and updates the sidebar badge count.
