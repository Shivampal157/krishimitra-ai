"""
KrishiMitra AI — Disease Detection Agent
Dedicated Lambda for Rekognition + Bedrock Vision analysis
"""
import json
import boto3
import base64
import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

rekognition = boto3.client("rekognition", region_name=os.environ.get("REGION", "us-east-1"))
bedrock     = boto3.client("bedrock-runtime", region_name=os.environ.get("REGION", "us-east-1"))
s3          = boto3.client("s3", region_name=os.environ.get("REGION", "us-east-1"))

MODEL_ID  = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")
S3_BUCKET = os.environ.get("S3_BUCKET", "krishimitra-crop-images")

# Known crop diseases in India mapped to symptoms
DISEASE_KNOWLEDGE_BASE = {
    "wheat": ["Leaf Rust", "Stem Rust", "Yellow Rust", "Powdery Mildew", "Karnal Bunt", "Loose Smut"],
    "rice":  ["Blast", "Bacterial Blight", "Brown Spot", "Sheath Blight", "False Smut"],
    "cotton":["Bollworm", "Whitefly", "Leaf Curl Virus", "Grey Mildew", "Alternaria Blight"],
    "tomato":["Early Blight", "Late Blight", "Leaf Miner", "TYLCV", "Fusarium Wilt"],
    "potato":["Late Blight", "Early Blight", "Black Scurf", "Common Scab"],
    "sugarcane": ["Red Rot", "Smut", "Grassy Shoot", "Ratoon Stunting Disease"],
    "soybean": ["Rust", "Charcoal Rot", "Frogeye Leaf Spot", "Pod Blight"],
    "onion":   ["Purple Blotch", "Stemphylium Blight", "Downy Mildew", "Basal Rot"],
}


def lambda_handler(event, context):
    """Dedicated disease detection agent"""
    logger.info("Disease Agent Lambda invoked")

    try:
        body      = json.loads(event.get("body", "{}")) if isinstance(event.get("body"), str) else event
        image_b64 = body.get("image")
        crop_type = body.get("cropType", "wheat")

        if not image_b64:
            return {"statusCode": 400, "body": json.dumps({"error": "No image provided"})}

        image_bytes = base64.b64decode(image_b64)

        # Step 1: AWS Rekognition — Label detection
        logger.info("Running AWS Rekognition label detection...")
        rek_response = rekognition.detect_labels(
            Image={"Bytes": image_bytes},
            MaxLabels=25,
            MinConfidence=55
        )
        labels     = [l["Name"] for l in rek_response["Labels"]]
        high_conf  = [l for l in rek_response["Labels"] if l["Confidence"] > 80]
        logger.info(f"Rekognition detected {len(labels)} labels: {labels[:10]}")

        # Step 2: AWS Rekognition — Detect text (for label scanning)
        try:
            text_resp  = rekognition.detect_text(Image={"Bytes": image_bytes})
            detected_text = [t["DetectedText"] for t in text_resp.get("TextDetections", [])
                             if t["Type"] == "LINE"]
        except Exception:
            detected_text = []

        # Step 3: Bedrock Claude Vision — Deep disease analysis
        logger.info("Running Bedrock Vision analysis...")
        known_diseases = DISEASE_KNOWLEDGE_BASE.get(crop_type, [])

        prompt = f"""You are Dr. KrishiAI, India's top agricultural pathologist with 20 years experience.

TASK: Analyze this crop image for diseases.
CROP TYPE: {crop_type}
AWS REKOGNITION DETECTED: {labels}
HIGH CONFIDENCE LABELS: {[l['Name'] for l in high_conf]}
KNOWN DISEASES FOR THIS CROP: {known_diseases}

Provide a detailed disease analysis. Return ONLY valid JSON:
{{
    "disease_detected": true,
    "disease_name": "Leaf Rust",
    "disease_name_hindi": "पत्ती का जंग रोग",
    "disease_name_marathi": "पानाचा गंज रोग",
    "scientific_name": "Puccinia triticina",
    "severity": "medium",
    "confidence": 85,
    "affected_parts": ["leaf", "stem"],
    "symptoms_observed": [
        "Orange-brown pustules on leaves",
        "Yellowing around lesions",
        "Leaf tip necrosis"
    ],
    "disease_stage": "early/middle/advanced",
    "spread_risk": "high",
    "crop_loss_estimate": "15-25% if untreated",
    "immediate_action_needed": true,
    "diagnosis_basis": "Visual analysis based on color patterns and lesion morphology",
    "rekognition_labels": {labels}
}}

If no disease is visible, set disease_detected to false and explain why the crop looks healthy."""

        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1500,
                "messages": [{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_b64
                            }
                        },
                        {"type": "text", "text": prompt}
                    ]
                }]
            })
        )

        result_text = json.loads(response["body"].read())["content"][0]["text"]
        logger.info(f"Bedrock response: {result_text[:200]}...")

        # Parse JSON from response
        start = result_text.find("{")
        end   = result_text.rfind("}") + 1
        disease_data = json.loads(result_text[start:end]) if start != -1 else {
            "disease_detected": False,
            "error": "Could not analyze image"
        }

        # Enrich with metadata
        disease_data["rekognition_label_count"] = len(labels)
        disease_data["analysis_model"] = MODEL_ID
        disease_data["agent"] = "disease_detection_agent"

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
            "body": json.dumps(disease_data, ensure_ascii=False)
        }

    except Exception as e:
        logger.error(f"Disease agent error: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e), "disease_detected": False})
        }
