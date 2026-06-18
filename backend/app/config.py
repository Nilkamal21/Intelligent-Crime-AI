import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from a .env file in the backend folder or project root
load_dotenv(Path(__file__).parent.parent / ".env")

# Core Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
CSV_PATH = os.environ.get("CSV_PATH", str(BASE_DIR / "ksp_final_datathon_master.csv"))
DATABASE_PATH = os.environ.get("DATABASE_PATH", str(BASE_DIR / "backend" / "seed.db"))
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# Groq API Configuration
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# JWT/Auth configuration for secure roles
JWT_SECRET = os.environ.get("JWT_SECRET", "ksp-crime-ai-super-secret-key-12345")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

print(f"Config Loaded:")
print(f"  CSV Path: {CSV_PATH}")
print(f"  Database URL: {DATABASE_URL}")
print(f"  Groq Key Present: {'Yes' if GROQ_API_KEY else 'No'}")
