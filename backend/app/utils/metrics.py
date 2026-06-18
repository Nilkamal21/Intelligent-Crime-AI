import json
import pandas as pd

def calculate_offender_metrics(df: pd.DataFrame, suspect_name: str) -> dict:
    """
    Analyzes crime history, modus operandi, and calculates a composite risk score 
    for a suspect across the entire KSP database.
    """
    # Filter rows where the suspect is present in Suspect_Profiles_JSON
    suspect_rows = []
    
    for idx, row in df.iterrows():
        try:
            profiles = json.loads(row['Suspect_Profiles_JSON'])
            for p in profiles:
                moniker = p.get('Moniker', '')
                if moniker.strip().lower() == suspect_name.strip().lower():
                    # Keep track of the specific suspect instance data and the case row
                    suspect_rows.append((p, row))
        except:
            pass

    if not suspect_rows:
        return {
            "moniker": suspect_name,
            "total_cases_linked": 0,
            "risk_score": 0.0,
            "recidivism_count": 0,
            "syndicate_affiliation": "None",
            "preferred_crime_types": [],
            "preferred_districts": [],
            "modus_operandi": {}
        }

    # Aggregate metrics
    recidivism_count = max([p.get('Recidivism_Count', 0) for p, _ in suspect_rows])
    syndicates = set([p.get('Syndicate_Affiliation', 'None') for p, _ in suspect_rows if p.get('Syndicate_Affiliation') != 'None'])
    syndicate = list(syndicates)[0] if syndicates else "None"
    
    total_cases = len(suspect_rows)
    
    # Preferred crime types & locations
    crime_types = {}
    districts = {}
    time_blocks = {}
    day_profiles = {}
    total_reported_cases = 0
    total_convicted_cases = 0

    for _, row in suspect_rows:
        ct = row['Crime_Type']
        dist = row['District']
        tb = row['Incident_Time_Block']
        dp = row['Day_Profile']
        
        crime_types[ct] = crime_types.get(ct, 0) + 1
        districts[dist] = districts.get(dist, 0) + 1
        time_blocks[tb] = time_blocks.get(tb, 0) + 1
        day_profiles[dp] = day_profiles.get(dp, 0) + 1
        
        total_reported_cases += row['Cases_Reported']
        total_convicted_cases += row['Convictions']

    # Sort preferred lists
    sorted_crimes = sorted(crime_types.items(), key=lambda x: x[1], reverse=True)
    sorted_districts = sorted(districts.items(), key=lambda x: x[1], reverse=True)
    sorted_times = sorted(time_blocks.items(), key=lambda x: x[1], reverse=True)
    sorted_days = sorted(day_profiles.items(), key=lambda x: x[1], reverse=True)

    # Calculate composite priority risk score (0.0 to 10.0 scale)
    # Weights: Recidivism (40%), Syndicate involvement (20%), Case volume (20%), Conviction frequency (20%)
    recidivism_weight = min(recidivism_count * 1.5, 4.0) # Up to 4.0 pts
    syndicate_weight = 2.0 if syndicate != "None" else 0.0 # 2.0 pts if in a syndicate
    case_volume_weight = min(total_cases * 0.4, 2.0) # Up to 2.0 pts
    
    conviction_ratio = (total_convicted_cases / total_reported_cases) if total_reported_cases > 0 else 0.0
    conviction_weight = conviction_ratio * 2.0 # Up to 2.0 pts

    composite_score = round(recidivism_weight + syndicate_weight + case_volume_weight + conviction_weight, 2)
    # Cap at 10.0
    composite_score = min(composite_score, 10.0)

    # Modus Operandi (MO) profile
    preferred_crime = sorted_crimes[0][0] if sorted_crimes else "Unknown"
    preferred_time = sorted_times[0][0] if sorted_times else "Unknown"
    preferred_day = sorted_days[0][0] if sorted_days else "Unknown"

    mo_description = (
        f"Operates primarily during {preferred_time} on {preferred_day}s, "
        f"specializing in {preferred_crime} offenses across {len(districts)} districts."
    )

    return {
        "moniker": suspect_name,
        "total_cases_linked": total_cases,
        "risk_score": composite_score,
        "recidivism_count": recidivism_count,
        "syndicate_affiliation": syndicate,
        "preferred_crime_types": [c for c, _ in sorted_crimes[:3]],
        "preferred_districts": [d for d, _ in sorted_districts[:3]],
        "modus_operandi": {
            "peak_time_block": preferred_time,
            "peak_day_profile": preferred_day,
            "mo_summary": mo_description,
            "crime_distribution": crime_types,
            "district_distribution": districts
        }
    }
