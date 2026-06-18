import json
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from backend.app.config import CSV_PATH

class CrimeDataReader:
    def __init__(self):
        self.csv_path = CSV_PATH
        self.df = None
        self.vectorizer = None
        self.tfidf_matrix = None
        self.load_data()

    def load_data(self):
        print(f"Loading Crime Dataset from: {self.csv_path}")
        try:
            self.df = pd.read_csv(self.csv_path)
            # Add an integer index column for references
            self.df['case_index'] = self.df.index
            
            # Clean up missing data if any
            self.df['FIR_Text_Summary_EN'] = self.df['FIR_Text_Summary_EN'].fillna('')
            self.df['FIR_Text_Summary_KN'] = self.df['FIR_Text_Summary_KN'].fillna('')
            self.df['Suspect_Profiles_JSON'] = self.df['Suspect_Profiles_JSON'].fillna('[]')
            
            # Fit TF-IDF Vectorizer on FIR summaries for local semantic search
            self.vectorizer = TfidfVectorizer(stop_words='english')
            self.tfidf_matrix = self.vectorizer.fit_transform(self.df['FIR_Text_Summary_EN'])
            print(f"Dataset loaded successfully with {len(self.df)} records.")
        except Exception as e:
            print(f"Error loading dataset: {e}")
            raise e

    def get_df(self) -> pd.DataFrame:
        if self.df is None:
            self.load_data()
        return self.df

    def search_similar_cases(self, query: str, top_n: int = 5, filters: dict = None) -> list:
        """
        Search for similar past cases using TF-IDF and Cosine Similarity on FIR summaries.
        Applies optional filters (e.g. District, Year, Crime_Type).
        """
        if self.df is None or self.vectorizer is None:
            self.load_data()

        # Transform query
        query_vector = self.vectorizer.transform([query])
        
        # Calculate similarity
        sim_scores = cosine_similarity(query_vector, self.tfidf_matrix).flatten()
        
        # Apply filters if provided
        filtered_indices = np.arange(len(self.df))
        
        if filters:
            mask = pd.Series(True, index=self.df.index)
            for col, val in filters.items():
                if val and col in self.df.columns:
                    mask = mask & (self.df[col].astype(str) == str(val))
            
            filtered_indices = self.df[mask]['case_index'].values
            
        if len(filtered_indices) == 0:
            return []

        # Filter similarities
        subset_sim_scores = sim_scores[filtered_indices]
        
        # Sort indices
        top_subset_indices = np.argsort(subset_sim_scores)[::-1][:top_n]
        top_global_indices = filtered_indices[top_subset_indices]
        top_scores = subset_sim_scores[top_subset_indices]
        
        results = []
        for idx, score in zip(top_global_indices, top_scores):
            row = self.df.iloc[idx]
            results.append({
                "case_index": int(row['case_index']),
                "State": row['State'],
                "District": row['District'],
                "Year": int(row['Year']),
                "Crime_Type": row['Crime_Type'],
                "Cases_Reported": int(row['Cases_Reported']),
                "Chargesheeted": int(row['Chargesheeted']),
                "Convictions": int(row['Convictions']),
                "Legal_Sections": row['Legal_Sections'],
                "Risk_Score": float(row['Risk_Score']),
                "Suspects": json.loads(row['Suspect_Profiles_JSON']),
                "FIR_EN": row['FIR_Text_Summary_EN'],
                "FIR_KN": row['FIR_Text_Summary_KN'],
                "Incident_Time_Block": row['Incident_Time_Block'],
                "Peak_Hour": int(row['Peak_Hour']),
                "Day_Profile": row['Day_Profile'],
                "Similarity_Score": float(score)
            })
        return results

    def query_stats(self, district: str = None, year: int = None, crime_type: str = None) -> dict:
        """
        Query aggregate statistics for dashboard charts and metrics.
        """
        df = self.get_df()
        mask = pd.Series(True, index=df.index)
        
        if district:
            mask = mask & (df['District'] == district)
        if year:
            mask = mask & (df['Year'] == int(year))
        if crime_type:
            mask = mask & (df['Crime_Type'] == crime_type)
            
        filtered_df = df[mask]
        
        if len(filtered_df) == 0:
            return {
                "total_cases": 0,
                "total_chargesheeted": 0,
                "total_convictions": 0,
                "avg_risk_score": 0.0,
                "avg_conviction_rate": 0.0
            }
            
        total_cases = int(filtered_df['Cases_Reported'].sum())
        total_charges = int(filtered_df['Chargesheeted'].sum())
        total_convictions = int(filtered_df['Convictions'].sum())
        avg_risk = float(filtered_df['Risk_Score'].mean())
        
        conviction_rate = (total_convictions / total_charges * 100) if total_charges > 0 else 0.0
        
        return {
            "total_cases": total_cases,
            "total_chargesheeted": total_charges,
            "total_convictions": total_convictions,
            "avg_risk_score": round(avg_risk, 3),
            "avg_conviction_rate": round(conviction_rate, 2)
        }

# Singleton instance
data_reader = CrimeDataReader()
