#!/bin/bash

# Quick script to set Vercel environment variables
# You need a Vercel token from: https://vercel.com/account/tokens

echo "🚀 Setting Vercel Environment Variables"
echo ""

# Check if VERCEL_TOKEN is set
if [ -z "$VERCEL_TOKEN" ]; then
    echo "❌ ERROR: VERCEL_TOKEN not found"
    echo ""
    echo "Please run:"
    echo "  export VERCEL_TOKEN='your-token-here'"
    echo ""
    echo "Get your token from: https://vercel.com/account/tokens"
    exit 1
fi

# Get project info
PROJECT_NAME="expresswash"
TEAM_ID=""  # Leave empty if personal account

# Set the environment variables
echo "📝 Setting VITE_SUPABASE_URL..."
curl -X POST "https://api.vercel.com/v10/projects/${PROJECT_NAME}/env" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "VITE_SUPABASE_URL",
    "value": "https://airzodpllaouvntzqki.supabase.co",
    "type": "plain",
    "target": ["production", "preview", "development"]
  }'

echo ""
echo "📝 Setting VITE_SUPABASE_ANON_KEY..."
curl -X POST "https://api.vercel.com/v10/projects/${PROJECT_NAME}/env" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "VITE_SUPABASE_ANON_KEY",
    "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpcnpvZHBsbGFvZXV2bnR6cWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2OTgyODgsImV4cCI6MjA4NjI3NDI4OH0.QwImNUC7TxnN7h305fZHQYCgUg2slEPWMKL2XU9RzeI",
    "type": "plain",
    "target": ["production", "preview", "development"]
  }'

echo ""
echo "✅ Done! Now redeploy your project on Vercel dashboard"
