import re

# Kannada mappings for Crime Types
KANNADA_CRIME_MAP = {
    "ಕೊಲೆ": "Murder",
    "ಅತ್ಯಾಚಾರ": "Rape",
    "ಅಪಹರಣ": "Kidnapping",
    "ಕಳ್ಳತನ": "Theft",
    "ದರೋಡೆ": "Robbery",
    "ದಾಳಿ": "Assault",
    "ಕನ್ನಗಳ್ಳತನ": "Burglary",
    "ಸೈಬರ್ ಅಪರಾಧ": "Cybercrime",
    "ವರದಕ್ಷಿಣೆ ಸಾವು": "Dowry Deaths",
    "ವಂಚನೆ": "Fraud",
    "ಮೋಸ": "Fraud",
    "murder": "Murder",
    "rape": "Rape",
    "kidnapping": "Kidnapping",
    "theft": "Theft",
    "robbery": "Robbery",
    "assault": "Assault",
    "burglary": "Burglary",
    "cyber crime": "Cybercrime",
    "cybercrime": "Cybercrime",
    "dowry": "Dowry Deaths",
    "fraud": "Fraud"
}

# Kannada mappings for major Districts in the dataset
KANNADA_DISTRICT_MAP = {
    "ಬೆಂಗಳೂರು": "Bengaluru Urban",
    "ಮೈಸೂರು": "Mysuru",
    "ಮಂಗಳೂರು": "Mangaluru",
    "ಹುಬ್ಬಳ್ಳಿ": "Hubballi",
    "ಬೆಳಗಾವಿ": "Belagavi",
    "ಬಳ್ಳಾರಿ": "Ballari",
    "ಶಿವಮೊಗ್ಗ": "Shivamogga",
    "ತುಮಕೂರು": "Tumakuru",
    "ಉಡುಪಿ": "Udupi",
    "ದಾವಣಗೆರೆ": "Davanagere",
    "ರಾಯಚೂರು": "Raichur",
    "ಬೀದರ್": "Bidar",
    "ಕಲಬುರಗಿ": "Kalaburagi",
    "ಚಿಕ್ಕಮಗಳೂರು": "Chikkamagaluru",
    "ಹಾಸನ": "Hassan",
    "ಮಂಡ್ಯ": "Mandya",
    "ಕೋಲಾರ": "Kolar",
    "ಗದಗ": "Gadag",
    "ಹಾವೇರಿ": "Haveri",
    "ಬಾಗಲಕೋಟೆ": "Bagalkot",
    "ಚಿತ್ರದುರ್ಗ": "Chitradurga",
    "ಕೊಡಗು": "Kodagu",
    "ಯಾದಗಿರಿ": "Yadgir",
    "ವಿಜಯಪುರ": "Vijayapura",
    "ರಾಮನಗರ": "Ramanagara"
}

def clean_kannada_text(text: str) -> str:
    """Removes common Kannada punctuation or suffixes if needed."""
    return text.strip()

_UNIQUE_SUSPECTS_CACHE = None

def get_unique_suspects():
    global _UNIQUE_SUSPECTS_CACHE
    if _UNIQUE_SUSPECTS_CACHE is None:
        try:
            from backend.app.data_loader import data_reader
            import json
            df = data_reader.get_df()
            suspects = set()
            for idx, row in df.iterrows():
                try:
                    profiles = json.loads(row['Suspect_Profiles_JSON'])
                    for p in profiles:
                        moniker = p.get('Moniker')
                        if moniker and moniker != "Under Active Investigation":
                            suspects.add(moniker)
                except Exception:
                    pass
            # Sort by length descending to match longer names (e.g. Satish Kumar) before shorter ones (e.g. Satish)
            _UNIQUE_SUSPECTS_CACHE = sorted(list(suspects), key=len, reverse=True)
        except Exception as e:
            print(f"Error caching unique suspects list: {e}")
            _UNIQUE_SUSPECTS_CACHE = []
    return _UNIQUE_SUSPECTS_CACHE

def extract_filters_from_text(query: str) -> dict:
    """
    Extracts structural filters (District, Year, Crime Type, Suspect Names) 
    using regex and translation maps to guarantee filter resolution.
    """
    query_lower = query.lower()
    filters = {
        "District": None,
        "Year": None,
        "Crime_Type": None,
        "Suspect": None
    }
    
    # 1. Extract Year (4-digit numbers between 2014 and 2026)
    year_match = re.search(r'\b(201[4-9]|202[0-6])\b', query)
    if year_match:
        filters["Year"] = int(year_match.group(0))
        
    # 2. Extract District (English & Kannada matching)
    for kn_name, en_name in KANNADA_DISTRICT_MAP.items():
        if kn_name in query or en_name.lower() in query_lower:
            filters["District"] = en_name
            break
            
    # 3. Extract Crime Type (English & Kannada matching)
    for kn_crime, en_crime in KANNADA_CRIME_MAP.items():
        if kn_crime in query or en_crime.lower() in query_lower:
            filters["Crime_Type"] = en_crime
            break
            
    # 4. Extract Suspect Monikers dynamically from the database/CSV monikers list
    suspects = get_unique_suspects()
    for name in suspects:
        name_clean = name.replace('.', '').strip().lower()
        parts = name_clean.split()
        if len(parts) >= 2:
            pattern = rf"\b{parts[0]}\b.*\b{parts[-1]}\b"
            if re.search(pattern, query_lower):
                filters["Suspect"] = name
                break
        else:
            if rf"\b{name_clean}\b" in query_lower or name_clean in query_lower:
                filters["Suspect"] = name
                break
            
    return filters

def detect_language(query: str) -> str:
    """
    Detects if the query is in Kannada or English.
    Looks for Kannada Unicode blocks (U+0C80 to U+0CFF).
    """
    kannada_char_count = sum(1 for char in query if '\u0c80' <= char <= '\u0cff')
    # If more than 5% of characters or at least 2 characters are in Kannada script, treat as Kannada
    if kannada_char_count >= 2 or (len(query) > 0 and (kannada_char_count / len(query)) > 0.05):
        return "KN"
    return "EN"
