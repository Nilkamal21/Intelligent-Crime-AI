# KSP Crime AI - Utility Modules (`backend/app/utils`)

This directory contains utility functions that handle offender risk scoring, translation parsing, and PDF document formatting.

---

## Utility File Contents & Functions

### 1. [metrics.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/utils/metrics.py) (Offender Risk Assessment)

#### `calculate_offender_metrics(df, suspect_name)`
* **What it does**: Scans the dataset for occurrences of a suspect name. Calculates preferred locations, crime types, and MO summaries. Computes a composite risk score (0.0 to 10.0) based on weighted factors:
  * **Recidivism count** ($40\%$ weight): Up to 4.0 points.
  * **Syndicate affiliation** ($20\%$ weight): 2.0 points if the suspect is in a syndicate.
  * **Linked cases count** ($20\%$ weight): Up to 2.0 points.
  * **Conviction frequency** ($20\%$ weight): Up to 2.0 points.
* **Why we do it**: Provides a structured risk score to help investigators prioritize active suspects.

---

### 2. [pdf_exporter.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/utils/pdf_exporter.py) (Briefing PDF compiler)

#### `export_conversation_to_pdf(session_id, messages)`
* **What it does**: Creates a letter-sized PDF document using ReportLab. Formats messages into structured bubbles with distinct colors (blue borders for users, purple for AI agents).
  * **Kannada Support**: Attempts to load the Windows `Tunga` font. If it encounters a rendering error, it sanitizer-strips Kannada text to ASCII and uses Helvetica to guarantee a crash-free export.
* **Why we do it**: Generates structured, printable reports of investigator queries and chatbot insights.

---

### 3. [translation.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/utils/translation.py) (NLP Parser & Kannada Mappings)

#### `clean_kannada_text(text)`
* **What it does**: Cleans Kannada strings, removing whitespace and trailing punctuation marks.
* **Why we do it**: Prepares text inputs for accurate matches against Kannada translation dictionaries.

#### `get_unique_suspects()`
* **What it does**: Extracts unique suspect monikers from the database. Sorts the list by moniker length (descending) and caches it in memory.
* **Why we do it**: Caches suspects to speed up lookups and sorts by length to prevent partial name-substring match collisions during text searches.

#### `extract_filters_from_text(query)`
* **What it does**: Uses regex patterns to scan queries for filters like years, districts, crime categories, and suspect monikers in English and Kannada.
* **Why we do it**: Resolves query filters to support targeted database queries before calling the LLM.

#### `detect_language(query)`
* **What it does**: Scans input text for Kannada Unicode ranges (`\u0c80` to `\u0cff`). Returns `KN` if Kannada characters count $\ge 2$; else returns `EN`.
* **Why we do it**: Automatically detects the query language so the chatbot replies in the correct language.
