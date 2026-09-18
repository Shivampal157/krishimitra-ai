"""
KrishiMitra AI — Weather Agent Lambda
Fetches 7-day forecast via Open-Meteo + Bedrock crop-specific advisory
"""
import json
import boto3
import os
import logging
import urllib.request
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock  = boto3.client("bedrock-runtime", region_name=os.environ.get("REGION", "us-east-1"))
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")

# Coordinates for major Indian states (lat, lon)
STATE_COORDS = {
    "Maharashtra":    (19.7515,  75.7139),
    "Punjab":         (31.1471,  75.3412),
    "Uttar Pradesh":  (26.8467,  80.9462),
    "Rajasthan":      (27.0238,  74.2179),
    "Madhya Pradesh": (22.9734,  78.6569),
    "Karnataka":      (15.3173,  75.7139),
    "Andhra Pradesh": (15.9129,  79.7400),
    "Tamil Nadu":     (11.1271,  78.6569),
    "Gujarat":        (22.2587,  71.1924),
    "Haryana":        (29.0588,  76.0856),
    "Bihar":          (25.0961,  85.3131),
    "West Bengal":    (22.9868,  87.8550),
    "Odisha":         (20.9517,  85.0985),
    "Telangana":      (18.1124,  79.0193),
}

# Season calendar for major crops in India
CROP_SEASONS = {
    "wheat":      {"sow": [10, 11], "harvest": [3, 4],  "critical_months": [2, 3]},
    "rice":       {"sow": [6, 7],   "harvest": [10, 11], "critical_months": [8, 9]},
    "cotton":     {"sow": [5, 6],   "harvest": [10, 12], "critical_months": [8, 9]},
    "sugarcane":  {"sow": [2, 3],   "harvest": [11, 12], "critical_months": [6, 9]},
    "tomato":     {"sow": [7, 8],   "harvest": [11, 12], "critical_months": [10, 11]},
    "soybean":    {"sow": [6, 7],   "harvest": [9, 10],  "critical_months": [8, 9]},
    "onion":      {"sow": [10, 11], "harvest": [3, 4],   "critical_months": [1, 2]},
    "potato":     {"sow": [10, 11], "harvest": [2, 3],   "critical_months": [12, 1]},
}


def lambda_handler(event, context):
    logger.info("Weather Agent invoked")

    try:
        body      = json.loads(event.get("body", "{}")) if isinstance(event.get("body"), str) else event
        state     = body.get("state", "Maharashtra")
        crop_type = body.get("cropType", "wheat")
        district  = body.get("district", "")

        # Get coordinates
        coords = STATE_COORDS.get(state, (20.5937, 78.9629))  # Default: center of India
        lat, lon = coords

        # Fetch real weather from Open-Meteo (FREE, no API key needed)
        weather_data = fetch_openmeteo(lat, lon)

        # Process forecast
        daily      = weather_data.get("daily", {})
        dates      = daily.get("time", [])[:7]
        max_temps  = daily.get("temperature_2m_max", [])[:7]
        min_temps  = daily.get("temperature_2m_min", [])[:7]
        rainfall   = daily.get("precipitation_sum", [])[:7]
        humidity   = daily.get("precipitation_hours", [])[:7]
        wind       = daily.get("windspeed_10m_max", [])[:7]
        uv_index   = daily.get("uv_index_max", [])[:7]

        # Calculate totals
        total_rain = sum(rainfall) if rainfall else 0
        avg_temp   = sum(max_temps)/len(max_temps) if max_temps else 30

        # Current month for seasonal advice
        current_month = datetime.now().month
        season_info   = CROP_SEASONS.get(crop_type, {})
        is_harvest_time = current_month in season_info.get("harvest", [])
        is_sowing_time  = current_month in season_info.get("sow", [])
        is_critical     = current_month in season_info.get("critical_months", [])

        # Generate crop-specific weather advisory via Bedrock
        advisory = generate_weather_advisory(
            crop_type, state, avg_temp, total_rain,
            max_temps, rainfall, is_harvest_time, is_critical, bedrock, MODEL_ID
        )

        result = {
            "success": True,
            "location": state,
            "district": district,
            "coordinates": {"lat": lat, "lon": lon},
            "data_source": "Open-Meteo API (Real-time)",
            "forecast": {
                "next_7_days": {
                    "dates": dates,
                    "max_temp": [round(t, 1) for t in max_temps],
                    "min_temp": [round(t, 1) for t in min_temps],
                    "rainfall_mm": [round(r, 1) for r in rainfall],
                    "wind_speed": [round(w, 1) for w in wind],
                    "uv_index": [round(u, 1) for u in uv_index],
                }
            },
            "summary": {
                "avg_max_temp": round(avg_temp, 1),
                "total_rainfall_7days": round(total_rain, 1),
                "weather_classification": classify_weather(avg_temp, total_rain),
                "spray_suitable_days": get_spray_days(dates, rainfall, wind),
            },
            "crop_advisory": advisory,
            "season_status": {
                "is_harvest_time": is_harvest_time,
                "is_sowing_time": is_sowing_time,
                "is_critical_phase": is_critical,
            },
            "agent": "weather_agent",
            "timestamp": datetime.now().isoformat()
        }

        # Set summary field for orchestrator
        result["summary_text"] = advisory.get("immediate_warning", advisory.get("overall_summary", "Check local weather conditions"))

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps(result, ensure_ascii=False)
        }

    except Exception as e:
        logger.error(f"Weather agent error: {e}", exc_info=True)
        return {
            "statusCode": 200,
            "body": json.dumps({
                "success": False,
                "location": body.get("state", "India"),
                "summary_text": "Moderate weather expected. Monitor your crop daily.",
                "forecast": {},
                "error": str(e)
            })
        }


def fetch_openmeteo(lat: float, lon: float) -> dict:
    """Fetch weather data from Open-Meteo free API"""
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}"
        f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
        f"precipitation_hours,windspeed_10m_max,uv_index_max,et0_fao_evapotranspiration"
        f"&forecast_days=7&timezone=Asia/Kolkata"
    )
    with urllib.request.urlopen(url, timeout=8) as resp:
        return json.loads(resp.read())


def generate_weather_advisory(crop, state, avg_temp, total_rain,
                               max_temps, rainfall, is_harvest, is_critical, bedrock_client, model_id):
    """Use Bedrock to generate crop-specific weather advisory"""
    try:
        prompt = f"""You are an expert agrometeorology advisor for Indian farmers.

WEATHER DATA:
- Location: {state}
- Average max temperature (7 days): {avg_temp:.1f}°C
- Total expected rainfall (7 days): {total_rain:.1f}mm
- Daily rainfall pattern: {[round(r,1) for r in rainfall]}
- Daily max temps: {[round(t,1) for t in max_temps]}

CROP CONTEXT:
- Crop: {crop}
- Is harvest time: {is_harvest}
- Is critical growth phase: {is_critical}

Provide actionable weather-based advisory. Return ONLY valid JSON:
{{
    "overall_summary": "2-sentence weather summary in simple language",
    "immediate_warning": "most urgent weather warning if any",
    "spray_advice": "when to spray - morning/evening/avoid spray",
    "irrigation_advice": "irrigation recommendation based on rainfall and evapotranspiration",
    "harvest_advice": "if applicable, harvesting recommendation",
    "disease_risk_from_weather": "high/medium/low - based on humidity and temperature",
    "disease_risk_reason": "why this risk level",
    "best_farm_activities": ["activity 1", "activity 2", "activity 3"],
    "activities_to_avoid": ["avoid activity 1", "avoid activity 2"],
    "soil_advice": "soil moisture and preparation advice"
}}"""

        response = bedrock_client.invoke_model(
            modelId=model_id,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 800,
                "messages": [{"role": "user", "content": prompt}]
            })
        )
        result_text = json.loads(response["body"].read())["content"][0]["text"]
        start = result_text.find("{")
        end   = result_text.rfind("}") + 1
        return json.loads(result_text[start:end]) if start != -1 else {"overall_summary": "Check local weather"}
    except Exception as e:
        logger.warning(f"Bedrock weather advisory failed: {e}")
        return generate_rule_based_advisory(avg_temp, total_rain)


def generate_rule_based_advisory(avg_temp: float, total_rain: float) -> dict:
    """Fallback rule-based advisory"""
    if total_rain > 30:
        summary = f"Heavy rainfall ({total_rain:.0f}mm) expected. Avoid spray. Ensure proper field drainage."
        warn    = "Risk of waterlogging — check drainage channels immediately"
    elif avg_temp > 40:
        summary = f"Extreme heat ({avg_temp:.0f}°C). Irrigate in early morning and evening only."
        warn    = "Heat stress risk — mulch soil to retain moisture"
    elif avg_temp < 12:
        summary = f"Cold conditions ({avg_temp:.0f}°C). Protect crops from frost."
        warn    = "Frost risk at night — cover sensitive crops"
    else:
        summary = f"Moderate conditions ({avg_temp:.0f}°C, {total_rain:.0f}mm rain). Good for spray."
        warn    = "No critical weather warnings"
    return {"overall_summary": summary, "immediate_warning": warn}


def classify_weather(avg_temp: float, total_rain: float) -> str:
    if total_rain > 50: return "Very Wet"
    elif total_rain > 20: return "Wet"
    elif avg_temp > 40: return "Extreme Heat"
    elif avg_temp > 35: return "Hot"
    elif avg_temp < 15: return "Cold"
    else: return "Moderate"


def get_spray_days(dates: list, rainfall: list, wind: list) -> list:
    """Return dates when spraying is suitable"""
    suitable = []
    for i, date in enumerate(dates):
        rain = rainfall[i] if i < len(rainfall) else 0
        spd  = wind[i] if i < len(wind) else 0
        if rain < 2 and spd < 15:  # Less than 2mm rain and wind < 15 km/h
            day_name = datetime.strptime(date, "%Y-%m-%d").strftime("%A")
            suitable.append(f"{day_name} ({date})")
    return suitable if suitable else ["Check local conditions daily"]
