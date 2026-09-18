"""
KrishiMitra AI — Treatment Agent Lambda
Generates specific, actionable treatment plans using Bedrock
"""
import json
import boto3
import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock  = boto3.client("bedrock-runtime", region_name=os.environ.get("REGION", "us-east-1"))
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")

# India-approved pesticide registry (subset)
APPROVED_PESTICIDES = {
    "Leaf Rust":        {"chemical": "Propiconazole 25% EC", "dosage": "1ml/L", "cost": "₹220/acre"},
    "Blast":            {"chemical": "Tricyclazole 75% WP",  "dosage": "0.6g/L", "cost": "₹180/acre"},
    "Leaf Blight":      {"chemical": "Mancozeb 75% WP",      "dosage": "2.5g/L", "cost": "₹150/acre"},
    "Powdery Mildew":   {"chemical": "Sulphur 80% WG",       "dosage": "2g/L",   "cost": "₹120/acre"},
    "Late Blight":      {"chemical": "Metalaxyl-M 8% + Mancozeb 64% WP", "dosage": "2g/L", "cost": "₹280/acre"},
    "Early Blight":     {"chemical": "Chlorothalonil 75% WP","dosage": "2g/L",   "cost": "₹160/acre"},
    "Bacterial Blight": {"chemical": "Streptomycin Sulfate 90% SP", "dosage": "200mg/10L", "cost": "₹240/acre"},
    "Whitefly":         {"chemical": "Imidacloprid 17.8% SL","dosage": "0.3ml/L","cost": "₹200/acre"},
    "Bollworm":         {"chemical": "Emamectin Benzoate 5% SG","dosage":"0.4g/L","cost": "₹320/acre"},
    "default":          {"chemical": "Mancozeb 75% WP",      "dosage": "2g/L",   "cost": "₹150/acre"},
}

ORGANIC_REMEDIES = {
    "fungal":     {"method": "Neem Oil + Baking Soda spray", "recipe": "Neem oil 5ml + Baking soda 1g + Soap 2ml per 1L water"},
    "bacterial":  {"method": "Copper Sulphate (Bordeaux Mix)", "recipe": "100g CuSO4 + 100g Lime per 10L water"},
    "insect":     {"method": "Neem Seed Kernel Extract (NSKE 5%)", "recipe": "500g neem seeds ground in 10L water, filter and spray"},
    "viral":      {"method": "Mineral oil spray + remove infected plants", "recipe": "15ml mineral oil per 1L water"},
    "default":    {"method": "Trichoderma viride biological control", "recipe": "5g Trichoderma powder per 1L water"},
}


def lambda_handler(event, context):
    logger.info("Treatment Agent invoked")

    try:
        body = json.loads(event.get("body", "{}")) if isinstance(event.get("body"), str) else event

        disease_name = body.get("disease_name", "unknown")
        severity     = body.get("severity", "medium")
        crop_type    = body.get("cropType", "wheat")
        weather_summary = body.get("weather_summary", "moderate conditions")
        language     = body.get("language", "hi")

        # Get known pesticide info
        pesticide_info = APPROVED_PESTICIDES.get(disease_name, APPROVED_PESTICIDES["default"])

        # Classify disease type for organic remedy
        disease_lower = disease_name.lower()
        if any(w in disease_lower for w in ["rust", "blight", "mildew", "rot", "smut", "blast"]):
            organic_type = "fungal"
        elif any(w in disease_lower for w in ["bacterial", "blight"]):
            organic_type = "bacterial"
        elif any(w in disease_lower for w in ["worm", "fly", "mite", "aphid", "bug"]):
            organic_type = "insect"
        elif any(w in disease_lower for w in ["virus", "mosaic", "curl"]):
            organic_type = "viral"
        else:
            organic_type = "default"

        organic_info = ORGANIC_REMEDIES[organic_type]

        prompt = f"""You are India's top agricultural expert specializing in crop treatment.

Disease: {disease_name}
Severity: {severity}
Crop: {crop_type}
Weather: {weather_summary}
Known Pesticide: {pesticide_info}
Organic Remedy: {organic_info}

Generate a detailed, practical treatment plan for an Indian farmer. Return ONLY valid JSON:
{{
    "organic_treatment": {{
        "method": "Neem Oil Spray",
        "ingredients": ["Neem oil 5ml", "Liquid soap 2ml", "Water 1L"],
        "preparation": "Mix neem oil with soap first, then slowly add to water while stirring",
        "application": "Spray on both sides of leaves. Best in early morning (before 8 AM) or evening (after 5 PM)",
        "frequency": "Every 3 days for 2 weeks",
        "cost_estimate": "₹50-80 per acre",
        "effectiveness": "60-70% for mild to medium infections"
    }},
    "chemical_treatment": {{
        "pesticide_name": "{pesticide_info['chemical']}",
        "dosage": "{pesticide_info['dosage']} of water",
        "water_volume": "200L water per acre",
        "application_method": "Knapsack sprayer - foliar spray",
        "best_time": "Early morning when wind is calm",
        "precautions": [
            "Wear protective gloves, mask, and goggles",
            "Do not spray if rain is expected within 4 hours",
            "Keep away from water bodies and beehives",
            "Do not eat or smoke while spraying"
        ],
        "cost_per_acre": "{pesticide_info['cost']}",
        "withdrawal_period": "14 days before harvest"
    }},
    "integrated_approach": "Start with organic treatment for 3 days. If no improvement, switch to chemical. For critical severity, use both simultaneously.",
    "prevention": [
        "Use certified disease-resistant seed varieties",
        "Maintain proper row spacing for air circulation",
        "Avoid overhead irrigation - use drip/furrow irrigation",
        "Remove and burn infected plant material immediately",
        "Rotate crops seasonally"
    ],
    "recovery_timeline": "7-10 days with treatment",
    "urgency": "within 48hrs",
    "follow_up": "Re-inspect crop after 5 days. If disease spreads, consult local KVK (Krishi Vigyan Kendra)",
    "government_helpline": "Kisan Call Center: 1800-180-1551 (toll-free)",
    "estimated_yield_save": "Treating now can save {70 if severity == 'medium' else 50}% of expected yield"
}}"""

        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1500,
                "messages": [{"role": "user", "content": prompt}]
            })
        )

        result_text = json.loads(response["body"].read())["content"][0]["text"]
        start = result_text.find("{")
        end   = result_text.rfind("}") + 1
        treatment = json.loads(result_text[start:end]) if start != -1 else {"error": "Parse failed"}
        treatment["agent"] = "treatment_agent"

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps(treatment, ensure_ascii=False)
        }

    except Exception as e:
        logger.error(f"Treatment agent error: {e}", exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
