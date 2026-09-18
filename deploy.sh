#!/bin/bash
# ═══════════════════════════════════════════════════════════
# KrishiMitra AI — One-Click Deployment Script
# WeMakeDevs × AWS First Commit Hackathon
# ═══════════════════════════════════════════════════════════

set -e
echo ""
echo "🌾 ═══════════════════════════════════════════════════"
echo "   KrishiMitra AI — AWS Deployment Script"
echo "   WeMakeDevs × AWS First Commit Hackathon"
echo "═══════════════════════════════════════════════════════"
echo ""

# Check prerequisites
command -v aws  >/dev/null 2>&1 || { echo "❌ AWS CLI not found. Install: https://aws.amazon.com/cli/"; exit 1; }
command -v sam  >/dev/null 2>&1 || { echo "❌ SAM CLI not found. Install: pip install aws-sam-cli"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found. Install: https://nodejs.org/"; exit 1; }

echo "✅ All prerequisites found"
echo ""

# Variables
STACK_NAME="krishimitra-ai"
REGION=${1:-"us-east-1"}
S3_DEPLOY_BUCKET="krishimitra-deploy-$(aws sts get-caller-identity --query Account --output text)"

echo "📋 Deployment Config:"
echo "   Stack Name: $STACK_NAME"
echo "   Region: $REGION"
echo ""

# Create S3 deployment bucket if not exists
echo "📦 Setting up deployment bucket..."
aws s3 mb "s3://$S3_DEPLOY_BUCKET" --region $REGION 2>/dev/null || echo "   Bucket already exists"

# Deploy Backend
echo ""
echo "🚀 Deploying Backend (AWS SAM)..."
cd backend/infrastructure

sam build --use-container 2>/dev/null || sam build

sam deploy \
  --stack-name $STACK_NAME \
  --region $REGION \
  --s3-bucket $S3_DEPLOY_BUCKET \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    Environment=prod \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

echo ""
echo "📤 Fetching API URL..."
API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

echo "✅ API deployed: $API_URL"

# Deploy Frontend
echo ""
echo "⚛️  Building React Frontend..."
cd ../../frontend

echo "REACT_APP_API_URL=$API_URL" > .env
echo "REACT_APP_REGION=$REGION" >> .env

npm install --silent
npm run build

echo ""
echo "🚀 Deploying to AWS Amplify..."
# Create Amplify app
APP_ID=$(aws amplify create-app \
  --name "krishimitra-ai" \
  --region $REGION \
  --query 'app.appId' \
  --output text 2>/dev/null || echo "existing")

if [ "$APP_ID" != "existing" ]; then
  aws amplify create-branch \
    --app-id $APP_ID \
    --branch-name main \
    --region $REGION > /dev/null
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "🎉 KrishiMitra AI Deployed Successfully!"
echo ""
echo "  🌐 API URL: $API_URL"
echo "  📱 Frontend: npm start (for local) or check Amplify"
echo "  📊 CloudWatch: https://console.aws.amazon.com/cloudwatch"
echo ""
echo "  Next Steps:"
echo "  1. Copy the API URL above"
echo "  2. Update frontend/.env with REACT_APP_API_URL"
echo "  3. Run: npm start (to test locally)"
echo "  4. Deploy frontend to Amplify for live URL"
echo ""
echo "  🏆 Good luck at the hackathon! — Team Avengers"
echo "═══════════════════════════════════════════════════════"
