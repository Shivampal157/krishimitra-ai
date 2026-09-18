# 📋 KrishiMitra AI — Demo Script
## WeMakeDevs × AWS First Commit Hackathon

---

## 🎬 3-Minute Demo Video Script

---

### [00:00 – 00:20] THE PROBLEM (Hook)

**Screen:** Show real news headline or stat card
```
"₹2 lakh crore — India's annual crop loss"
"140 million farmers. No AI. No help. No language they understand."
```

**Narration (English):**
> "Meet Ramesh. He's a wheat farmer in Uttar Pradesh. Yesterday he noticed brown spots on his leaves. He has no internet, no English, and the nearest KVK is 40 kilometers away. By tomorrow, 30% of his crop could be gone."

---

### [00:20 – 01:20] LIVE DEMO (The Wow Moment)

**Screen:** Open KrishiMitra AI on mobile browser

**Step 1 — Select Language**
> "Ramesh opens KrishiMitra. He selects Hindi."

**Step 2 — Click Crop Photo**
> "He clicks a photo of his diseased wheat leaf."

**Step 3 — Voice Query**
> "He speaks: 'मेरी गेहूं की पत्ती पर भूरे दाग हैं'"
> (Show Amazon Transcribe converting voice to text)

**Step 4 — Watch the Agents Run**
> "Four AI agents powered by Amazon Bedrock fire up simultaneously:"
- 🔬 Disease Agent → Amazon Rekognition scans the image
- 🌦️ Weather Agent → Real-time weather from Open-Meteo
- 📊 Market Agent → Live Agmarknet mandi prices
- 💊 Treatment Agent → Generates treatment plan

**Step 5 — Advisory in Hindi**
> "In 4 seconds — Amazon Polly speaks back in Hindi:"
```
"नमस्ते किसान भाई! आपकी गेहूं में 'पत्ती का जंग रोग' है।
आज ही Propiconazole 25% EC (1ml/L) का छिड़काव करें।
मंडी में गेहूं ₹2,750/क्विंटल है — 2 हफ्ते रुककर बेचें।"
```

---

### [01:20 – 02:00] AWS ARCHITECTURE (Technical Depth)

**Screen:** Architecture diagram

> "Let me show you what's happening under the hood."

```
📸 Image → Amazon S3 → Amazon Rekognition (25 labels detected)
🎤 Voice → Amazon Transcribe → Hindi text
    ↓
Amazon Bedrock (Claude 3.5 Sonnet) — 4 specialized agents
    ↓
Amazon Polly Neural Voice → Hindi audio response
💾 Amazon DynamoDB — saved to farmer's history
```

> "All on AWS. All serverless. All deployed with a live URL."

**Show AWS Console:**
- CloudWatch: Show all 4 agents logged
- DynamoDB: Show consultation saved
- S3: Show crop image stored
- Rekognition: Show labels detected

---

### [02:00 – 02:40] IMPACT + LEARNING

**Screen:** Impact stats

> "This isn't just a demo. This is built for 140 million farmers."

```
✅ Works in 5 Indian languages
✅ Combines disease + weather + market + treatment in one flow
✅ Voice-first — no typing needed
✅ Free for farmers
```

**What we learned:**
> "In 4 days, our team learned:
> - Amazon Bedrock Strands multi-agent architecture for the first time
> - How to build multimodal AI pipelines combining vision, voice, and text
> - AWS SAM for infrastructure-as-code deployment
> - Amazon Polly's neural voice for Indian languages"

---

### [02:40 – 03:00] CLOSE

**Screen:** KrishiMitra logo + team name

> "KrishiMitra AI — your AI farmer's companion. Built on AWS. Built for Bharat."

```
Team Avengers | WeMakeDevs × AWS First Commit 2026
Live at: https://krishimitra.amplifyapp.com
GitHub: github.com/your-team/krishimitra-ai
```

---

## 📝 Writeup Template

### Problem
India loses ₹2 lakh crore annually to crop disease. 140 million farmers lack access to agronomists, with 75% of experts in cities. No tool exists that combines disease detection, treatment, market prices, and weather advisory in Indian languages.

### Solution
KrishiMitra AI is a multimodal farm advisory system. A farmer photographs a diseased crop and speaks in their language. Four specialized AI agents (disease, weather, market, treatment) powered by Amazon Bedrock analyze the inputs simultaneously and generate a comprehensive advisory, spoken back via Amazon Polly in the farmer's language.

### AWS Services Used
Amazon Bedrock (Claude 3.5 Sonnet), AWS Rekognition, Amazon Transcribe, Amazon Polly, AWS Lambda (×5), Amazon API Gateway, Amazon DynamoDB, Amazon S3, AWS Amplify, Strands Agents SDK, Amazon CloudWatch, Amazon Cognito

### Impact
- Target: 140 million Indian farmers
- Problem scale: ₹2 lakh crore annual crop loss
- Languages: Hindi, Marathi, Telugu, Tamil, Bengali
- Coverage: All major crops (wheat, rice, cotton, sugarcane, vegetables)

### What We Built on AWS
We built a multi-agent architecture using Amazon Bedrock's Strands SDK. A Lambda orchestrator coordinates 4 specialized agents running in parallel. The disease agent uses both Rekognition (visual labels) and Bedrock Vision (detailed analysis). Real weather data from Open-Meteo is analyzed by Bedrock for crop-specific advice. Live mandi prices come from Agmarknet (data.gov.in) and are compared against MSP 2026. Treatment plans reference CIB&RC approved pesticides with exact dosage.

### What We Learned
This was our first time using Amazon Bedrock's multi-agent architecture and the Strands SDK. We learned how to orchestrate multiple AI agents, combine multimodal inputs (image + voice + text), and deploy a full-stack serverless application on AWS in under 4 days. Building the Amazon Polly pipeline for Hindi TTS was a highlight — hearing our app speak to farmers in their language was deeply rewarding.

### AI Tools Used
- Antigravity IDE (Google) — for code generation and architecture
- Amazon Bedrock (Claude 3.5 Sonnet) — core AI for all agents
- GitHub Copilot — code completion
