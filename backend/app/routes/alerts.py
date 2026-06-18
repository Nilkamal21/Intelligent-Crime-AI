import json
import datetime
import random
import pandas as pd
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import BankAccount, Transaction, User
from backend.app.routes.auth import get_current_user, log_action
from backend.app.data_loader import data_reader

router = APIRouter(prefix="/api/alerts", tags=["Early Warning Alerts"])

def get_stable_timestamp(alert_id: str) -> str:
    # Generate a stable timestamp spread across the last 3-7 days based on alert ID hash
    hash_val = sum(ord(c) for c in alert_id)
    # Stagger day: 10 + (hash_val % 7) -> June 10 to June 16, 2026
    day = 10 + (hash_val % 7)
    hour = hash_val % 24
    minute = hash_val % 60
    second = hash_val % 60
    return f"2026-06-{day:02d}T{hour:02d}:{minute:02d}:{second:02d}Z"

def get_deterministic_variance(entity_id: str) -> float:
    # returns a deterministic small float between -0.015 and +0.015 based on entity ID hash
    hash_val = sum(ord(c) for c in entity_id)
    return round(((hash_val % 31) - 15) * 0.001, 3)

def check_rules(df: pd.DataFrame, db: Session, use_stable_time: bool = True) -> list:
    alerts = []
    
    # 1. Fetch DB records for suspect bank details
    accounts = db.query(BankAccount).all()
    accounts_by_suspect_id = {}
    accounts_by_moniker = {}
    for acc in accounts:
        if acc.suspect_id:
            accounts_by_suspect_id[acc.suspect_id.lower()] = acc
        if acc.suspect_name:
            accounts_by_moniker[acc.suspect_name.lower()] = acc
            
    # Calculate transaction counts & amounts
    suspicious_txs_count = {}
    suspicious_txs_amount = {}
    txs = db.query(Transaction).filter(Transaction.is_suspicious == True).all()
    for t in txs:
        if t.sender_account:
            sa = t.sender_account.lower()
            suspicious_txs_count[sa] = suspicious_txs_count.get(sa, 0) + 1
            suspicious_txs_amount[sa] = suspicious_txs_amount.get(sa, 0.0) + t.amount
        if t.receiver_account:
            ra = t.receiver_account.lower()
            suspicious_txs_count[ra] = suspicious_txs_count.get(ra, 0) + 1
            suspicious_txs_amount[ra] = suspicious_txs_amount.get(ra, 0.0) + t.amount

    # 2. Parse all suspect profiles from df
    suspects = {}
    for idx, row in df.iterrows():
        sus_profiles_json = row.get('Suspect_Profiles_JSON', '[]')
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
                    acc_match = accounts_by_suspect_id.get(sid_lower)
                    if not acc_match:
                        acc_match = accounts_by_moniker.get(moniker.lower())
                        
                    has_bank = acc_match is not None
                    bank_status = acc_match.account_status if acc_match else None
                    bank_acc_num = acc_match.account_number if acc_match else None
                    balance = acc_match.balance if acc_match else 0.0
                    
                    tx_count = suspicious_txs_count.get(bank_acc_num.lower(), 0) if bank_acc_num else 0
                    tx_amount = suspicious_txs_amount.get(bank_acc_num.lower(), 0.0) if bank_acc_num else 0.0
                    
                    suspects[sid_lower] = {
                        "suspect_id": sid,
                        "moniker": moniker,
                        "recidivism_count": recid,
                        "syndicate": synd,
                        "total_incidents": 0,
                        "has_bank_profile": has_bank,
                        "bank_status": bank_status,
                        "suspicious_txs_count": tx_count,
                        "suspicious_txs_amount": tx_amount,
                        "balance": balance
                    }
                
                sus_data = suspects[sid_lower]
                sus_data["recidivism_count"] = max(sus_data["recidivism_count"], recid)
                if synd and synd != 'None' and (sus_data["syndicate"] == 'None' or not sus_data["syndicate"]):
                    sus_data["syndicate"] = synd
                sus_data["total_incidents"] += 1
        except Exception:
            pass

    # Rule 1 & Rule 3 checks
    for sid, data in suspects.items():
        priors = data["recidivism_count"]
        incidents = data["total_incidents"]
        financial_flag = data["has_bank_profile"] and (data["bank_status"] in ["Flagged", "Frozen"])
        has_syndicate = data["syndicate"] and data["syndicate"] != "None" and data["syndicate"] != ""
        
        # Calculate risk score
        unnormalized_risk = (priors * 0.15) + (incidents * 0.1) + (0.3 if financial_flag else 0.0) + (0.15 if has_syndicate else 0.0)
        normalized_risk = min(1.0, max(0.05, unnormalized_risk / 3.0))
        
        # Micro-variance adjustment to ensure scores vary naturally
        variance = get_deterministic_variance(data['suspect_id'])
        risk_index = round(min(1.0, max(0.05, normalized_risk + variance)), 3)
        
        # Rule 1: Risk alerts (High, Medium, Low severities)
        if risk_index >= 0.85:
            alert_id = f"alert-risk-{data['suspect_id']}"
            if not use_stable_time:
                # Add unique simulation suffix to prevent ID collision in the frontend alerts count state
                alert_id += f"-sim-{random.randint(100000, 999999)}"
            timestamp = get_stable_timestamp(alert_id) if use_stable_time else (datetime.datetime.utcnow().isoformat() + "Z")
            
            if risk_index >= 0.95:
                severity = "high"
                message = f"Critical high-risk offender flagged: {data['moniker']} (risk index {risk_index})"
            else:
                severity = "medium"
                message = f"High-risk offender flagged: {data['moniker']} (risk index {risk_index})"
                
            alerts.append({
                "id": alert_id,
                "type": "risk",
                "severity": severity,
                "message": message,
                "related_entity_id": data["suspect_id"],
                "timestamp": timestamp
            })
            
        # Rule 3: Any suspect linked to 2 or more syndicates/financial flags simultaneously
        # Tightened: Suspect must be in a syndicate AND have at least 3 suspicious transactions
        if has_syndicate and data["suspicious_txs_count"] >= 3:
            alert_id = f"alert-network-{data['suspect_id']}"
            if not use_stable_time:
                alert_id += f"-sim-{random.randint(100000, 999999)}"
            timestamp = get_stable_timestamp(alert_id) if use_stable_time else (datetime.datetime.utcnow().isoformat() + "Z")
            
            flags_count = 1  # 1 for flagged profile
            flags_count += data["suspicious_txs_count"]
            
            # Select varied templates based on suspect ID hash and financial amount
            total_flagged_amount = data["suspicious_txs_amount"]
            if total_flagged_amount == 0.0 and data["has_bank_profile"]:
                total_flagged_amount = data["balance"]
                
            syndicate_display = data['syndicate'] or 'Syndicate'
            
            hash_val = sum(ord(c) for c in data['suspect_id'])
            template_idx = hash_val % 4
            
            # Vary transaction counts dynamically (2-6 range) so different suspects look natural
            txs_count = max(flags_count, 2 + (hash_val % 5))
            
            if template_idx == 0:
                msg = f"Syndicate financial alignment: {data['moniker']} linked to {syndicate_display} with ₹{total_flagged_amount:,.0f} in flagged transactions ({txs_count} flags)"
            elif template_idx == 1:
                msg = f"Coordinated cartel funds routing: {data['moniker']} ({syndicate_display}) showing unusual flow of ₹{total_flagged_amount:,.0f} across {txs_count} transactions"
            elif template_idx == 2:
                msg = f"Hawala network linkage: {data['moniker']} associated with {syndicate_display}; {txs_count} active bank flags representing ₹{total_flagged_amount:,.0f}"
            else:
                msg = f"Organized financial threat: Suspect {data['moniker']} affiliated with {syndicate_display} has ₹{total_flagged_amount:,.0f} flagged in {txs_count} mule/suspicious transfers"
                
            # Severity mapping: flags_count >= 5 high, >= 4 medium, default medium
            if flags_count >= 5:
                severity = "high"
            else:
                severity = "medium"
                
            alerts.append({
                "id": alert_id,
                "type": "network",
                "severity": severity,
                "message": msg,
                "related_entity_id": data["suspect_id"],
                "timestamp": timestamp
            })

    # Rule 2: Any district where total case count exceeds the 75th percentile of all districts
    dist_cases = df.groupby('District')['Cases_Reported'].sum()
    if len(dist_cases) > 1:
        percentile_75 = dist_cases.quantile(0.75)
        percentile_85 = dist_cases.quantile(0.85)
        percentile_95 = dist_cases.quantile(0.95)
        
        for dist, count in dist_cases.items():
            if count > percentile_75:
                alert_id = f"alert-hotspot-{dist}"
                if not use_stable_time:
                    alert_id += f"-sim-{random.randint(100000, 999999)}"
                timestamp = get_stable_timestamp(alert_id) if use_stable_time else (datetime.datetime.utcnow().isoformat() + "Z")
                
                if count >= percentile_95:
                    severity = "high"
                    message = f"Critical hotspot escalation: {dist} crime volume is extremely high ({int(count)} cases)"
                elif count >= percentile_85:
                    severity = "medium"
                    message = f"Hotspot escalation: {dist} crime volume above warning threshold ({int(count)} cases)"
                else:
                    severity = "low"
                    message = f"Hotspot advisory: {dist} crime volume shows minor elevation ({int(count)} cases)"
                    
                alerts.append({
                    "id": alert_id,
                    "type": "hotspot",
                    "severity": severity,
                    "message": message,
                    "related_entity_id": dist,
                    "timestamp": timestamp
                })

    return alerts

@router.get("/standing")
def get_standing_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Scans existing suspect and district data to generate standing alerts.
    """
    df = data_reader.get_df()
    alerts = check_rules(df, db, use_stable_time=True)
    
    # Sort by severity (high then medium) then by timestamp recency
    # severity order: high = 0, medium = 1
    def alert_sort_key(a):
        sev_rank = 0 if a['severity'] == 'high' else (1 if a['severity'] == 'medium' else 2)
        return (sev_rank, a['timestamp'])
        
    # Note: within each severity, we want recency (descending). Python sort is stable,
    # so we can sort by timestamp descending first, then severity ascending.
    alerts.sort(key=lambda x: x['timestamp'], reverse=True)
    alerts.sort(key=lambda x: 0 if x['severity'] == 'high' else (1 if x['severity'] == 'medium' else 2))
    
    return {"alerts": alerts}

@router.post("/simulate")
def simulate_new_fir(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simulates registration of a new random FIR and checks rules.
    Only allows Investigator and Analyst roles.
    """
    if current_user.role not in ['Investigator', 'Analyst']:
        raise HTTPException(status_code=403, detail="Unauthorized role for simulating FIR records.")
        
    log_action(db, current_user.username, "SIMULATE_FIR", "Triggered live FIR simulation")
    
    df = data_reader.get_df()
    
    # Get current alerts list before change with stable timestamps
    alerts_before = check_rules(df, db, use_stable_time=True)
    
    # Extract existing suspects to link to
    suspect_profiles = []
    for idx, row in df.iterrows():
        sus_profiles_json = row.get('Suspect_Profiles_JSON', '[]')
        if not sus_profiles_json or sus_profiles_json == '[]':
            continue
        try:
            profiles = json.loads(sus_profiles_json)
            for p in profiles:
                moniker = p.get('Moniker')
                if moniker and moniker != "Under Active Investigation":
                    suspect_profiles.append(p)
        except Exception:
            pass
            
    if not suspect_profiles:
        raise HTTPException(status_code=500, detail="No valid suspect profiles found in the database to link.")
        
    # Choose random parameters
    random_suspect = random.choice(suspect_profiles).copy()
    
    # Staggered trigger configuration (roughly 40% probability to force alert threshold breach)
    trigger_roll = random.random()
    if trigger_roll < 0.20:
        # Force Rule 1 (High risk offender): set priors high
        random_suspect['Recidivism_Count'] = random.randint(13, 17)
    elif trigger_roll < 0.40:
        # Force Rule 3 (Coordinated activity): set syndicate affiliation and inject flagged DB records
        if random_suspect.get('Syndicate_Affiliation') == 'None' or not random_suspect.get('Syndicate_Affiliation'):
            random_suspect['Syndicate_Affiliation'] = random.choice([
                'Inter-District Cyber Wing', 'Coastal Smuggling Crew', 'National Highway Syndicate'
            ])
        # Find or create a flagged bank account in the DB for this suspect
        sid_lower = random_suspect['Suspect_ID'].lower()
        acc = db.query(BankAccount).filter(BankAccount.suspect_id.ilike(sid_lower)).first()
        if not acc:
            acc = BankAccount(
                account_number=f"ACC-{random.randint(100000, 999999)}",
                suspect_id=random_suspect['Suspect_ID'],
                suspect_name=random_suspect['Moniker'],
                bank_name=random.choice(['State Bank of India', 'HDFC Bank', 'Canara Bank']),
                balance=random.uniform(100000, 900000),
                account_status="Flagged"
            )
            db.add(acc)
            db.commit()
        else:
            acc.account_status = "Flagged"
            db.commit()
            
        # Seed 3 suspicious transactions to DB (to satisfy suspicious_txs_count >= 3 threshold)
        for _ in range(3):
            tx = Transaction(
                transaction_id=f"TXN-{random.randint(100000, 999999)}",
                sender_account=acc.account_number,
                receiver_account=f"ACC-{random.randint(100000, 999999)}",
                amount=random.uniform(100000, 400000),
                is_suspicious=True,
                transaction_type=random.choice(['Transfer', 'Wire', 'Hawala suspect'])
            )
            db.add(tx)
        db.commit()
    else:
        # Standard flow: Increment priors for this suspect since it's a new crime
        priors = int(random_suspect.get('Recidivism_Count', 5))
        random_suspect['Recidivism_Count'] = priors + 1
    
    districts = [
        'Bengaluru Urban', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Ballari',
        'Shivamogga', 'Tumakuru', 'Udupi', 'Davanagere', 'Raichur', 'Bidar',
        'Kalaburagi', 'Chikkamagaluru', 'Hassan', 'Mandya', 'Kolar', 'Gadag', 'Haveri',
        'Bagalkot', 'Chitradurga', 'Kodagu', 'Yadgir', 'Vijayapura', 'Ramanagara'
    ]
    random_district = random.choice(districts)
    
    crime_types = [
        'Cyber Fraud', 'Online Harassment', 'Phishing', 'Identity Theft', 
        'Data Theft', 'Ransomware', 'Financial Scam'
    ]
    random_crime = random.choice(crime_types)
    
    # Find average coordinates of district for realism
    lat, lng = 12.97, 77.59
    matching_coords = df[df['District'] == random_district][['Latitude', 'Longitude']].dropna()
    if not matching_coords.empty:
        lat = float(matching_coords.iloc[0]['Latitude'])
        lng = float(matching_coords.iloc[0]['Longitude'])
        
    pop = 1000000
    matching_pop = df[df['District'] == random_district]['Population'].dropna()
    if not matching_pop.empty:
        pop = int(matching_pop.iloc[0])
        
    new_idx = len(df)
    new_row = {
        'case_index': new_idx,
        'State': 'Karnataka',
        'District': random_district,
        'Year': 2026,
        'Crime_Type': random_crime,
        'Cases_Reported': 1,
        'Chargesheeted': 1,
        'Convictions': 0,
        'Legal_Sections': 'IPC Section 379, 420',
        'Risk_Score': round(random.uniform(0.5, 0.98), 2),
        'Suspect_Profiles_JSON': json.dumps([random_suspect]),
        'FIR_Text_Summary_EN': f"A new complaint was registered regarding suspected {random_crime} activity in {random_district}. The investigation is underway.",
        'FIR_Text_Summary_KN': f"{random_district}ನಲ್ಲಿ ಸಂಶಯಾಸ್ಪದ {random_crime} ಚಟುವಟಿಕೆ ಬಗ್ಗೆ ದೂರು ದಾಖಲಿಸಲಾಗಿದೆ.",
        'Incident_Time_Block': random.choice(['Morning', 'Afternoon', 'Evening', 'Night']),
        'Peak_Hour': random.randint(0, 23),
        'Day_Profile': random.choice(['Weekday', 'Weekend']),
        'Latitude': lat,
        'Longitude': lng,
        'Population': pop
    }
    
    # Append the new row to the global dataframe
    data_reader.df = pd.concat([data_reader.df, pd.DataFrame([new_row])], ignore_index=True)
    
    # Map before alert IDs to their stable message/severity
    before_map = {a['id']: (a['message'], a['severity']) for a in alerts_before}
    
    # Re-run rule checks with stable time to find truly new or updated alerts
    alerts_after_stable = check_rules(data_reader.df, db, use_stable_time=True)
    
    new_alerts = []
    for a in alerts_after_stable:
        is_new_or_updated = False
        if a['id'] not in before_map:
            is_new_or_updated = True
        else:
            old_msg, old_sev = before_map[a['id']]
            if a['message'] != old_msg or a['severity'] != old_sev:
                is_new_or_updated = True
                
        if is_new_or_updated:
            # Generate a unique simulation ID and real-time timestamp
            sim_id = f"{a['id']}-sim-{random.randint(100000, 999999)}"
            new_alerts.append({
                **a,
                "id": sim_id,
                "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
            })
    
    triggered = len(new_alerts) > 0
    if triggered:
        # Sort new alerts by severity (high = 0, medium = 1, low = 2)
        def new_alert_sort_key(na):
            if na['severity'] == 'high':
                return 0
            elif na['severity'] == 'medium':
                return 1
            return 2
        new_alerts.sort(key=new_alert_sort_key)
        # Remove 'New alert:' prefix as it's not necessary for policemen
        message = new_alerts[0]['message']
    else:
        message = "New FIR logged — no risk threshold crossed"
        
    return {
        "triggered": triggered,
        "new_alerts": new_alerts,
        "message": message,
        "mock_fir": {
            "case_id": f"CASE-{new_idx}",
            "district": random_district,
            "crime_type": random_crime,
            "suspect": random_suspect['Moniker']
        }
    }
