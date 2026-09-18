# 🌾 KrishiMitra AI — AWS-Powered Multimodal Farm Advisory System

> **WeMakeDevs × AWS First Commit Hackathon 2026 | Team Avengers**

[![AWS](https://img.shields.io/badge/AWS-12%20Services-FF9900?style=for-the-badge&logo=amazon-aws)](https://aws.amazon.com)
[![Bedrock](https://img.shields.io/badge/Amazon%20Bedrock-Claude%203.5-7C3AED?style=for-the-badge)](https://aws.amazon.com/bedrock)
[![Live](https://img.shields.io/badge/Live%20Demo-amplifyapp.com-22c55e?style=for-the-badge)](https://krishimitra.amplifyapp.com)

---

## 🎯 The Problem

**₹2 lakh crore** — that's how much India loses annually to crop disease.

140 million Indian farmers lose 15–40% of their yield every year because:
- 75% of doctors are in cities; agronomists even rarer in villages
- Crop disease information exists only in English
- By the time a farmer reaches a KVK or expert, the disease has spread
- No single tool combines disease detection + treatment + market price + weather

**KrishiMitra AI** solves all four — instantly, in your language, from your phone.

---

## 🚀 Live Demo

🔗 **[https://krishimitra.amplifyapp.com](https://krishimitra.amplifyapp.com)**

📹 **[Demo Video (3 min)](https://youtu.be/your-video-id)**

---

## 🤖 How It Works

A farmer photographs a diseased leaf → speaks in Hindi → gets instant advisory in their language.

```
📸 Crop Photo + 🎤 Voice Query (Hindi/Marathi/Telugu/Tamil/Bengali)
                    ↓
          [API Gateway → Lambda Orchestrator]
                    ↓
    ┌───────────────────────────────────────┐
    │      Amazon Bedrock Multi-Agent       │
    │  ┌──────────┐  ┌──────────────────┐  │
    │  │ Disease  │  │ Weather Advisory │  │
    │  │  Agent   │  │     Agent        │  │
    │  │Rekognition│  │  Open-Meteo API  │  │
    │  └──────────┘  └──────────────────┘  │
    │  ┌──────────┐  ┌──────────────────┐  │
    │  │  Market  │  │    Treatment     │  │
    │  │  Price   │  │    Recommend.    │  │
    │  │  Agent   │  │     Agent        │  │
    │  └──────────┘  └──────────────────┘  │
    │          ↓ Supervisor Agent ↓        │
    └───────────────────────────────────────┘
                    ↓
    🔊 Amazon Polly → Voice advisory in farmer's language
    💾 Amazon DynamoDB → Saved to farmer's history
```

---

## ☁️ AWS Services Used (12 Services)

| # | Service | Purpose |
|---|---------|---------|
| 1 | **Amazon Bedrock** (Claude 3.5 Sonnet) | Multi-agent AI reasoning, disease analysis, advisory |
| 2 | **AWS Rekognition** | Crop image label detection, disease visual analysis |
| 3 | **Amazon Transcribe** | Voice-to-text in Hindi, Marathi, Telugu, Tamil, Bengali |
| 4 | **Amazon Polly** | Text-to-speech advisory in Indian languages |
| 5 | **AWS Lambda** | 5 serverless functions (orchestrator + 4 agents) |
| 6 | **Amazon API Gateway** | REST API with CORS for frontend |
| 7 | **Amazon DynamoDB** | Farmer profiles, consultation history |
| 8 | **Amazon S3** | Crop image storage, audio file storage |
| 9 | **AWS Amplify** | Frontend deployment with live URL |
| 10 | **Strands Agents SDK** | Multi-agent orchestration framework |
| 11 | **Amazon CloudWatch** | Logging, monitoring all 5 Lambda functions |
| 12 | **Amazon Cognito** | Farmer authentication (optional) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS Cloud Architecture                    │
│                                                             │
│  [Farmer Mobile/Web]                                        │
│         ↓ HTTPS                                             │
│  [AWS Amplify - React Frontend]                             │
│         ↓                                                   │
│  [API Gateway] ──────────────────────────────────────────  │
│         ↓                           ↑ Response              │
│  [Lambda Orchestrator]                                      │
│    ├── [S3] ← Store crop image                             │
│    ├── [Rekognition] → Disease labels                      │
│    ├── [Transcribe] → Voice → Text                         │
│    ├── [Bedrock Agents]                                    │
│    │     ├── Disease Agent (Rekognition + Claude Vision)   │
│    │     ├── Weather Agent (Open-Meteo + Claude)           │
│    │     ├── Market Agent (Agmarknet + Claude)             │
│    │     ├── Treatment Agent (Claude + Pesticide DB)       │
│    │     └── Supervisor Agent (Synthesis)                  │
│    ├── [DynamoDB] ← Save consultation                      │
│    └── [Polly] → Audio response MP3                        │
│                                                             │
│  [CloudWatch] ← All Lambda logs + metrics                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌍 Features

- 📸 **Photo-based Disease Detection** — Upload/click crop photo → AI identifies disease name, severity, affected parts
- 🎤 **Voice Input (5 languages)** — Hindi, Marathi, Telugu, Tamil, Bengali via Amazon Transcribe
- 🔊 **Voice Advisory Output** — Amazon Polly speaks back the advisory in farmer's language
- 🤖 **4 Specialized AI Agents** — Disease, Weather, Market, Treatment work in parallel
- 💰 **Live Mandi Prices** — Real Agmarknet data + MSP 2026 comparison
- 🌦️ **7-Day Weather Forecast** — Crop-specific spray/irrigation recommendations
- 💊 **Treatment Plans** — Both organic (neem oil) and chemical (India-approved pesticides)
- 📋 **Consultation History** — All past diagnoses saved in DynamoDB
- 📱 **Mobile-First UI** — Works on any smartphone, camera capture supported
- 🌐 **Multilingual** — Full support for 5+ Indian languages

---

## 🛠️ Setup & Deployment

### Prerequisites
- AWS Account with Bedrock access (Claude 3.5 Sonnet enabled)
- AWS CLI configured
- SAM CLI installed
- Node.js 18+
- Python 3.12+

### 1. Clone and Setup
```bash
git clone https://github.com/your-team/krishimitra-ai
cd krishimitra-ai
```

### 2. Deploy Backend (AWS SAM)
```bash
cd backend/infrastructure

# Build all Lambda functions
sam build

# Deploy to AWS (interactive first time)
sam deploy --guided --stack-name krishimitra-ai --region us-east-1

# Note the API URL from output
```

### 3. Configure Frontend
```bash
cd ../../frontend

# Set your API URL
echo "REACT_APP_API_URL=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod" > .env

# Install dependencies
npm install

# Start development server
npm start
```

### 4. Deploy Frontend to AWS Amplify
```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize and deploy
amplify init
amplify add hosting
amplify publish
```

---

## 📁 Project Structure

```
krishimitra-ai/
├── frontend/                        # React Application
│   ├── public/index.html
│   └── src/
│       ├── App.jsx                  # Main app with all features
│       ├── index.css                # Premium design system
│       └── index.js
├── backend/
│   ├── infrastructure/
│   │   └── template.yaml            # AWS SAM template (12 services)
│   └── lambda/
│       ├── orchestrator/
│       │   ├── handler.py           # Main orchestrator (4 agents)
│       │   └── voice_handler.py     # Transcribe + Polly pipeline
│       ├── disease_agent/
│       │   └── handler.py           # Rekognition + Bedrock Vision
│       ├── treatment_agent/
│       │   └── handler.py           # Treatment with pesticide registry
│       ├── market_agent/
│       │   └── handler.py           # Agmarknet + MSP prices
│       └── weather_agent/
│           └── handler.py           # Open-Meteo + Bedrock advisory
└── README.md
```

---

## 🧠 AI Agents Detail

### Agent 1: Disease Detection Agent
- **AWS Rekognition**: Detects 25 visual labels (Plant, Leaf, Disease, etc.)
- **Bedrock Claude 3.5 Vision**: Deep analysis of image with crop context
- **Output**: Disease name (English + Hindi), severity, affected parts, confidence score

### Agent 2: Weather Advisory Agent
- **Open-Meteo API**: Real 7-day forecast (temperature, rainfall, UV, wind)
- **Bedrock Claude**: Crop-specific spray/irrigation advice
- **Output**: Spray-suitable days, disease risk from weather, farm activities

### Agent 3: Market Price Agent
- **Agmarknet API (data.gov.in)**: Real mandi prices
- **MSP 2026 Database**: Compare with government minimum support price
- **Bedrock Claude**: Market intelligence, holding advice
- **Output**: Current price, trend, best selling time, nearby mandis

### Agent 4: Treatment Agent
- **India Pesticide Registry**: 10+ CIB&RC approved pesticides with dosage
- **Organic Remedies Database**: Neem oil, Bordeaux mix, NSKE recipes
- **Bedrock Claude**: Integrated treatment plan
- **Output**: Organic + chemical treatment, cost per acre, urgency

### Supervisor Agent (Amazon Bedrock)
- Synthesizes all 4 agent outputs
- Generates final advisory in farmer's language
- Passes to Amazon Polly for voice output

---

## 📊 Impact

| Metric | Data |
|--------|------|
| Target Users | 140M Indian farmers |
| Annual Crop Loss Addressable | ₹2 Lakh Crore |
| Languages Supported | 5 Indian languages |
| AWS Services Integrated | 12 |
| AI Agents | 4 + 1 Supervisor |
| Response Time | <5 seconds |

---

## 👥 Team Avengers

| Member | Role |
|--------|------|
| **Shivam Pal** | Team Lead, Frontend, Demo |
| **Sudhanshu Rai** | Backend, Bedrock Agents |
| **Ashish Singh** | Rekognition, Transcribe, Polly |
| **Reddy Eswar Anush** | DynamoDB, API Gateway, SAM |

---

## 📝 What We Learned

1. **Amazon Bedrock Strands SDK** — First time using multi-agent architecture; learned supervisor-agent pattern
2. **Multimodal AI** — Combining vision (Rekognition + Bedrock Vision) with text and voice in one pipeline
3. **AWS SAM** — Infrastructure-as-code for rapid serverless deployment
4. **Amazon Polly Neural Voices** — Hindi TTS with Aditi neural voice
5. **Serverless Architecture** — 5 Lambda functions orchestrated without managing any servers

---

## 🏆 Hackathon

**Event**: WeMakeDevs × AWS First Commit — Bharat Builds Tour
**Track**: Ship It (Deployed with live URL)
**Theme**: Build something that solves a real problem

---

*Built with ❤️ for 140 million Indian farmers | Powered by AWS*
