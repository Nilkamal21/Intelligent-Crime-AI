# KSP Crime AI - Core Application Subsystem (`backend/app`)

This module handles configuration loading, database engine setup, ORM schema declarations, CSV data ingestion, semantic RAG matching, and mock database seeding.

---

## Module Contents

### 1. [main.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/main.py) (FastAPI Server Entrypoint)

#### `startup_event()`
* **What it does**: Automatically triggers on server start to compile the SQLAlchemy SQLite metadata schemas and run database seeding verification steps.
* **Why we do it**: Ensures that database tables are present and populated with required user profiles and transaction logs before the API handles web traffic.

#### `read_root()`
* **What it does**: Exposes a GET route `/` returning server status and supported platform features.
* **Why we do it**: Provides a simple health check endpoint for deployment monitoring.

---

### 2. [database.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/database.py) (SQLAlchemy Database Setup)

#### `get_db()`
* **What it does**: Yields a thread-local SQLite database session using context-managed generators and closes the session upon request completion.
* **Why we do it**: Prevents database connection leakage and ensures that SQLite session transactions are cleaned up after every API request.

---

### 3. [models.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/models.py) (SQLAlchemy ORM Schemas)

#### `User` Class
* **What it does**: Maps the `users` credentials table containing IDs, usernames, SHA-256 hashed passwords, roles, and creation timestamps.
* **Why we do it**: Enables secure authentication and Role-Based Access Control filters across endpoints.

#### `AuditLog` Class
* **What it does**: Maps investigator action audit logs (`audit_logs`) including user IDs, action categories, query texts, and transaction timestamps.
* **Why we do it**: Provides security logging to maintain accountability.

#### `BankAccount` Class
* **What it does**: Maps suspect bank details (`bank_accounts`) storing account numbers, linked suspect IDs, balances, and account statuses.
* **Why we do it**: Integrates CSV criminal suspects with the database ledger to track financial status.

#### `Transaction` Class
* **What it does**: Maps bank transfers (`transactions`) storing sender accounts, receiver accounts, amounts, transaction types, and suspicious Hawala flags.
* **Why we do it**: Models transactional flows between suspect accounts to trace fund routing.

#### `Conversation` Class
* **What it does**: Maps chat sessions (`conversations`) storing session IDs, sender roles, message text, languages, and timestamps.
* **Why we do it**: Stores chat history to provide contextual memory for subsequent chatbot queries.

---

### 4. [data_loader.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/data_loader.py) (CSV Ingestion & TF-IDF RAG)

#### `CrimeDataReader` Class
* **What it does**: A singleton wrapper that loads the SCRB crime dataset, manages pandas dataframes, and builds semantic text-search indices.
* **Why we do it**: Acts as the central data manager, avoiding repeated, expensive CSV file reads.

#### `load_data()`
* **What it does**: Reads the datathon CSV, handles missing values, and fits a `TfidfVectorizer` to the English FIR summaries.
* **Why we do it**: Initializes the DataFrame and builds vector representations for semantic text similarity.

#### `search_similar_cases(query, top_n, filters)`
* **What it does**: Transforms text queries into TF-IDF vectors, calculates cosine similarities against historical cases, applies optional metadata filters, and returns the top $N$ matching records.
* **Why we do it**: Implements local semantic search (RAG) to find matching historical cases without relying on external cloud vector databases.

#### `query_stats(district, year, crime_type)`
* **What it does**: Filters the crime dataset by district, year, or category, and returns sums and averages for cases, chargesheets, convictions, and risk ratings.
* **Why we do it**: Provides fast numerical summaries to power dashboard KPI cards.

---

### 5. [transaction_generator.py](file:///C:/Users/adhik/OneDrive/Desktop/ksp-crime-ai/backend/app/transaction_generator.py) (Database Seeder)

#### `hash_password(password)`
* **What it does**: Computes SHA-256 hashes of string passwords.
* **Why we do it**: Secures user passwords simply, avoiding compilation issues with heavy packages on Windows environments.

#### `seed_database()`
* **What it does**: Runs seeder tasks:
  1. Creates four default RBAC logins if absent.
  2. Parses CSV suspects, maps accounts, and flags them if recidivism is $>3$.
  3. Generates 3,000 transactions grouped by syndicate to create realistic flow clusters.
* **Why we do it**: Populates the SQLite database with consistent, structured mock financial records on initialization.
