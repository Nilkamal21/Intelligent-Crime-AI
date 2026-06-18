import json
import networkx as nx
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import BankAccount, Transaction, User
from backend.app.routes.auth import get_current_user, log_action
from backend.app.data_loader import data_reader

router = APIRouter(prefix="/api/network", tags=["Criminal Network Analysis"])

def get_groq_client_local():
    try:
        from backend.app.routes.chat import get_groq_client
        return get_groq_client()
    except Exception:
        return None

def generate_ai_insight(suspects: list, cases: list) -> str:
    if not suspects:
        return "Investigation Insight: No active suspect network is currently mapped."
    
    # We will format the narrative based on the primary suspect and case details.
    s = suspects[0]
    name = s.get("moniker", "Unknown")
    suspect_id = s.get("suspect_id", "Unknown")
    syndicate = s.get("syndicate", "None")
    if syndicate == "None" or not syndicate:
        syndicate = "No Active Syndicate"
    recidivism = s.get("recidivism", 0)
    
    # Separated active vs. convicted incident counts
    active_cases = [c for c in cases if c.get("convictions", 0) == 0]
    convicted_cases = [c for c in cases if c.get("convictions", 0) > 0]
    
    total_cases = len(cases)
    
    # Collect unique legal sections:
    sections_set = set()
    for c in cases:
        sect = c.get("legal_sections", "N/A")
        if sect and sect != "N/A":
            for s_part in sect.split(','):
                sections_set.add(s_part.strip())
    
    legal_sections = ", ".join(sorted(list(sections_set))) if sections_set else "N/A"
    
    # Collect unique FIR numbers:
    fir_numbers = [c.get("fir_number", "") for c in cases if c.get("fir_number")]
    fir_refs = f" ({', '.join(fir_numbers)})" if fir_numbers else ""
    
    status_parts = []
    if active_cases:
        status_parts.append(f"{len(active_cases)} active investigation" + ("s" if len(active_cases) > 1 else ""))
    if convicted_cases:
        total_convictions = sum(c.get("convictions", 0) for c in convicted_cases)
        status_parts.append(f"{total_convictions} resulting in judicial conviction" + ("s" if total_convictions > 1 else ""))
    status_suffix = " — " + ", ".join(status_parts) if status_parts else ""
    
    legal_status_text = f"Linked to {total_cases} incident{'s' if total_cases > 1 else ''}{fir_refs} under {legal_sections}{status_suffix}."
    
    # Compute Mode/frequent values for time block, peak hour, and day profile to ensure dynamic patterns
    from collections import Counter
    
    time_blocks = [c.get("incident_time_block", "N/A") for c in cases if c.get("incident_time_block") and c.get("incident_time_block") != "N/A"]
    time_block = Counter(time_blocks).most_common(1)[0][0] if time_blocks else "N/A"
    
    peak_hours = [c.get("peak_hour", 12) for c in cases if c.get("peak_hour") is not None]
    peak_hour = Counter(peak_hours).most_common(1)[0][0] if peak_hours else 12
    
    day_profiles = [c.get("day_profile", "N/A") for c in cases if c.get("day_profile") and c.get("day_profile") != "N/A"]
    day_profile = Counter(day_profiles).most_common(1)[0][0] if day_profiles else "N/A"
    
    # Get unique districts and crime types of cases linked to this suspect
    unique_districts = sorted(list(set(c.get("district", "Unknown") for c in cases if c.get("district"))))
    unique_crimes = sorted(list(set(c.get("crime_type", "Unknown") for c in cases if c.get("crime_type"))))
    
    primary_district = unique_districts[0] if unique_districts else "Unknown"
    primary_crime = unique_crimes[0] if unique_crimes else "Unknown"
    
    # Individual suspect Modus Operandi description (from their linked cases statistics)
    suspect_mo = (
        f"Target suspect operates primarily within the {', '.join(unique_districts)} region, "
        f"demonstrating a preference for {', '.join(unique_crimes)} offenses. "
        f"Execution patterns reveal high frequency of activity during {time_block} hours, "
        f"typically peaking around {peak_hour:02d}:00 on {day_profile}s."
    )
    
    # Get FIR summaries:
    fir_summaries = [c.get("fir_summary", "") for c in cases if c.get("fir_summary")]
    district_context_text = fir_summaries[0] if fir_summaries else "No district context data available."

    # Narrative output format precisely matching the law enforcement template with bulleted lines.
    briefing = (
        f"• TARGET NARRATIVE: Suspect {name} (ID: {suspect_id}) is currently classified under {syndicate}.\n\n"
        f"• LEGAL STATUS: {legal_status_text}\n\n"
        f"• MODUS OPERANDI: {suspect_mo}\n\n"
        f"• DISTRICT CONTEXT - {primary_district} ({primary_crime}): {district_context_text}\n\n"
        f"• TACTICAL RISK ASSESSMENT: The target presents an active recidivism rate profile ({recidivism} prior offenses). "
        f"Operations peak predominantly during {time_block} hours ({peak_hour:02d}:00) on {day_profile}s."
    )
    
    return briefing

@router.get("/suggestions")
def get_search_suggestions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    df = data_reader.get_df()
    sus_monikers = set()
    sus_ids = set()
    syndicates = set()
    cases = set()
    
    for idx, row in df.iterrows():
        cases.add(f"CASE-{row['case_index']}")
        try:
            sus_profiles = json.loads(row['Suspect_Profiles_JSON'])
            for s in sus_profiles:
                moniker = s.get('Moniker')
                sid = s.get('Suspect_ID')
                synd = s.get('Syndicate_Affiliation', 'None')
                
                if moniker and moniker != "Under Active Investigation":
                    sus_monikers.add(moniker)
                if sid:
                    sus_ids.add(sid)
                if synd and synd != "None":
                    syndicates.add(synd)
        except Exception:
            pass
            
    return {
        "suspects": sorted(list(sus_monikers)),
        "suspect_ids": sorted(list(sus_ids)),
        "syndicates": sorted(list(syndicates)),
        "cases": sorted(list(cases))
    }

@router.get("/graph")
def get_network_graph(
    suspect_moniker: str = Query(None, description="Filter by suspect name"),
    syndicate_name: str = Query(None, description="Filter by syndicate name"),
    search_query: str = Query(None, description="General search query for suspects/cases/syndicates"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Log audit trail
    log_action(db, current_user.username, "VIEW_GRAPH", f"suspect={suspect_moniker}, syndicate={syndicate_name}, query={search_query}")

    # If no filters or search query is specified, start with an empty graph
    if not suspect_moniker and not syndicate_name and not search_query:
        return {
            "nodes": [],
            "edges": [],
            "summary": {
                "total_nodes": 0,
                "total_edges": 0,
                "suspects_count": 0,
                "cases_count": 0,
                "accounts_count": 0,
                "suspicious_tx_count": 0
            },
            "ai_insight": ""
        }

    # Load dataset
    df = data_reader.get_df()

    # Create full graph in memory first
    G = nx.MultiDiGraph()
    
    # 1. Load SQLite bank accounts
    accounts = db.query(BankAccount).all()
    accounts_by_suspect_id = {}
    accounts_by_moniker = {}
    for acc in accounts:
        if acc.suspect_id:
            if acc.suspect_id not in accounts_by_suspect_id:
                accounts_by_suspect_id[acc.suspect_id] = []
            accounts_by_suspect_id[acc.suspect_id].append(acc)
        if acc.suspect_name:
            if acc.suspect_name not in accounts_by_moniker:
                accounts_by_moniker[acc.suspect_name] = []
            accounts_by_moniker[acc.suspect_name].append(acc)

    # Populate relationships from CSV into global graph G
    for idx, row in df.iterrows():
        try:
            sus_profiles = json.loads(row['Suspect_Profiles_JSON'])
            crime_type = row['Crime_Type']
            year = int(row['Year'])
            case_id = f"CASE-{row['case_index']}"
            sub_location = row.get('Sub_Location')
            fir_summary = row.get('FIR_Text_Summary_EN', '')
            
            # Fetch additional database classification properties for telemetry/tooltips
            # Generate a real-looking FIR number based on year and case_index
            fir_num = f"FIR #KA-{year}-{10000 + idx:05d}"
            
            # Make case/conviction counts realistic for individual incidents
            cases_reported = 1
            convictions = 1 if int(row.get('Convictions', 0)) > 0 else 0
            
            legal_sections = row.get('Legal_Sections', 'N/A')
            risk_score = float(row.get('Risk_Score', 0.0))
            time_block = row.get('Incident_Time_Block', 'N/A')
            peak_hour = int(row.get('Peak_Hour', 12))
            day_profile = row.get('Day_Profile', 'N/A')

            # Extract suspects in this crime
            row_suspects = []
            for s in sus_profiles:
                sid = s.get('Suspect_ID')
                moniker = s.get('Moniker')
                synd = s.get('Syndicate_Affiliation', 'None')
                recid = s.get('Recidivism_Count', 0)
                
                if not moniker or moniker == "Under Active Investigation":
                    continue
                if not sid:
                    sid = moniker
                row_suspects.append((moniker, synd, recid, sid))

            # Add incident node
            G.add_node(case_id, 
                       label=f"Case {case_id}\n({fir_num})\n({crime_type})", 
                       type="crime_incident", 
                       year=year, 
                       district=row.get('District', 'Unknown'),
                       crime_type=crime_type, 
                       sub_location=sub_location, 
                       fir_summary=fir_summary,
                       fir_number=fir_num,
                       legal_sections=legal_sections,
                       convictions=convictions,
                       cases_reported=cases_reported,
                       risk_score=risk_score,
                       incident_time_block=time_block,
                       peak_hour=peak_hour,
                       day_profile=day_profile)

            # Add sub-location node if available
            if sub_location and str(sub_location).strip() and str(sub_location) != "nan":
                sub_loc_str = str(sub_location)
                if G.has_node(sub_loc_str):
                    G.nodes[sub_loc_str]["risk_score"] = max(G.nodes[sub_loc_str].get("risk_score", 0.0), risk_score)
                else:
                    G.add_node(sub_loc_str, label=sub_loc_str, type="sub_location", risk_score=risk_score)
                
                # Direct link between Case Node and Sub-Location
                G.add_edge(case_id, sub_loc_str, label="LOCATED_IN", type="located_in", case_id=fir_num)

            for moniker, synd, recid, sid in row_suspects:
                # Consolidate multiple suspect rows representing the same moniker (name)
                if G.has_node(moniker):
                    existing_sids = G.nodes[moniker].get("suspect_ids", [])
                    if sid not in existing_sids:
                        existing_sids.append(sid)
                    G.nodes[moniker]["suspect_ids"] = existing_sids
                    G.nodes[moniker]["recidivism"] = max(G.nodes[moniker]["recidivism"], recid)
                    if synd != "None" and synd != "":
                        G.nodes[moniker]["syndicate"] = synd
                else:
                    G.add_node(moniker, label=moniker, type="suspect", recidivism=recid, syndicate=synd, suspect_id=sid, suspect_ids=[sid])
                
                # Link suspect to case (Accused In)
                G.add_edge(moniker, case_id, label="ACCUSED_IN", type="accused_in", case_id=fir_num)
                
                # Add syndicate node if applicable
                if synd != "None" and synd != "":
                    if G.has_node(synd):
                        G.nodes[synd]["risk_score"] = max(G.nodes[synd].get("risk_score", 0.0), risk_score)
                    else:
                        G.add_node(synd, label=synd, type="syndicate", risk_score=risk_score)
                    # Link suspect to syndicate
                    G.add_edge(moniker, synd, label="MEMBER_OF", type="member_of", case_id=fir_num)
                    
                # Link suspect to sub-location node if applicable
                if sub_location and str(sub_location).strip() and str(sub_location) != "nan":
                    G.add_edge(moniker, sub_loc_str, label="OPERATED_IN", type="operated_in", case_id=fir_num)
        except Exception:
            pass

    # Link bank accounts to suspect nodes in the graph
    for node, data in list(G.nodes(data=True)):
        if data.get("type") == "suspect":
            moniker = node
            sids = data.get("suspect_ids", [data.get("suspect_id")])
            
            accs = []
            for sid in sids:
                if sid in accounts_by_suspect_id:
                    accs.extend(accounts_by_suspect_id[sid])
            if moniker in accounts_by_moniker:
                accs.extend(accounts_by_moniker[moniker])
                
            # Dedup accounts for this node
            seen_accs = set()
            for acc in accs:
                if acc.account_number in seen_accs:
                    continue
                seen_accs.add(acc.account_number)
                acc_num = acc.account_number
                G.add_node(acc_num, label=f"{acc.bank_name}\n({acc_num})", type="bank_account", balance=acc.balance, status=acc.account_status)
                G.add_edge(moniker, acc_num, label="OWNS_ACCOUNT", type="owns_account", case_id="Database Registry")

    # Overlay bank transactions between bank accounts
    active_bank_nodes = [node for node, data in G.nodes(data=True) if data.get('type') == 'bank_account']
    if active_bank_nodes:
        transactions = db.query(Transaction).filter(
            (Transaction.sender_account.in_(active_bank_nodes)) | 
            (Transaction.receiver_account.in_(active_bank_nodes))
        ).limit(150).all()

        for tx in transactions:
            if tx.sender_account in G and tx.receiver_account in G:
                edge_label = f"₹{tx.amount:,.0f} ({tx.transaction_type})"
                G.add_edge(
                    tx.sender_account, 
                    tx.receiver_account, 
                    label=edge_label, 
                    type="transaction", 
                    amount=tx.amount, 
                    is_suspicious=bool(tx.is_suspicious),
                    txn_id=tx.transaction_id,
                    case_id="Financial Transaction Journal"
                )

    # 2. Find start nodes matching filters / search query
    start_nodes = set()
    is_case_focus = False
    
    query_clean = search_query.strip().lower() if search_query else ""
    moniker_clean = suspect_moniker.strip().lower() if suspect_moniker else ""
    syndicate_clean = syndicate_name.strip().lower() if syndicate_name else ""

    # Match search terms with multi-param search compatibility
    if moniker_clean:
        for node, data in G.nodes(data=True):
            if data.get("type") == "suspect" and str(node).lower() == moniker_clean:
                start_nodes.add(node)
                
    if syndicate_clean:
        for node, data in G.nodes(data=True):
            if data.get("type") == "syndicate" and str(node).lower() == syndicate_clean:
                start_nodes.add(node)

    if query_clean:
        # Check if the query matches a suspect name or exact ID
        suspect_matched = False
        
        import re
        if re.match(r'^ka-crm-\d+$', query_clean):
            # Authoritative lookup in DB registry to prevent multi-moniker duplicate suspect matches
            db_suspect = db.query(BankAccount).filter(BankAccount.suspect_id.ilike(query_clean)).first()
            if db_suspect:
                db_name = db_suspect.suspect_name
                for node, data in G.nodes(data=True):
                    if data.get("type") == "suspect" and str(node).lower() == db_name.lower():
                        start_nodes.add(node)
                        suspect_matched = True
                        break
        
        if not suspect_matched:
            for node, data in G.nodes(data=True):
                if data.get("type") == "suspect":
                    sus_ids = data.get("suspect_ids", [data.get("suspect_id", "")])
                    sus_ids_clean = [str(x).lower() for x in sus_ids]
                    sus_name = str(data.get("label", "")).lower()
                    if query_clean == sus_name or query_clean in sus_ids_clean:
                        start_nodes.add(node)
                        suspect_matched = True
                    
        # If no suspect matches, check for Case ID or FIR focus mode
        if not suspect_matched:
            if query_clean.startswith("case-") or query_clean.startswith("ka-crm-"):
                import re
                nums = re.findall(r'\d+', query_clean)
                if nums:
                    case_idx = nums[0]
                    target_case = f"CASE-{case_idx}"
                    if target_case in G:
                        start_nodes.add(target_case)
                        is_case_focus = True
            else:
                # Text fallback parsing
                for node, data in G.nodes(data=True):
                    node_type = data.get("type")
                    node_id_str = str(node).lower()
                    
                    if node_type == "suspect":
                        sus_ids = data.get("suspect_ids", [data.get("suspect_id", "")])
                        sus_ids_clean = [str(x).lower() for x in sus_ids]
                        sus_name = str(data.get("label", "")).lower()
                        if query_clean in sus_name or any(query_clean in sid for sid in sus_ids_clean):
                            start_nodes.add(node)
                    elif node_type == "crime_incident":
                        crime_type_str = str(data.get("crime_type", "")).lower()
                        if query_clean in node_id_str or query_clean in crime_type_str:
                            start_nodes.add(node)
                            is_case_focus = True
                    elif node_type == "syndicate":
                        if query_clean in node_id_str:
                            start_nodes.add(node)
                    elif node_type == "sub_location":
                        if query_clean in node_id_str:
                            start_nodes.add(node)
                    elif node_type == "bank_account":
                        if query_clean in node_id_str:
                            start_nodes.add(node)

    # If no starting node matched, return empty graph
    if not start_nodes:
        return {
            "nodes": [],
            "edges": [],
            "summary": {
                "total_nodes": 0,
                "total_edges": 0,
                "suspects_count": 0,
                "cases_count": 0,
                "accounts_count": 0,
                "suspicious_tx_count": 0
            },
            "ai_insight": "Investigation Insight: No matching suspects, cases, or syndicates found for the search query."
        }

    # 3. Filter graph to highly relevant connections for visual simplicity
    G_undirected = nx.Graph(G)
    selected_nodes = set()

    if is_case_focus:
        # Case Focus Mode: Orbit suspects around the central case node, linked directly to its Sub-location
        case_node = None
        for node in start_nodes:
            if G.nodes[node].get("type") == "crime_incident":
                case_node = node
                break
        
        if case_node:
            selected_nodes.add(case_node)
            sub_location = G.nodes[case_node].get("sub_location")
            
            suspects = []
            for n in G_undirected.neighbors(case_node):
                if G_undirected.nodes[n].get("type") == "suspect":
                    suspects.append(n)
            
            selected_nodes.update(suspects)
            if sub_location and sub_location in G_undirected:
                selected_nodes.add(sub_location)
                
            # Add bank accounts to payload so they can be expanded on double click in UI
            for sus in suspects:
                accounts = [n for n in G_undirected.neighbors(sus) if G_undirected.nodes[n].get("type") == "bank_account"]
                selected_nodes.update(accounts[:3])
    else:
        # Suspect Focus Mode: preserve standard layout centered on suspect
        selected_nodes = set(start_nodes)
        for start in start_nodes:
            if start not in G_undirected:
                continue
            start_type = G_undirected.nodes[start].get("type")
            
            if start_type == "suspect":
                syndicates = []
                sub_locations = []
                bank_accounts = []
                cases = []
                
                for n in G_undirected.neighbors(start):
                    n_type = G_undirected.nodes[n].get("type")
                    if n_type == "syndicate":
                        syndicates.append(n)
                    elif n_type == "sub_location":
                        sub_locations.append(n)
                    elif n_type == "bank_account":
                        bank_accounts.append(n)
                    elif n_type == "crime_incident":
                        cases.append(n)
                
                selected_nodes.update(syndicates)
                selected_nodes.update(sub_locations[:2])
                
                bank_accounts_sorted = sorted(
                    bank_accounts, 
                    key=lambda x: (
                        0 if G_undirected.nodes[x].get("status") in ["Flagged", "Frozen"] else 1, 
                        -G_undirected.nodes[x].get("balance", 0)
                    )
                )
                kept_accounts = bank_accounts_sorted[:3]
                selected_nodes.update(kept_accounts)
                
                cases_sorted = sorted(
                    cases, 
                    key=lambda x: -G_undirected.nodes[x].get("year", 0)
                )
                kept_cases = cases_sorted[:3]
                selected_nodes.update(kept_cases)
                
                # Co-accused suspects
                for case in kept_cases:
                    co_accused = []
                    for n in G_undirected.neighbors(case):
                        if G_undirected.nodes[n].get("type") == "suspect" and n != start:
                            co_accused.append(n)
                    co_accused_sorted = sorted(
                        co_accused, 
                        key=lambda x: -G_undirected.nodes[x].get("recidivism", 0)
                    )
                    selected_nodes.update(co_accused_sorted[:2])
                    
                # Transacting accounts
                for acc in kept_accounts:
                    transacting = []
                    for n in G_undirected.neighbors(acc):
                        if G_undirected.nodes[n].get("type") == "bank_account" and n != acc:
                            transacting.append(n)
                    selected_nodes.update(transacting[:2])
                    
            elif start_type == "syndicate":
                suspects = []
                for n in G_undirected.neighbors(start):
                    if G_undirected.nodes[n].get("type") == "suspect":
                        suspects.append(n)
                suspects_sorted = sorted(
                    suspects,
                    key=lambda x: -G_undirected.nodes[x].get("recidivism", 0)
                )
                kept_suspects = suspects_sorted[:5]
                selected_nodes.update(kept_suspects)
                
                for sus in kept_suspects:
                    cases = [n for n in G_undirected.neighbors(sus) if G_undirected.nodes[n].get("type") == "crime_incident"]
                    accounts = [n for n in G_undirected.neighbors(sus) if G_undirected.nodes[n].get("type") == "bank_account"]
                    selected_nodes.update(cases[:1])
                    selected_nodes.update(accounts[:1])
                    
            elif start_type == "crime_incident":
                suspects = []
                for n in G_undirected.neighbors(start):
                    if G_undirected.nodes[n].get("type") == "suspect":
                        suspects.append(n)
                kept_suspects = suspects[:5]
                selected_nodes.update(kept_suspects)
                
                for sus in kept_suspects:
                    accounts = [n for n in G_undirected.neighbors(sus) if G_undirected.nodes[n].get("type") == "bank_account"]
                    selected_nodes.update(accounts[:1])
                    
            elif start_type == "bank_account":
                owners = [n for n in G_undirected.neighbors(start) if G_undirected.nodes[n].get("type") == "suspect"]
                selected_nodes.update(owners)
                
                transacting = [n for n in G_undirected.neighbors(start) if G_undirected.nodes[n].get("type") == "bank_account"]
                selected_nodes.update(transacting[:3])
                
            elif start_type == "sub_location":
                suspects = [n for n in G_undirected.neighbors(start) if G_undirected.nodes[n].get("type") == "suspect"]
                selected_nodes.update(suspects[:5])

    # Extract the filtered subgraph
    G_sub = G.subgraph(selected_nodes).copy()

    # Compute Centralities on the subgraph simple undirected version
    degree_centrality = {}
    if len(G_sub) > 0:
        sub_undirected = nx.Graph(G_sub)
        degree_centrality = nx.degree_centrality(sub_undirected)

    # 4. Formulate visual nodes and edges payloads
    nodes_payload = []
    sub_suspects = []
    sub_cases = []

    for node, data in G_sub.nodes(data=True):
        node_type = data.get("type", "unknown")
        
        node_item = {
            "id": node,
            "label": data.get("label", str(node)),
            "type": node_type,
            "size": int(15 + degree_centrality.get(node, 0) * 80)
        }
        
        if node_type == "suspect":
            node_item["recidivism"] = data.get("recidivism", 0)
            node_item["syndicate"] = data.get("syndicate", "None")
            node_item["suspect_id"] = data.get("suspect_id", "")
            sub_suspects.append({
                "moniker": str(node),
                "suspect_id": data.get("suspect_id", ""),
                "syndicate": data.get("syndicate", "None"),
                "recidivism": data.get("recidivism", 0)
            })
        elif node_type == "crime_incident":
            node_item["year"] = data.get("year", 2014)
            node_item["district"] = data.get("district", "Unknown")
            node_item["crime_type"] = data.get("crime_type", "")
            node_item["sub_location"] = data.get("sub_location", "")
            node_item["legal_sections"] = data.get("legal_sections", "N/A")
            node_item["convictions"] = data.get("convictions", 0)
            node_item["cases_reported"] = data.get("cases_reported", 1)
            node_item["incident_time_block"] = data.get("incident_time_block", "N/A")
            node_item["peak_hour"] = data.get("peak_hour", 12)
            node_item["day_profile"] = data.get("day_profile", "N/A")
            node_item["fir_number"] = data.get("fir_number", "")
            
            sub_cases.append({
                "case_id": node,
                "district": data.get("district", "Unknown"),
                "year": data.get("year", 2024),
                "crime_type": data.get("crime_type", ""),
                "sub_location": data.get("sub_location", ""),
                "fir_summary": data.get("fir_summary", ""),
                "legal_sections": data.get("legal_sections", "N/A"),
                "convictions": data.get("convictions", 0),
                "cases_reported": data.get("cases_reported", 1),
                "incident_time_block": data.get("incident_time_block", "N/A"),
                "peak_hour": data.get("peak_hour", 12),
                "day_profile": data.get("day_profile", "N/A"),
                "fir_number": data.get("fir_number", "")
            })
        elif node_type == "bank_account":
            node_item["balance"] = data.get("balance", 0.0)
            node_item["status"] = data.get("status", "Active")
        elif node_type in ["sub_location", "syndicate"]:
            node_item["risk_score"] = data.get("risk_score", 0.0)
            
        nodes_payload.append(node_item)

    edges_payload = []
    edge_ids = set()
    
    for u, v, key, data in G_sub.edges(keys=True, data=True):
        edge_id = f"{u}-{v}-{data.get('type')}"
        if data.get("type") != "transaction" and edge_id in edge_ids:
            continue
        edge_ids.add(edge_id)

        edge_item = {
            "source": u,
            "target": v,
            "label": data.get("label", ""),
            "type": data.get("type", ""),
            "case_id": data.get("case_id", "N/A")
        }
        
        if data.get("type") == "transaction":
            edge_item["amount"] = data.get("amount", 0.0)
            edge_item["is_suspicious"] = data.get("is_suspicious", False)
            edge_item["txn_id"] = data.get("txn_id", "")
            
        edges_payload.append(edge_item)

    # 5. Generate AI Briefing (Structured Police Tactical Briefing)
    ai_insight = generate_ai_insight(sub_suspects, sub_cases)

    return {
        "nodes": nodes_payload,
        "edges": edges_payload,
        "summary": {
            "total_nodes": len(nodes_payload),
            "total_edges": len(edges_payload),
            "suspects_count": sum(1 for n in nodes_payload if n["type"] == "suspect"),
            "cases_count": sum(1 for n in nodes_payload if n["type"] == "crime_incident"),
            "accounts_count": sum(1 for n in nodes_payload if n["type"] == "bank_account"),
            "suspicious_tx_count": sum(1 for e in edges_payload if e.get("is_suspicious", False))
        },
        "ai_insight": ai_insight
    }
