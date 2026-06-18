import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.database import engine, Base
from backend.app.transaction_generator import seed_database
from backend.app.routes import auth, chat, network, analytics, forecasting, alerts

app = FastAPI(
    title="KSP Crime AI & Analytics API",
    description="Intelligent Conversational AI and Crime Analytics Platform for KSP Crime Database",
    version="1.0.0"
)

# Enable CORS for frontend API calls (essential for local cross-origin React -> FastAPI requests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(network.router)
app.include_router(analytics.router)
app.include_router(forecasting.router)
app.include_router(alerts.router)

@app.on_event("startup")
def startup_event():
    print("Initializing Database tables...")
    Base.metadata.create_all(bind=engine)
    
    print("Running database seeding checks...")
    seed_database()
    print("Startup procedures complete.")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "api_name": "KSP Crime AI & Analytics Platform Gateway",
        "supported_features": [
            "RBAC Authentication",
            "Conversational Chatbot (Groq RAG)",
            "Visual Network Link Mapping",
            "Socio-Demographic Correlation Insights",
            "Regression-based Crime Forecasting & Alerts",
            "Local Conversation PDF Export"
        ]
    }

if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
