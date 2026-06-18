import json
import random
import datetime
import hashlib
import pandas as pd
from sqlalchemy.orm import Session
from backend.app.config import CSV_PATH
from backend.app.models import User, BankAccount, Transaction
from backend.app.database import engine, SessionLocal, Base

# Simple SHA256 helper for password hashing to avoid bcrypt C-compiler issues on Windows
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def seed_database():
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Users (RBAC) if they don't exist
        if db.query(User).count() == 0:
            print("Seeding Users...")
            users = [
                User(username="investigator", role="Investigator", password_hash=hash_password("ksp123")),
                User(username="analyst", role="Analyst", password_hash=hash_password("ksp123")),
                User(username="supervisor", role="Supervisor", password_hash=hash_password("ksp123")),
                User(username="policymaker", role="Policymaker", password_hash=hash_password("ksp123")),
            ]
            db.add_all(users)
            db.commit()
            print("Users seeded successfully.")

        # 2. Parse CSV and seed Bank Accounts
        if db.query(BankAccount).count() == 0:
            print("Seeding Bank Accounts from CSV Suspect Profiles...")
            
            # Read CSV
            df = pd.read_csv(CSV_PATH)
            
            # Extract unique suspects
            suspects_map = {}
            for _, row in df.iterrows():
                try:
                    sus_profiles = json.loads(row['Suspect_Profiles_JSON'])
                    for s in sus_profiles:
                        sid = s.get('Suspect_ID')
                        name = s.get('Moniker')
                        syndicate = s.get('Syndicate_Affiliation', 'None')
                        
                        if not sid or sid == "KA-CRM-UNKNOWN":
                            continue
                        
                        if sid not in suspects_map:
                            suspects_map[sid] = {
                                "name": name,
                                "syndicate": syndicate,
                                "recidivism": s.get('Recidivism_Count', 0)
                            }
                except Exception as e:
                    pass

            banks = ["State Bank of India", "Canara Bank", "Karnataka Bank", "HDFC Bank", "ICICI Bank", "Bank of Baroda"]
            random.seed(42) # Deterministic seeding

            db_accounts = []
            for sid, info in suspects_map.items():
                # Generate a mock account number
                acc_num = f"KA-ACC-{sid.split('-')[-1]}"
                bank_name = random.choice(banks)
                # Flag account if recidivism is high or in a syndicate
                status = "Flagged" if (info['recidivism'] > 3 or info['syndicate'] != "None") else "Active"
                balance = round(random.uniform(50000, 2500000), 2)
                
                acc = BankAccount(
                    account_number=acc_num,
                    suspect_id=sid,
                    suspect_name=info['name'],
                    bank_name=bank_name,
                    balance=balance,
                    account_status=status
                )
                db_accounts.append(acc)
                db.add(acc)
            
            db.commit()
            print(f"Seeded {len(db_accounts)} Bank Accounts.")

            # 3. Seed Transactions (Relational Ledger Linkage)
            if db.query(Transaction).count() == 0:
                print("Seeding Financial Transactions...")
                accounts = db.query(BankAccount).all()
                acc_list = [a.account_number for a in accounts]
                
                # Group accounts by syndicate to create realistic transaction clusters
                syndicate_accounts = {}
                for acc in accounts:
                    # Look up suspect syndicate
                    sid = acc.suspect_id
                    synd = suspects_map.get(sid, {}).get("syndicate", "None")
                    if synd != "None":
                        if synd not in syndicate_accounts:
                            syndicate_accounts[synd] = []
                        syndicate_accounts[synd].append(acc.account_number)

                transactions = []
                # Start date for transaction history
                start_date = datetime.datetime(2020, 1, 1)

                # Generate ~3000 transactions
                for i in range(3000):
                    tx_id = f"TXN-{100000 + i}"
                    tx_date = start_date + datetime.timedelta(
                        days=random.randint(0, 1500), 
                        hours=random.randint(0, 23), 
                        minutes=random.randint(0, 59)
                    )
                    
                    # Choose flow: 40% syndicate transfers (highly suspicious), 50% random inter-suspect transfers, 10% cash deposits
                    flow_type = random.random()
                    
                    is_suspicious = False
                    tx_type = "Transfer"
                    sender = None
                    receiver = None
                    amount = round(random.uniform(5000, 500000), 2)

                    if flow_type < 0.4:
                        # Syndicate flow
                        synd = random.choice(list(syndicate_accounts.keys()))
                        synd_accs = syndicate_accounts[synd]
                        if len(synd_accs) >= 2:
                            sender, receiver = random.sample(synd_accs, 2)
                            tx_type = "Wire" if amount > 100000 else "Transfer"
                            # 30% chance syndicate wire is flagged as suspicious
                            if amount > 150000 or random.random() < 0.2:
                                is_suspicious = True
                                tx_type = "Hawala suspect"
                    elif flow_type < 0.9:
                        # Random inter-suspect flow
                        sender, receiver = random.sample(acc_list, 2)
                        tx_type = "Transfer"
                        if amount > 400000:
                            is_suspicious = True
                    else:
                        # Cash deposit (no sender)
                        receiver = random.choice(acc_list)
                        tx_type = "Cash Deposit"
                        if amount > 200000:
                            is_suspicious = True

                    txn = Transaction(
                        transaction_id=tx_id,
                        sender_account=sender,
                        receiver_account=receiver,
                        amount=amount,
                        timestamp=tx_date,
                        transaction_type=tx_type,
                        is_suspicious=is_suspicious
                    )
                    db.add(txn)
                
                db.commit()
                print("Seeded 3000 transactions.")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
