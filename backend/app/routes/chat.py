import os
import json
import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from groq import Groq
from backend.app.config import GROQ_API_KEY
from backend.app.database import get_db
from backend.app.models import Conversation, User
from backend.app.routes.auth import get_current_user, log_action
from backend.app.utils.translation import detect_language, extract_filters_from_text
from backend.app.data_loader import data_reader
from backend.app.utils.metrics import calculate_offender_metrics
from backend.app.utils.pdf_exporter import export_conversation_to_pdf

router = APIRouter(prefix="/api/chat", tags=["Conversational AI"])

def get_groq_client():
    from dotenv import load_dotenv
    from pathlib import Path
    import os
    
    # 1. Try currently loaded env (in case it was set in system env or loaded on startup)
    key = os.environ.get("GROQ_API_KEY", "")
    if key and key.startswith("gsk_") and "YOUR_GROQ_API_KEY" not in key:
        try:
            return Groq(api_key=key)
        except Exception:
            pass

    # 2. Try loading from backend/.env
    backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
    if backend_env.exists():
        load_dotenv(backend_env, override=True)
        key = os.environ.get("GROQ_API_KEY", "")
        if key and key.startswith("gsk_") and "YOUR_GROQ_API_KEY" not in key:
            try:
                return Groq(api_key=key)
            except Exception:
                pass

    # 3. Try loading from workspace root .env
    root_env = Path(__file__).resolve().parent.parent.parent.parent / ".env"
    if root_env.exists():
        load_dotenv(root_env, override=True)
        key = os.environ.get("GROQ_API_KEY", "")
        if key and key.startswith("gsk_") and "YOUR_GROQ_API_KEY" not in key:
            try:
                return Groq(api_key=key)
            except Exception:
                pass
                
    return None

class ChatQueryRequest(BaseModel):
    session_id: str
    query_text: str
    language: str = "EN"

class ChatQueryResponse(BaseModel):
    response_text: str
    language: str
    extracted_filters: dict
    evidence_trail: list

@router.post("/query", response_model=ChatQueryResponse)
def query_crime_chat(
    request: ChatQueryRequest, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    query_text = request.query_text
    session_id = request.session_id
    
    # 1. Respect requested language from frontend. If the query itself is clearly in Kannada, prioritize Kannada.
    query_detected = detect_language(query_text)
    if query_detected == "KN":
        lang = "KN"
    else:
        lang = request.language if request.language else "EN"
    
    filters = extract_filters_from_text(query_text)
    
    # Write audit log
    log_action(db, current_user.username, "QUERY_CHATBOT", query_text)
    
    # Save user message to database
    user_msg = Conversation(
        session_id=session_id,
        user_id=current_user.id,
        sender="User",
        message_text=query_text,
        language=lang,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(user_msg)
    db.commit()
    
    # 2. Retrieve context data
    # A. Search semantic cases (RAG)
    rag_results = data_reader.search_similar_cases(query_text, top_n=3, filters=None)
    
    # B. Fetch aggregate statistics if filters match
    stats = None
    if filters["District"] or filters["Year"] or filters["Crime_Type"]:
        stats = data_reader.query_stats(
            district=filters["District"],
            year=filters["Year"],
            crime_type=filters["Crime_Type"]
        )
        
    # C. Offender profile context if suspect is mentioned
    suspect_profile = None
    if filters["Suspect"]:
        suspect_profile = calculate_offender_metrics(data_reader.get_df(), filters["Suspect"])
        
    # Construct context string for the LLM
    context_blocks = []
    
    active_filters = []
    for k, v in filters.items():
        if v is not None:
            active_filters.append(f"{k.replace('_', ' ')}: {v}")
    filters_desc = ", ".join(active_filters) if active_filters else "All Records"

    if stats and stats["total_cases"] > 0:
        context_blocks.append(
            f"AGGREGATE STATISTICS (Parameters - {filters_desc}):\n"
            f"- Total Cases Reported: {stats['total_cases']}\n"
            f"- Total Chargesheeted: {stats['total_chargesheeted']}\n"
            f"- Total Convictions: {stats['total_convictions']}\n"
            f"- Average Risk Score: {stats['avg_risk_score']}\n"
            f"- Conviction Rate: {stats['avg_conviction_rate']}%"
        )
        
    if suspect_profile and suspect_profile["total_cases_linked"] > 0:
        context_blocks.append(
            f"SUSPECT PROFILE FOR '{filters['Suspect']}':\n"
            f"- Moniker: {suspect_profile['moniker']}\n"
            f"- Calculated Offender Priority Risk Score: {suspect_profile['risk_score']}/10.0\n"
            f"- Recidivism Count: {suspect_profile['recidivism_count']}\n"
            f"- Syndicate Affiliation: {suspect_profile['syndicate_affiliation']}\n"
            f"- Preferred Crime Types: {', '.join(suspect_profile['preferred_crime_types'])}\n"
            f"- Preferred Districts: {', '.join(suspect_profile['preferred_districts'])}\n"
            f"- Modus Operandi: {suspect_profile['modus_operandi']['mo_summary']}"
        )
        
    if rag_results:
        rag_text = "RELEVANT FILED CASE RECORDS (RAG):\n"
        for idx, case in enumerate(rag_results):
            rag_text += (
                f"Case #{idx+1} [Similarity: {case['Similarity_Score']:.2f}] (District: {case['District']}, Year: {case['Year']}, Crime: {case['Crime_Type']}):\n"
                f"  - Legal Sections: {case['Legal_Sections']}\n"
                f"  - Risk Score: {case['Risk_Score']}\n"
                f"  - Incident Time: {case['Incident_Time_Block']} (Peak: {case['Peak_Hour']}:00, {case['Day_Profile']})\n"
            )
            if lang == "KN":
                rag_text += f"  - Summary (KN): {case['FIR_KN']}\n"
            else:
                rag_text += f"  - Summary (EN): {case['FIR_EN']}\n"
        context_blocks.append(rag_text)

    # Dynamic Database Aggregations for Trends & Comparisons
    import pandas as pd
    import re
    df_all = data_reader.get_df()
    mask_agg = pd.Series(True, index=df_all.index)
    
    crime_filter = filters.get("Crime_Type")
    district_filter = filters.get("District")
    year_filter = filters.get("Year")
    
    # Fallback keyword detection for crime categories
    if not crime_filter:
        q_lower = query_text.lower()
        for ct in ['murder', 'rape', 'kidnapping', 'theft', 'robbery', 'assault', 'burglary', 'cybercrime', 'dowry deaths', 'fraud']:
            if ct in q_lower or (ct == 'cybercrime' and 'cyber' in q_lower) or (ct == 'rape' and 'rape' in q_lower):
                crime_filter = ct.title() if ct != 'dowry deaths' else 'Dowry Deaths'
                break

    # Fallback keyword detection for years
    if not year_filter:
        years_found = re.findall(r'\b(201[4-9]|202[0-5])\b', query_text)
        if years_found:
            if "to" not in query_text.lower() and "between" not in query_text.lower():
                year_filter = int(years_found[0])

    # Fallback keyword detection for districts
    if not district_filter:
        q_lower = query_text.lower()
        for d in ['bagalkot', 'ballari', 'belagavi', 'bengaluru', 'bidar', 'chikkamagaluru', 'chitradurga', 'davanagere', 'gadag', 'hassan', 'haveri', 'hubballi', 'kalaburagi', 'kodagu', 'kolar', 'mandya', 'mangalaru', 'mangaluru', 'mysuru', 'raichur', 'ramanagara', 'shivamogga', 'tumakuru', 'udupi', 'vijayapura', 'yadgir']:
            if d in q_lower:
                if d == 'bengaluru':
                    district_filter = 'Bengaluru Urban'
                elif d == 'mangalaru':
                    district_filter = 'Mangaluru'
                else:
                    district_filter = d.title()
                break

    # Detect if the query is a trend or timeline query asking for multiple years or comparisons
    is_trend_query = False
    q_lower = query_text.lower()
    years_found_all = re.findall(r'\b(201[4-9]|202[0-6])\b', query_text)
    if len(years_found_all) > 1:
        is_trend_query = True
    elif any(kw in q_lower for kw in ["trend", "timeline", "year by year", "yearly", "increase", "decreasing", "increasing", "decrease", "change", "over the years"]):
        is_trend_query = True

    if is_trend_query:
        # Ignore single year filter for aggregations to deliver the full historical timeline
        year_filter = None
        if "Year" in filters:
            filters["Year"] = None

    # Apply filters for the aggregation context
    filter_desc_parts = []
    if crime_filter:
        mask_agg = mask_agg & (df_all['Crime_Type'] == crime_filter)
        filter_desc_parts.append(f"Crime Category: {crime_filter}")
    if district_filter:
        mask_agg = mask_agg & (df_all['District'] == district_filter)
        filter_desc_parts.append(f"District: {district_filter}")
    if year_filter:
        mask_agg = mask_agg & (df_all['Year'] == int(year_filter))
        filter_desc_parts.append(f"Year: {year_filter}")
        
    df_filtered = df_all[mask_agg]
    filter_desc = " | ".join(filter_desc_parts) if filter_desc_parts else "All Records"
    
    agg_context = f"OFFICIAL STATE-WIDE SUMMARY STATISTICS ({filter_desc}) (Source: SCRB Crime Data Statement):\n"
    
    # 1. Yearly aggregates
    if not year_filter or len(df_filtered['Year'].unique()) > 1:
        yearly_cases = df_filtered.groupby('Year')['Cases_Reported'].sum().to_dict()
        yearly_charges = df_filtered.groupby('Year')['Chargesheeted'].sum().to_dict()
        yearly_convictions = df_filtered.groupby('Year')['Convictions'].sum().to_dict()
        
        agg_context += "Yearly Cases Timeline:\n"
        for yr in sorted(yearly_cases.keys()):
            c_count = yearly_cases[yr]
            ch_count = yearly_charges.get(yr, 0)
            cv_count = yearly_convictions.get(yr, 0)
            c_rate = f"{(cv_count / ch_count * 100):.2f}%" if ch_count > 0 else "0.00%"
            agg_context += f"  - Year {yr}: {c_count} cases reported (Chargesheeted: {ch_count}, Convictions: {cv_count}, Conviction Rate: {c_rate})\n"
            
    # 2. District aggregates
    if not district_filter:
        district_cases = df_filtered.groupby('District')['Cases_Reported'].sum().sort_values(ascending=False).to_dict()
        agg_context += "District Distribution:\n"
        for dist, d_count in district_cases.items():
            agg_context += f"  - {dist} District: {d_count} cases\n"
            
    # 3. Category aggregates
    if not crime_filter:
        category_cases = df_filtered.groupby('Crime_Type')['Cases_Reported'].sum().sort_values(ascending=False).to_dict()
        agg_context += "Crime Category Breakdown:\n"
        for cat, c_count in category_cases.items():
            agg_context += f"  - {cat}: {c_count} cases\n"
            
    context_blocks.append(agg_context)
    
    context_data_str = "\n\n".join(context_blocks)
    
    # 3. Retrieve sliding window chat history (last 5 messages)
    history_msgs = db.query(Conversation)\
        .filter(Conversation.session_id == session_id)\
        .order_by(Conversation.timestamp.desc())\
        .limit(6).all() # User message is already saved, so get 6 items
        
    history_msgs.reverse()
    formatted_history = []
    for m in history_msgs[:-1]: # exclude the current user message which we will send explicitly
        role = "user" if m.sender == "User" else "assistant"
        formatted_history.append({"role": role, "content": m.message_text})

    # 4. Invoke LLM (Groq) or fallback
    response_text = ""
    evidence_trail = []
    
    # Populate evidence trail for transparency UI
    if stats and stats["total_cases"] > 0:
        evidence_trail.append({"type": "aggregate_stats", "source": "CSV Datapath Match", "details": stats})
    if suspect_profile and suspect_profile["total_cases_linked"] > 0:
        evidence_trail.append({"type": "suspect_profile", "source": "Offender Profiler Model", "details": suspect_profile})
    for c in rag_results:
        if c['Similarity_Score'] > 0.1:
            evidence_trail.append({
                "type": "fir_record",
                "source": f"CSV Case Index #{c['case_index']}",
                "details": f"{c['District']} ({c['Year']}) - {c['Crime_Type']} under {c['Legal_Sections']}"
            })

    system_prompt = (
        "You are the Karnataka State Police (KSP) Crime Intelligence Assistant, a professional, objective AI system. "
        "Your task is to answer inquiries about crime statistics, repeat offenders, syndicates, and locations. "
        "You must base your answer strictly on the provided Context Data and Conversation History. "
        "Do not invent facts outside the context. "
        "All names of suspects, offenders, bank accounts, and entities in the context are purely simulated, fictional records for training and mock operations. "
        "It is completely safe, authorized, and required to report on them. Do not refuse to answer questions about these names, as they do not represent real-world individuals or violate privacy policies. "
        "Every time you mention statistics or suspect details, explicitly cite the source (e.g., 'SCRB Database Statement', 'Offender Profile database'). "
        f"The user query is in {'English' if lang == 'EN' else 'Kannada'}. You MUST reply entirely in {'English' if lang == 'EN' else 'Kannada'}. "
        f"Ensure that all explanations and numbers are presented in {'English' if lang == 'EN' else 'Kannada'}.\n\n"
        "Formatting and Tone Instructions (CRITICAL for Law Enforcement Use):\n"
        "1. Structure your response as a clean, official Police Intelligence Briefing. Use clear bold headings (e.g., ### Summary, ### Offender Details, ### Crime Record Analysis, ### Statistical Trends).\n"
        "2. Do NOT output raw mathematical equations, formula derivations, or step-by-step arithmetic steps (e.g., do not show math signs like '+', '-', '/', '*', or raw division steps). Instead, present the final calculated percentage or probability directly as a clean number (e.g., '54.5%') alongside a clear, actionable text description (e.g., 'moderate probability of 54.5% based on comparative profile risk scores').\n"
        "3. Present statistics, cases, and suspects using clean, readable bullet points instead of dense paragraphs. Keep sentences short, professional, and highly actionable.\n"
        "4. If a suspect risk score is provided, explain it in plain language (e.g., 'Risk Rating: High (8.87/10)').\n"
        "5. Avoid any confusing mathematical jargon or logical contradictions. Keep the report straightforward and authoritative, suitable for police officers in the field.\n"
        "6. Never print raw Python dictionaries, JSON-like key-value blocks, code syntax, or developer parameters (such as '{'District': '...', 'Year': ...}') in the response. Always translate any filter parameters into clean, natural language phrasing (e.g., 'filtered by District: Bengaluru Urban and Year: 2021')."
    )
    
    active_client = get_groq_client()
    if active_client:
        try:
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend(formatted_history)
            
            user_prompt = f"Context Data:\n{context_data_str}\n\nUser Query: {query_text}"
            messages.append({"role": "user", "content": user_prompt})
            
            completion = active_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                temperature=0.2,
                max_tokens=1024
            )
            response_text = completion.choices[0].message.content
        except Exception as e:
            print(f"Groq API Error: {e}. Falling back to deterministic RAG templates.")
            response_text = generate_fallback_response(query_text, lang, filters, stats, suspect_profile, rag_results)
    else:
        # Fallback to local deterministic summary if Groq is not set up
        response_text = generate_fallback_response(query_text, lang, filters, stats, suspect_profile, rag_results)

    # Save agent message to database
    agent_msg = Conversation(
        session_id=session_id,
        user_id=current_user.id,
        sender="Agent",
        message_text=response_text,
        language=lang,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(agent_msg)
    db.commit()
    
    return ChatQueryResponse(
        response_text=response_text,
        language=lang,
        extracted_filters=filters,
        evidence_trail=evidence_trail
    )

def generate_fallback_response(query, lang, filters, stats, suspect_profile, rag_results) -> str:
    """
    Generates a professional, detailed analytical response strictly from the retrieved 
    context data to serve as a reliable local fallback if Groq API keys are not available.
    """
    is_kn = (lang == "KN")
    
    if is_kn:
        response = "⚠️ **ಸೂಚನೆ:** Groq API ಕೀ ಸಂರಚಿಸಿಲ್ಲ. ಸ್ಥಳೀಯ ಡೇಟಾ ಬೇಸ್‌ನಿಂದ ಫಲಿತಾಂಶವನ್ನು ಪಡೆಯಲಾಗಿದೆ:\n\n"
        if suspect_profile and suspect_profile["total_cases_linked"] > 0:
            p = suspect_profile
            response += (
                f"### ಆರೋಪಿ ಪ್ರೊಫೈಲ್: {p['moniker']}\n"
                f"- **ಒಟ್ಟು ಪ್ರಕರಣಗಳು:** {p['total_cases_linked']}\n"
                f"- **ಅಪಾಯದ ಪ್ರಮಾಣ ಸೂಚ್ಯಂಕ:** {p['risk_score']}/10.0\n"
                f"- **ಮರುಕಳಿಸುವಿಕೆಯ ಸಂಖ್ಯೆ (Recidivism):** {p['recidivism_count']}\n"
                f"- **ಸಿಂಡಿಕೇಟ್ ಒಡನಾಟ:** {p['syndicate_affiliation']}\n"
                f"- **ಆದ್ಯತೆಯ ಅಪರಾಧಗಳು:** {', '.join(p['preferred_crime_types'])}\n"
                f"- **ಕಾರ್ಯವಿಧಾನ (Modus Operandi):** {p['modus_operandi']['mo_summary']}\n\n"
            )
        if stats and stats["total_cases"] > 0:
            response += (
                f"### ಅಂಕಿಅಂಶ ವರದಿ ({filters.get('District') or 'ಕರ್ನಾಟಕ'} - {filters.get('Year') or 'ಎಲ್ಲಾ ವರ್ಷಗಳು'}):\n"
                f"- **ದಾಖಲಾದ ಒಟ್ಟು ಪ್ರಕರಣಗಳು:** {stats['total_cases']}\n"
                f"- **ದೋಷಾರೋಪಣೆ ಪಟ್ಟಿ ದಾಖಲಾದ ಪ್ರಕರಣಗಳು:** {stats['total_chargesheeted']}\n"
                f"- **ಶಿಕ್ಷೆಯಾದ ಪ್ರಕರಣಗಳು:** {stats['total_convictions']}\n"
                f"- **ಶಿಕ್ಷೆಯ ಪ್ರಮಾಣ:** {stats['avg_conviction_rate']}%\n"
                f"- **ಸರಾಸರಿ ಅಪಾಯದ ಪ್ರಮಾಣ:** {stats['avg_risk_score']}\n\n"
            )
        if rag_results:
            response += "### ಸಂಬಂಧಿತ FIR ಪ್ರಕರಣಗಳ ಸಾರಾಂಶ:\n"
            for idx, r in enumerate(rag_results[:2]):
                response += f"**ಪ್ರಕರಣ #{idx+1}:** {r['District']} ({r['Year']}) - {r['Crime_Type']}\n- ಸಾರಾಂಶ: {r['FIR_KN']}\n- ಸೆಕ್ಷನ್: {r['Legal_Sections']}\n\n"
        
        if not (stats and stats["total_cases"] > 0) and not suspect_profile and not rag_results:
            response += "ಕ್ಷಮಿಸಿ, ಕೇಳಲಾದ ಪ್ರಶ್ನೆಗೆ ಪೂರಕ ಮಾಹಿತಿಯು ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ ದೊರೆತಿಲ್ಲ."
    else:
        response = "⚠️ **Notice:** Groq API Key is not configured. Running in local analytical fallback mode:\n\n"
        if suspect_profile and suspect_profile["total_cases_linked"] > 0:
            p = suspect_profile
            response += (
                f"### Offender Profile: {p['moniker']}\n"
                f"- **Total Database Incidents:** {p['total_cases_linked']}\n"
                f"- **Priority Offender Risk Score:** {p['risk_score']}/10.0\n"
                f"- **Recidivism Count:** {p['recidivism_count']} times\n"
                f"- **Syndicate Affiliation:** {p['syndicate_affiliation']}\n"
                f"- **Preferred Offenses:** {', '.join(p['preferred_crime_types'])}\n"
                f"- **Primary Modus Operandi (MO):** {p['modus_operandi']['mo_summary']}\n\n"
            )
        if stats and stats["total_cases"] > 0:
            response += (
                f"### Statistical Crime Summary ({filters.get('District') or 'All Districts'} - {filters.get('Year') or 'All Years'}):\n"
                f"- **Cases Reported:** {stats['total_cases']}\n"
                f"- **Chargesheeted:** {stats['total_chargesheeted']} cases\n"
                f"- **Judicial Convictions:** {stats['total_convictions']} convictions\n"
                f"- **Conviction Success Rate:** {stats['avg_conviction_rate']}%\n"
                f"- **Average Risk Index:** {stats['avg_risk_score']}\n\n"
            )
        if rag_results:
            response += "### Relevant Case Details (TF-IDF Similarity):\n"
            for idx, r in enumerate(rag_results[:2]):
                response += (
                    f"**Case File #{idx+1} (Score: {r['Similarity_Score']:.2f}):**\n"
                    f"- **Location & Year:** {r['District']} - {r['Year']}\n"
                    f"- **Legal Act & Sections:** {r['Legal_Sections']}\n"
                    f"- **Modus Operandi:** Peak crime hours fall in {r['Incident_Time_Block']}\n"
                    f"- **Summary:** {r['FIR_EN']}\n\n"
                )
        if not (stats and stats["total_cases"] > 0) and not suspect_profile and not rag_results:
            response += "No matching cases or statistics were found in the database for your query parameters."
            
    return response

def get_current_user_for_pdf(
    token: str = Query(None),
    authorization: str = Header(None),
    db: Session = Depends(get_db)
) -> User:
    from jose import JWTError, jwt
    from backend.app.config import JWT_SECRET, JWT_ALGORITHM
    
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials for PDF export",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    jwt_token = token
    if not jwt_token and authorization:
        if authorization.startswith("Bearer "):
            jwt_token = authorization.split(" ")[1]
            
    if not jwt_token:
        raise credentials_exception
        
    try:
        payload = jwt.decode(jwt_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

@router.get("/export-pdf/{session_id}")
def export_chat_pdf(
    session_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_for_pdf)
):
    # Fetch all messages in this session
    messages = db.query(Conversation)\
        .filter(Conversation.session_id == session_id)\
        .order_by(Conversation.timestamp.asc()).all()
        
    if not messages:
        raise HTTPException(status_code=404, detail="No conversation history found for this session ID.")
        
    # Format messages list
    msg_list = []
    for m in messages:
        msg_list.append({
            "sender": m.sender,
            "text": m.message_text,
            "timestamp": m.timestamp
        })
        
    try:
        # Generate the PDF file
        pdf_path = export_conversation_to_pdf(session_id, msg_list)
        return FileResponse(
            pdf_path, 
            media_type="application/pdf", 
            filename=f"KSP_Chat_Report_{session_id}.pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
