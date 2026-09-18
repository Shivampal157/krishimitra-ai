"""
KrishiMitra AI — Main Orchestrator Lambda
Coordinates all specialized agents using Strands SDK pattern
"""
import json
import boto3
import base64
import os
import logging
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock = boto3.client("bedrock-runtime", region_name=os.environ.get("REGION", "us-east-1"))
rekognition = boto3.client("rekognition", region_name=os.environ.get("REGION", "us-east-1"))
dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("REGION", "us-east-1"))
polly = boto3.client("polly", region_name=os.environ.get("REGION", "us-east-1"))
s3 = boto3.client("s3", region_name=os.environ.get("REGION", "us-east-1"))
lambda_client = boto3.client("lambda", region_name=os.environ.get("REGION", "us-east-1"))

DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "krishimitra-farmers")
S3_BUCKET = os.environ.get("S3_BUCKET", "krishimitra-crop-images")
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")

LANGUAGE_CONFIGS = {
    "hi": {"polly_voice": "Aditi", "name": "Hindi", "transcribe_code": "hi-IN"},
    "mr": {"polly_voice": "Aditi", "name": "Marathi", "transcribe_code": "mr-IN"},
    "te": {"polly_voice": "Aditi", "name": "Telugu", "transcribe_code": "te-IN"},
    "ta": {"polly_voice": "Aditi", "name": "Tamil", "transcribe_code": "ta-IN"},
    "bn": {"polly_voice": "Aditi", "name": "Bengali", "transcribe_code": "bn-IN"},
    "en": {"polly_voice": "Kajal", "name": "English", "transcribe_code": "en-IN"},
}


def lambda_handler(event, context):
    """Main orchestrator — coordinates all 4 specialized agents"""
    logger.info(f"KrishiMitra Orchestrator invoked: {json.dumps(event)[:500]}")

    try:
        # Parse request
        body = json.loads(event.get("body", "{}"))
        image_base64 = body.get("image")
        text_query = body.get("query", "")
        language = body.get("language", "hi")
        farmer_id = body.get("farmerId", f"farmer_{datetime.now().timestamp()}")
        crop_type = body.get("cropType", "unknown")
        location = body.get("location", {"state": "India", "district": "Unknown"})

        logger.info(f"Processing for farmer: {farmer_id}, crop: {crop_type}, lang: {language}")

        # ── Agent 1: Disease Detection ──────────────────────────────────
        disease_result = {}
        if image_base64:
            logger.info("🔍 Disease Agent: Analyzing crop image...")
            disease_result = run_disease_agent(image_base64, crop_type)
            logger.info(f"Disease detected: {disease_result.get('disease_name', 'None')}")

        # ── Agent 2: Weather Advisory ───────────────────────────────────
        logger.info("🌦️ Weather Agent: Fetching weather data...")
        weather_result = run_weather_agent(location)

        # ── Agent 3: Market Price Lookup ────────────────────────────────
        logger.info("📊 Market Agent: Getting mandi prices...")
        market_result = run_market_agent(crop_type, location)

        # ── Agent 4: Treatment Recommendation (Supervisor) ──────────────
        logger.info("💊 Treatment Agent: Generating advisory...")
        treatment_result = run_treatment_agent(
            disease_result, weather_result, market_result,
            crop_type, text_query, language
        )

        # ── Bedrock Supervisor: Synthesize Final Advisory ────────────────
        logger.info("🧠 Supervisor Agent: Synthesizing final advisory...")
        final_advisory = synthesize_advisory(
            disease_result, weather_result, market_result,
            treatment_result, language, crop_type, location
        )

        # ── Generate Voice Response ──────────────────────────────────────
        audio_url = None
        try:
            logger.info("🔊 Polly: Generating voice advisory...")
            audio_url = generate_voice_response(final_advisory, language)
        except Exception as e:
            logger.warning(f"Voice generation failed (non-critical): {e}")

        # ── Save to DynamoDB ─────────────────────────────────────────────
        save_to_dynamodb(farmer_id, crop_type, disease_result, final_advisory, language)

        response_data = {
            "success": True,
            "farmerId": farmer_id,
            "language": language,
            "agents_used": ["disease_detection", "weather", "market_price", "treatment", "supervisor"],
            "disease": disease_result,
            "weather": weather_result,
            "market": market_result,
            "treatment": treatment_result,
            "advisory": final_advisory,
            "audioUrl": audio_url,
            "timestamp": datetime.now().isoformat()
        }

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            "body": json.dumps(response_data, ensure_ascii=False)
        }

    except Exception as e:
        logger.error(f"Orchestrator error: {str(e)}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"success": False, "error": str(e)})
        }


def run_disease_agent(image_base64: str, crop_type: str) -> dict:
    """Agent 1: Detect crop disease using Rekognition + Bedrock Vision"""
    try:
        image_bytes = base64.b64decode(image_base64)

        # AWS Rekognition: Label detection for initial analysis
        rekognition_result = rekognition.detect_labels(
            Image={"Bytes": image_bytes},
            MaxLabels=20,
            MinConfidence=50
        )
        labels = [label["Name"] for label in rekognition_result["Labels"]]
        logger.info(f"Rekognition labels: {labels}")

        # Bedrock Claude Vision: Deep disease analysis
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_base64
                        }
                    },
                    {
                        "type": "text",
                        "text": f"""You are an expert agricultural pathologist specializing in Indian crops.
                        
Crop Type: {crop_type}
AWS Rekognition detected these labels: {labels}

Analyze this crop image and provide ONLY a JSON response with this exact structure:
{{
    "disease_detected": true/false,
    "disease_name": "exact disease name in English",
    "disease_name_hindi": "रोग का नाम हिंदी में",
    "severity": "low/medium/high/critical",
    "confidence": 0-100,
    "affected_parts": ["leaf", "stem", "fruit"],
    "symptoms_observed": ["symptom1", "symptom2"],
    "spread_risk": "low/medium/high",
    "immediate_action_needed": true/false
}}

Be specific and accurate. If no disease is visible, set disease_detected to false."""
                    }
                ]
            }
        ]

        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "messages": messages
            })
        )

        result_text = json.loads(response["body"].read())["content"][0]["text"]
        # Extract JSON from response
        start = result_text.find("{")
        end = result_text.rfind("}") + 1
        if start != -1 and end > start:
            disease_data = json.loads(result_text[start:end])
        else:
            disease_data = {"disease_detected": False, "error": "Could not parse"}

        disease_data["rekognition_labels"] = labels
        return disease_data

    except Exception as e:
        logger.error(f"Disease agent error: {e}")
        return {"disease_detected": False, "error": str(e), "rekognition_labels": []}


def run_weather_agent(location: dict) -> dict:
    """Agent 2: Fetch weather data and generate crop-specific advisory"""
    try:
        import urllib.request
        state = location.get("state", "Maharashtra")

        # Use Open-Meteo free API (no key needed for demo)
        coords = get_state_coordinates(state)
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={coords['lat']}&longitude={coords['lon']}"
            f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max"
            f"&forecast_days=7&timezone=Asia/Kolkata"
        )
        with urllib.request.urlopen(url, timeout=5) as response:
            weather_data = json.loads(response.read())

        daily = weather_data.get("daily", {})
        return {
            "success": True,
            "location": state,
            "forecast": {
                "next_7_days": {
                    "dates": daily.get("time", [])[:7],
                    "max_temp": daily.get("temperature_2m_max", [])[:7],
                    "min_temp": daily.get("temperature_2m_min", [])[:7],
                    "rainfall_mm": daily.get("precipitation_sum", [])[:7],
                    "wind_speed": daily.get("windspeed_10m_max", [])[:7],
                }
            },
            "summary": generate_weather_summary(daily)
        }
    except Exception as e:
        logger.warning(f"Weather agent error (using defaults): {e}")
        return {
            "success": False,
            "location": location.get("state", "India"),
            "summary": "Moderate temperature expected. Monitor soil moisture.",
            "forecast": {}
        }


def run_market_agent(crop_type: str, location: dict) -> dict:
    """Agent 3: Get current mandi prices using Bedrock knowledge"""
    try:
        prompt = f"""You are an expert on Indian agricultural mandi prices.
        
Provide realistic current mandi prices for {crop_type} in {location.get("state", "India")}.
Return ONLY this JSON (no other text):
{{
    "crop": "{crop_type}",
    "state": "{location.get("state", "India")}",
    "mandi_price_per_quintal": 2500,
    "msp_price_per_quintal": 2200,
    "price_trend": "rising/falling/stable",
    "best_selling_time": "advice on when to sell",
    "nearby_mandis": ["mandi1", "mandi2"],
    "price_last_week": 2400,
    "price_change_percent": "+4.2%"
}}
Use realistic 2026 Indian market prices."""

        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 500,
                "messages": [{"role": "user", "content": prompt}]
            })
        )
        result_text = json.loads(response["body"].read())["content"][0]["text"]
        start = result_text.find("{")
        end = result_text.rfind("}") + 1
        if start != -1:
            return json.loads(result_text[start:end])
        return {"crop": crop_type, "mandi_price_per_quintal": "N/A"}

    except Exception as e:
        logger.error(f"Market agent error: {e}")
        return {"crop": crop_type, "error": str(e)}


def run_treatment_agent(disease: dict, weather: dict, market: dict,
                         crop_type: str, query: str, language: str) -> dict:
    """Agent 4: Generate specific treatment recommendations"""
    try:
        disease_name = disease.get("disease_name", "unknown")
        severity = disease.get("severity", "medium")

        prompt = f"""You are an expert agricultural consultant for Indian farmers.

Disease: {disease_name}
Severity: {severity}
Crop: {crop_type}
Weather: {weather.get("summary", "moderate")}
Farmer's query: {query}

Provide treatment recommendations in this exact JSON format:
{{
    "organic_treatment": {{
        "method": "specific organic treatment method",
        "ingredients": ["ingredient1", "ingredient2"],
        "preparation": "step by step preparation",
        "application": "how and when to apply",
        "frequency": "how often"
    }},
    "chemical_treatment": {{
        "pesticide_name": "specific pesticide name",
        "dosage": "exact dosage per acre",
        "application_method": "spray/soil drench/etc",
        "precautions": ["precaution1", "precaution2"],
        "cost_per_acre": "approximate cost in rupees"
    }},
    "prevention": ["prevention tip 1", "prevention tip 2", "prevention tip 3"],
    "recovery_timeline": "expected recovery time",
    "urgency": "immediate/within 48hrs/within week"
}}"""

        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "messages": [{"role": "user", "content": prompt}]
            })
        )
        result_text = json.loads(response["body"].read())["content"][0]["text"]
        start = result_text.find("{")
        end = result_text.rfind("}") + 1
        if start != -1:
            return json.loads(result_text[start:end])
        return {"error": "Could not parse treatment"}

    except Exception as e:
        logger.error(f"Treatment agent error: {e}")
        return {"error": str(e)}


def synthesize_advisory(disease, weather, market, treatment, language, crop_type, location):
    """Supervisor Agent: Synthesize all agent outputs into final advisory"""
    lang_name = LANGUAGE_CONFIGS.get(language, {}).get("name", "Hindi")

    prompt = f"""You are the KrishiMitra AI supervisor. Synthesize the following expert agent reports 
into a clear, actionable advisory for an Indian farmer. Write in {lang_name} language.

DISEASE REPORT: {json.dumps(disease, ensure_ascii=False)}
WEATHER REPORT: {json.dumps(weather, ensure_ascii=False)}
MARKET PRICES: {json.dumps(market, ensure_ascii=False)}
TREATMENT PLAN: {json.dumps(treatment, ensure_ascii=False)}
CROP TYPE: {crop_type}
LOCATION: {json.dumps(location)}

Write a warm, helpful advisory in {lang_name} that:
1. Clearly names the disease (if detected)
2. Gives the MOST IMPORTANT action to take TODAY
3. Mentions specific treatment with dosage
4. Tells market price and if they should sell now or wait
5. Gives 1 weather warning relevant to their crop

Keep it under 150 words. Simple language that a rural farmer understands.
Start with "नमस्ते किसान भाई" if Hindi, or appropriate greeting for other languages."""

    response = bedrock.invoke_model(
        modelId=MODEL_ID,
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 500,
            "messages": [{"role": "user", "content": prompt}]
        })
    )
    return json.loads(response["body"].read())["content"][0]["text"]


def generate_voice_response(text: str, language: str) -> str:
    """Convert text to speech using Amazon Polly"""
    lang_config = LANGUAGE_CONFIGS.get(language, LANGUAGE_CONFIGS["hi"])

    # Polly supports Hindi (hi-IN), Kannada, Tamil, Telugu
    polly_lang_map = {
        "hi": "hi-IN", "mr": "hi-IN", "te": "hi-IN",
        "ta": "hi-IN", "bn": "hi-IN", "en": "en-IN"
    }

    response = polly.synthesize_speech(
        Text=text[:2900],  # Polly limit
        OutputFormat="mp3",
        VoiceId=lang_config["polly_voice"],
        LanguageCode=polly_lang_map.get(language, "hi-IN"),
        Engine="neural"
    )

    audio_data = response["AudioStream"].read()
    audio_b64 = base64.b64encode(audio_data).decode("utf-8")

    # Save to S3
    filename = f"audio/{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp3"
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=filename,
        Body=audio_data,
        ContentType="audio/mpeg",
        ACL="public-read"
    )

    return f"https://{S3_BUCKET}.s3.amazonaws.com/{filename}"


def save_to_dynamodb(farmer_id, crop_type, disease, advisory, language):
    """Save consultation to DynamoDB for farmer history"""
    try:
        table = dynamodb.Table(DYNAMODB_TABLE)
        table.put_item(Item={
            "farmerId": farmer_id,
            "timestamp": datetime.now().isoformat(),
            "cropType": crop_type,
            "diseaseDetected": disease.get("disease_name", "none"),
            "severity": disease.get("severity", "none"),
            "advisory": advisory[:1000],
            "language": language,
            "consultationDate": datetime.now().strftime("%Y-%m-%d")
        })
        logger.info(f"Saved consultation for farmer {farmer_id}")
    except Exception as e:
        logger.error(f"DynamoDB save error: {e}")


def get_state_coordinates(state: str) -> dict:
    """Return lat/lon for Indian states"""
    coords = {
        "Maharashtra": {"lat": 19.7515, "lon": 75.7139},
        "Punjab": {"lat": 31.1471, "lon": 75.3412},
        "Uttar Pradesh": {"lat": 26.8467, "lon": 80.9462},
        "Rajasthan": {"lat": 27.0238, "lon": 74.2179},
        "Madhya Pradesh": {"lat": 22.9734, "lon": 78.6569},
        "Karnataka": {"lat": 15.3173, "lon": 75.7139},
        "Andhra Pradesh": {"lat": 15.9129, "lon": 79.7400},
        "Tamil Nadu": {"lat": 11.1271, "lon": 78.6569},
        "Gujarat": {"lat": 22.2587, "lon": 71.1924},
        "Haryana": {"lat": 29.0588, "lon": 76.0856},
    }
    return coords.get(state, {"lat": 20.5937, "lon": 78.9629})  # Default India center


def generate_weather_summary(daily: dict) -> str:
    """Generate a simple weather summary"""
    try:
        temps = daily.get("temperature_2m_max", [30] * 7)[:3]
        rainfall = daily.get("precipitation_sum", [0] * 7)[:3]
        avg_temp = sum(temps) / len(temps) if temps else 30
        total_rain = sum(rainfall) if rainfall else 0

        if total_rain > 20:
            return f"Heavy rainfall expected ({total_rain:.0f}mm). Avoid fungicide spray. Check drainage."
        elif avg_temp > 38:
            return f"Very hot conditions ({avg_temp:.0f}°C). Irrigate in morning/evening only."
        elif avg_temp < 15:
            return f"Cool conditions ({avg_temp:.0f}°C). Watch for frost damage."
        else:
            return f"Moderate weather ({avg_temp:.0f}°C). Good conditions for spray application."
    except:
        return "Weather data unavailable. Check local conditions."
