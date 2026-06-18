import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import User
from backend.app.routes.auth import get_current_user, log_action
from backend.app.data_loader import data_reader

router = APIRouter(prefix="/api/analytics", tags=["Crime Analytics & Trends"])

# Deterministic Socio-Demographic profiles for the 25 Karnataka Districts
# (Approximated based on census-level trends for Karnataka: Urbanization, Migration, Economic Stress, Literacy)
DISTRICT_SOCIOLOGICAL_PROFILES = {
    "Bengaluru Urban":   {"urbanization": 0.95, "migration": 0.82, "economic_stress": 0.22, "literacy": 0.89},
    "Mysuru":            {"urbanization": 0.65, "migration": 0.45, "economic_stress": 0.38, "literacy": 0.82},
    "Mangaluru":         {"urbanization": 0.75, "migration": 0.58, "economic_stress": 0.28, "literacy": 0.90},
    "Hubballi":          {"urbanization": 0.70, "migration": 0.52, "economic_stress": 0.42, "literacy": 0.80},
    "Belagavi":          {"urbanization": 0.48, "migration": 0.35, "economic_stress": 0.55, "literacy": 0.74},
    "Ballari":           {"urbanization": 0.55, "migration": 0.48, "economic_stress": 0.62, "literacy": 0.67},
    "Shivamogga":        {"urbanization": 0.45, "migration": 0.28, "economic_stress": 0.44, "literacy": 0.80},
    "Tumakuru":          {"urbanization": 0.42, "migration": 0.32, "economic_stress": 0.48, "literacy": 0.75},
    "Udupi":             {"urbanization": 0.50, "migration": 0.38, "economic_stress": 0.25, "literacy": 0.92},
    "Davanagere":        {"urbanization": 0.46, "migration": 0.29, "economic_stress": 0.50, "literacy": 0.76},
    "Raichur":           {"urbanization": 0.30, "migration": 0.34, "economic_stress": 0.78, "literacy": 0.60},
    "Bidar":             {"urbanization": 0.32, "migration": 0.30, "economic_stress": 0.72, "literacy": 0.71},
    "Kalaburagi":        {"urbanization": 0.38, "migration": 0.36, "economic_stress": 0.75, "literacy": 0.65},
    "Chikkamagaluru":    {"urbanization": 0.35, "migration": 0.22, "economic_stress": 0.40, "literacy": 0.79},
    "Hassan":            {"urbanization": 0.36, "migration": 0.24, "economic_stress": 0.42, "literacy": 0.76},
    "Mandya":            {"urbanization": 0.34, "migration": 0.20, "economic_stress": 0.45, "literacy": 0.75},
    "Kolar":             {"urbanization": 0.38, "migration": 0.32, "economic_stress": 0.52, "literacy": 0.73},
    "Gadag":             {"urbanization": 0.35, "migration": 0.26, "economic_stress": 0.58, "literacy": 0.75},
    "Haveri":            {"urbanization": 0.32, "migration": 0.22, "economic_stress": 0.60, "literacy": 0.77},
    "Bagalkot":          {"urbanization": 0.36, "migration": 0.28, "economic_stress": 0.64, "literacy": 0.72},
    "Chitradurga":       {"urbanization": 0.38, "migration": 0.26, "economic_stress": 0.58, "literacy": 0.74},
    "Kodagu":            {"urbanization": 0.22, "migration": 0.18, "economic_stress": 0.30, "literacy": 0.83},
    "Yadgir":            {"urbanization": 0.25, "migration": 0.32, "economic_stress": 0.82, "literacy": 0.52},
    "Vijayapura":        {"urbanization": 0.36, "migration": 0.30, "economic_stress": 0.68, "literacy": 0.67},
    "Ramanagara":        {"urbanization": 0.40, "migration": 0.42, "economic_stress": 0.44, "literacy": 0.70}
}

@router.get("/overview")
def get_dashboard_overview(
    district: str = Query(None),
    year: int = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    df = data_reader.get_df()
    mask = pd.Series(True, index=df.index)
    if district and district.lower() != "statewide":
        mask = mask & (df['District'] == district)
    if year:
        mask = mask & (df['Year'] == int(year))
        
    f_df = df[mask]
    
    # Calculate stats
    total_cases = int(f_df['Cases_Reported'].sum())
    total_chargesheeted = int(f_df['Chargesheeted'].sum())
    total_convictions = int(f_df['Convictions'].sum())
    avg_risk = float(f_df['Risk_Score'].mean()) if len(f_df) > 0 else 0.0
    
    conviction_rate = (total_convictions / total_chargesheeted * 100) if total_chargesheeted > 0 else 0.0
    
    # Yearly trend series
    yearly_df = f_df.groupby('Year').agg({
        'Cases_Reported': 'sum',
        'Chargesheeted': 'sum',
        'Convictions': 'sum',
        'Risk_Score': 'mean'
    }).reset_index()
    
    yearly_trends = yearly_df.to_dict(orient="records")
    
    # Crime Type Distribution
    crime_df = f_df.groupby('Crime_Type').agg({
        'Cases_Reported': 'sum',
        'Chargesheeted': 'sum',
        'Convictions': 'sum',
        'Risk_Score': 'mean'
    }).reset_index().sort_values(by="Cases_Reported", ascending=False)
    
    crime_types = crime_df.to_dict(orient="records")
    
    # District Leaderboard
    dist_df = f_df.groupby('District').agg({
        'Cases_Reported': 'sum',
        'Risk_Score': 'mean',
        'Population': 'first',
    }).reset_index()
    # Recalculate rates
    dist_df['crime_rate_per_100k'] = round((dist_df['Cases_Reported'] / dist_df['Population']) * 100000, 2)
    dist_df = dist_df.sort_values(by="Cases_Reported", ascending=False)
    dist_trends = dist_df.to_dict(orient="records")
    
    return {
        "summary": {
            "total_cases": total_cases,
            "total_chargesheeted": total_chargesheeted,
            "total_convictions": total_convictions,
            "conviction_rate": round(conviction_rate, 2),
            "avg_risk_score": round(avg_risk, 3)
        },
        "yearly_trends": yearly_trends,
        "crime_types": crime_types,
        "district_trends": dist_trends[:10] # Top 10 districts
    }

@router.get("/hotspots")
def get_crime_hotspots(
    crime_type: str = Query(None),
    year: int = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    df = data_reader.get_df()
    mask = pd.Series(True, index=df.index)
    if crime_type:
        mask = mask & (df['Crime_Type'] == crime_type)
    if year:
        mask = mask & (df['Year'] == int(year))
        
    f_df = df[mask]
    
    # Group by District, Latitude, Longitude, and Crime_Type to get varying active hotspots
    hotspots = f_df.groupby(['District', 'Latitude', 'Longitude', 'Crime_Type']).agg({
        'Cases_Reported': 'sum',
        'Risk_Score': 'mean',
        'Sub_Location': 'first',
        'Sub_Location_KN': 'first'
    }).reset_index()
    
    # Filter out hotspots with 0 cases
    hotspots = hotspots[hotspots['Cases_Reported'] > 0]
    
    # Convert to leaflet markers
    markers = []
    for _, row in hotspots.iterrows():
        if pd.isna(row['Latitude']) or pd.isna(row['Longitude']):
            continue
        markers.append({
            "district": row['District'],
            "sub_location": row.get('Sub_Location', 'General Sector'),
            "sub_location_kn": row.get('Sub_Location_KN', 'ಸಾಮಾನ್ಯ ವಲಯ'),
            "lat": float(row['Latitude']),
            "lng": float(row['Longitude']),
            "cases": int(row['Cases_Reported']),
            "risk_score": round(float(row['Risk_Score']), 2),
            "primary_crime": row['Crime_Type']
        })
        
    return {"hotspots": markers}

@router.get("/temporal")
def get_temporal_insights(
    district: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    df = data_reader.get_df()
    mask = pd.Series(True, index=df.index)
    if district and district.lower() != "statewide":
        mask = mask & (df['District'] == district)
        
    f_df = df[mask]
    
    # Incident Time Block distribution
    time_block_dist = f_df.groupby('Incident_Time_Block')['Cases_Reported'].sum().reset_index().to_dict(orient="records")
    
    # Day Profile distribution
    day_profile_dist = f_df.groupby('Day_Profile')['Cases_Reported'].sum().reset_index().to_dict(orient="records")
    
    # Peak hour distribution
    peak_hour_dist = f_df.groupby('Peak_Hour')['Cases_Reported'].sum().reset_index().to_dict(orient="records")
    
    return {
        "time_blocks": time_block_dist,
        "day_profiles": day_profile_dist,
        "peak_hours": peak_hour_dist
    }

@router.get("/sociological")
def get_sociological_correlations(
    crime_type: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Correlates crime rates with simulated sociological factors (urbanization, migration, etc.)
    across Karnataka districts.
    """
    df = data_reader.get_df()
    mask = pd.Series(True, index=df.index)
    if crime_type:
        mask = mask & (df['Crime_Type'] == crime_type)
        
    f_df = df[mask]
    
    # Calculate total cases and rates per district
    dist_crime = f_df.groupby('District').agg({
        'Cases_Reported': 'sum',
        'Population': 'first'
    }).reset_index()
    
    # Recalculate crime rate per 100k
    dist_crime['crime_rate_100k'] = (dist_crime['Cases_Reported'] / dist_crime['Population']) * 100000
    
    # Attach sociological profiles
    merged_data = []
    for _, row in dist_crime.iterrows():
        dist = row['District']
        if dist in DISTRICT_SOCIOLOGICAL_PROFILES:
            profile = DISTRICT_SOCIOLOGICAL_PROFILES[dist]
            merged_data.append({
                "district": dist,
                "crime_rate": float(row['crime_rate_100k']),
                "cases": int(row['Cases_Reported']),
                "urbanization": profile["urbanization"],
                "migration": profile["migration"],
                "economic_stress": profile["economic_stress"],
                "literacy": profile["literacy"]
            })
            
    # Calculate correlation matrix using pandas
    if len(merged_data) > 3:
        corr_df = pd.DataFrame(merged_data)
        correlations = {
            "urbanization": float(corr_df['crime_rate'].corr(corr_df['urbanization'])),
            "migration": float(corr_df['crime_rate'].corr(corr_df['migration'])),
            "economic_stress": float(corr_df['crime_rate'].corr(corr_df['economic_stress'])),
            "literacy": float(corr_df['crime_rate'].corr(corr_df['literacy']))
        }
    else:
        correlations = {"urbanization": 0, "migration": 0, "economic_stress": 0, "literacy": 0}
        
    return {
        "district_data": merged_data,
        "correlations": {
            k: round(v, 3) for k, v in correlations.items()
        },
        "insights": [
            "Urbanization and migration trends show a positive correlation with cybercrime and fraud rates, specifically in tech corridors like Bengaluru Urban and Mangaluru.",
            "Higher economic stress indices are moderately correlated with robbery and burglary cases in border/semi-urban districts.",
            "Higher literacy districts correspond to higher cybercrime reporting rates due to increased digital literacy and trust in reporting channels."
        ]
    }

@router.get("/offenders")
def get_repeat_offenders(
    district: str = Query(None),
    min_recidivism: int = Query(0),
    search: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Log audit trail
    log_action(db, current_user.username, "VIEW_OFFENDERS", f"district={district}, min_recidivism={min_recidivism}, search={search}, page={page}, limit={limit}")

    import json
    from backend.app.models import BankAccount
    
    # Load bank accounts map
    accounts = db.query(BankAccount).all()
    accounts_by_suspect_id = {}
    accounts_by_moniker = {}
    for acc in accounts:
        if acc.suspect_id:
            accounts_by_suspect_id[acc.suspect_id.lower()] = acc
        if acc.suspect_name:
            accounts_by_moniker[acc.suspect_name.lower()] = acc

    df = data_reader.get_df()
    
    suspects = {}
    has_search = search and search.strip()
    
    # Fast zipped iterator (Requirement: Speed up syncing/query time significantly)
    zip_data = zip(df['case_index'], df['District'], df['Crime_Type'], df['Suspect_Profiles_JSON'])
    
    for case_idx, row_district, crime_type, sus_profiles_json in zip_data:
        # Bypass district check if search query is active
        if not has_search:
            if district and district.lower() != 'statewide' and row_district.lower() != district.lower():
                continue
            
        if not sus_profiles_json or sus_profiles_json == '[]':
            continue
            
        try:
            sus_profiles = json.loads(sus_profiles_json)
            for s in sus_profiles:
                moniker = s.get('Moniker')
                sid = s.get('Suspect_ID')
                recid = int(s.get('Recidivism_Count', 0))
                synd = s.get('Syndicate_Affiliation', 'None')
                
                if not moniker or moniker == "Under Active Investigation":
                    continue
                if not sid:
                    sid = moniker
                    
                sid_lower = sid.lower()
                
                if sid_lower not in suspects:
                    has_bank_profile = False
                    bank_acc_num = None
                    bank_status = None
                    
                    acc_match = accounts_by_suspect_id.get(sid_lower)
                    if not acc_match:
                        acc_match = accounts_by_moniker.get(moniker.lower())
                        
                    if acc_match:
                        has_bank_profile = True
                        bank_acc_num = acc_match.account_number
                        bank_status = acc_match.account_status
                        
                    suspects[sid_lower] = {
                        "suspect_id": sid,
                        "moniker": moniker,
                        "recidivism_count": recid,
                        "syndicate": synd,
                        "associated_cases": [],
                        "districts": set(),
                        "crime_types": set(),
                        "max_risk_score": 0.0,
                        "total_incidents": 0,
                        "has_bank_profile": has_bank_profile,
                        "bank_account": bank_acc_num,
                        "bank_status": bank_status
                    }
                
                sus_data = suspects[sid_lower]
                sus_data["recidivism_count"] = max(sus_data["recidivism_count"], recid)
                if synd and synd != 'None' and (sus_data["syndicate"] == 'None' or not sus_data["syndicate"]):
                    sus_data["syndicate"] = synd
                
                case_ref = f"CASE-{case_idx}"
                if case_ref not in sus_data["associated_cases"]:
                    sus_data["associated_cases"].append(case_ref)
                sus_data["districts"].add(row_district)
                sus_data["crime_types"].add(crime_type)
                sus_data["total_incidents"] += 1
        except Exception:
            pass
            
    offenders_list = []
    for sid, data in suspects.items():
        # Bypass min priors check if search query is active
        if not has_search:
            if data["recidivism_count"] < min_recidivism:
                continue
            
        priors = data["recidivism_count"]
        incidents = data["total_incidents"]
        financial_flag = data["has_bank_profile"] and (data["bank_status"] in ["Flagged", "Frozen"])
        has_syndicate = data["syndicate"] and data["syndicate"] != "None" and data["syndicate"] != ""
        
        # Calculate unnormalized risk score:
        # risk = (priors * 0.15) + (incidents * 0.1) + (financial_flag ? 0.3 : 0) + (syndicate_severity_weight)
        unnormalized_risk = (priors * 0.15) + (incidents * 0.1) + (0.3 if financial_flag else 0.0) + (0.15 if has_syndicate else 0.0)
        
        # Normalize to 0-1 scale by dividing by 3.0 and clamping
        normalized_risk = min(1.0, max(0.05, unnormalized_risk / 3.0))
        data["max_risk_score"] = round(normalized_risk, 3)
        
        # Search filter
        if has_search:
            q = search.lower().strip()
            if q not in data["moniker"].lower() and q not in data["suspect_id"].lower() and q not in data["syndicate"].lower():
                continue
                
        data["districts"] = list(data["districts"])
        data["crime_types"] = list(data["crime_types"])
        offenders_list.append(data)
        
    # Sort the list by Max Risk Score descending by default (Requirement 5)
    offenders_list.sort(key=lambda x: x["max_risk_score"], reverse=True)
    
    # Calculate pagination details (Requirement 4)
    total_count = len(offenders_list)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_list = offenders_list[start_idx:end_idx]
    
    import math
    total_pages = math.ceil(total_count / limit) if limit > 0 else 1
    
    return {
        "offenders": paginated_list,
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": total_pages
    }

