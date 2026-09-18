"""
KrishiMitra AI — Voice Handler Lambda
Handles Transcribe (voice→text) and Polly (text→voice) pipeline
"""
import json
import boto3
import base64
import os
import time
import logging
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

transcribe = boto3.client("transcribe", region_name=os.environ.get("REGION", "us-east-1"))
s3 = boto3.client("s3", region_name=os.environ.get("REGION", "us-east-1"))
S3_BUCKET = os.environ.get("S3_BUCKET", "krishimitra-crop-images")

LANGUAGE_MAP = {
    "hi": "hi-IN",
    "mr": "mr-IN",
    "te": "te-IN",
    "ta": "ta-IN",
    "bn": "bn-IN",
    "en": "en-IN"
}


def lambda_handler(event, context):
    """Process voice input: audio → text via Amazon Transcribe"""
    logger.info("Voice Handler invoked")

    try:
        body = json.loads(event.get("body", "{}"))
        audio_base64 = body.get("audio")
        language = body.get("language", "hi")
        audio_format = body.get("format", "wav")

        if not audio_base64:
            return error_response("No audio data provided")

        # Upload audio to S3 for Transcribe
        audio_bytes = base64.b64decode(audio_base64)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        audio_key = f"voice-input/{timestamp}.{audio_format}"

        s3.put_object(
            Bucket=S3_BUCKET,
            Key=audio_key,
            Body=audio_bytes,
            ContentType=f"audio/{audio_format}"
        )

        s3_uri = f"s3://{S3_BUCKET}/{audio_key}"
        job_name = f"krishimitra-{timestamp}"

        # Start Transcribe job
        transcribe_lang = LANGUAGE_MAP.get(language, "hi-IN")
        transcribe.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": s3_uri},
            MediaFormat=audio_format,
            LanguageCode=transcribe_lang,
            OutputBucketName=S3_BUCKET,
            OutputKey=f"transcripts/{job_name}.json",
            Settings={
                "ShowSpeakerLabels": False,
                "ChannelIdentification": False
            }
        )

        # Poll for completion (max 30 seconds for Lambda)
        transcribed_text = wait_for_transcription(job_name)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "success": True,
                "transcribed_text": transcribed_text,
                "language": language,
                "job_name": job_name
            }, ensure_ascii=False)
        }

    except Exception as e:
        logger.error(f"Voice handler error: {e}", exc_info=True)
        return error_response(str(e))


def wait_for_transcription(job_name: str, max_wait: int = 25) -> str:
    """Poll Transcribe until job completes"""
    start = time.time()
    while time.time() - start < max_wait:
        response = transcribe.get_transcription_job(TranscriptionJobName=job_name)
        status = response["TranscriptionJob"]["TranscriptionJobStatus"]

        if status == "COMPLETED":
            transcript_uri = response["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
            return fetch_transcript(transcript_uri)
        elif status == "FAILED":
            raise Exception(f"Transcription failed: {response['TranscriptionJob'].get('FailureReason')}")

        time.sleep(2)

    return "Transcription timeout - please try again"


def fetch_transcript(uri: str) -> str:
    """Fetch transcription result from S3"""
    import urllib.request
    with urllib.request.urlopen(uri) as resp:
        data = json.loads(resp.read())
    return data["results"]["transcripts"][0]["transcript"]


def error_response(message: str) -> dict:
    return {
        "statusCode": 400,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"success": False, "error": message})
    }
