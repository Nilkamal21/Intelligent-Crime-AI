import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, Query
from sklearn.linear_model import LinearRegression
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import User
from backend.app.routes.auth import get_current_user, log_action
from backend.app.data_loader import data_reader

router = APIRouter(prefix="/api/forecasting", tags=["Crime Forecasting & Early Warnings"])

@router.get("/predict")
def predict_crime_trends(
    district: str = Query(..., description="Target district to forecast"),
    crime_type: str = Query(None, description="Optional filter by crime category"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Log audit trail
    log_action(db, current_user.username, "FORECAST_CRIME", f"district={district}, crime_type={crime_type}")

    df = data_reader.get_df()
    
    # Filter dataset
    mask = pd.Series(True, index=df.index) if (not district or district.lower() == 'statewide') else (df['District'] == district)
    if crime_type:
        mask = mask & (df['Crime_Type'] == crime_type)
        
    f_df = df[mask]
    
    if len(f_df) == 0:
        return {
            "historical": [],
            "forecast": [],
            "alerts": [],
            "message": "Insufficient historical data to construct a forecast for this selection."
        }

    # Aggregate cases reported by year
    yearly_data = f_df.groupby('Year').agg({
        'Cases_Reported': 'sum',
        'Risk_Score': 'mean'
    }).reset_index()

    # Sort by year
    yearly_data = yearly_data.sort_values(by='Year')
    
    # Check if we have enough historical data points
    years = yearly_data['Year'].values.reshape(-1, 1)
    cases = yearly_data['Cases_Reported'].values
    risks = yearly_data['Risk_Score'].values
    
    if len(years) < 3:
        return {
            "historical": yearly_data.to_dict(orient="records"),
            "forecast": [],
            "alerts": [],
            "message": "Historical timeline too short (requires at least 3 years of data)."
        }

    # Fit fallback LinearRegression models to calculate R-squared and serve as solid backstops
    model_cases = LinearRegression()
    model_cases.fit(years, cases)
    model_risks = LinearRegression()
    model_risks.fit(years, risks)

    # Forecast years dynamically based on maximum year in dataset
    max_year = int(yearly_data['Year'].max())
    f_years = [max_year + 1, max_year + 2, max_year + 3]
    forecast_years = np.array(f_years).reshape(-1, 1)

    # Convert to pandas series with Year index for statsmodels time-series formatting
    series_cases = pd.Series(cases, index=yearly_data['Year'])
    series_risks = pd.Series(risks, index=yearly_data['Year'])

    # 1. Advanced Forecasting for Cases using Holt-Winters Exponential Smoothing (Double/Triple Exponential Smoothing)
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    from statsmodels.tsa.arima.model import ARIMA
    
    pred_cases = []
    try:
        # Fit Holt-Winters Exponential Smoothing with additive trend
        hw_model = ExponentialSmoothing(
            series_cases,
            trend='add',
            damped_trend=True,
            initialization_method='estimated'
        ).fit()
        pred_cases = hw_model.forecast(steps=3).values
    except Exception:
        try:
            # Fallback to Simple Exponential Smoothing
            from statsmodels.tsa.holtwinters import SimpleExpSmoothing
            ses_model = SimpleExpSmoothing(series_cases, initialization_method='estimated').fit()
            pred_cases = ses_model.forecast(steps=3).values
        except Exception:
            # Ultimate fallback to LinearRegression
            pred_cases = model_cases.predict(forecast_years)

    # 2. Advanced Forecasting for Risk Scores using ARIMA (Autoregressive Integrated Moving Average)
    pred_risks = []
    try:
        # Fit ARIMA(1, 0, 0) for Risk Score to model autoregressive mean-reverting risk
        arima_model = ARIMA(series_risks, order=(1, 0, 0)).fit()
        pred_risks = arima_model.forecast(steps=3).values
    except Exception:
        try:
            hw_risk = ExponentialSmoothing(series_risks, trend='add', initialization_method='estimated').fit()
            pred_risks = hw_risk.forecast(steps=3).values
        except Exception:
            # Ultimate fallback to LinearRegression
            pred_risks = model_risks.predict(forecast_years)
 
    # Clean negative values
    pred_cases = np.clip(pred_cases, 0, None)
    pred_risks = np.clip(pred_risks, 0.0, 1.0)
 
    # Calculate historical stats for early warning threshold
    mean_cases = float(np.mean(cases))
    std_cases = float(np.std(cases))
    # Threshold = Mean + 1.5 * SD
    anomaly_threshold = mean_cases + 1.5 * std_cases if std_cases > 0 else mean_cases * 1.5
 
    historical_records = []
    for y, c, r in zip(yearly_data['Year'].values, cases, risks):
        historical_records.append({
            "year": int(y),
            "cases": int(c),
            "risk_score": round(float(r), 3),
            "type": "Historical"
        })
 
    forecast_records = []
    for y, c, r in zip(f_years, pred_cases, pred_risks):
        forecast_records.append({
            "year": int(y),
            "cases": round(float(c), 1),
            "risk_score": round(float(r), 3),
            "type": "Forecasted"
        })
 
    # 4. Generate Early Warning Alerts
    alerts = []
    # Check if next year forecast is higher than threshold
    pred_next_cases = pred_cases[0]
    next_year = f_years[0]
    
    if pred_next_cases > anomaly_threshold:
        alerts.append({
            "severity": "CRITICAL",
            "indicator": "Anomaly Threshold Exceeded",
            "message": f"Critical spike warning: Forecasted cases for {next_year} ({pred_next_cases:.0f}) exceeds the normal historical upper bound ({anomaly_threshold:.0f}) for {district}.",
            "recommended_action": f"Deploy immediate preventative patrols in {district} and initiate preemptive investigation of active syndicates."
        })
        
    # Check if risk score is high
    pred_next_risk = pred_risks[0]
    if pred_next_risk > 0.4:
        alerts.append({
            "severity": "WARNING",
            "indicator": "High Risk Index Forecasted",
            "message": f"Preemptive Alert: District risk score for {district} is projected to rise to {pred_next_risk:.2f} in {next_year}.",
            "recommended_action": "Increase analytical vigilance on local cybersecurity logs (if cybercrime) or highway checkposts (if robbery/theft)."
        })

    return {
        "district": district,
        "crime_type": crime_type or "All Crimes",
        "historical": historical_records,
        "forecast": forecast_records,
        "early_warnings": alerts,
        "statistics": {
            "historical_mean": round(mean_cases, 2),
            "historical_std_dev": round(std_cases, 2),
            "warning_threshold": round(anomaly_threshold, 2),
            "r_squared": round(float(model_cases.score(years, cases)), 3)
        }
    }
