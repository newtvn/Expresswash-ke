#!/bin/bash
# Deploy ExpressWash to Vercel (Recommended)

echo "🚀 Deploying ExpressWash to Vercel..."
echo ""
echo "Prerequisites:"
echo "1. Install Vercel CLI: npm install -g vercel"
echo "2. Login to Vercel: vercel login"
echo ""

# Install Vercel CLI if not installed
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

echo "Step 1: Login to Vercel"
vercel login

echo ""
echo "Step 2: Deploy to production"
echo "This will:"
echo "  - Build your application"
echo "  - Deploy to Vercel's edge network"
echo "  - Apply security headers automatically"
echo "  - Set up automatic deployments"
echo ""

# Deploy to production
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Your app is now live at: https://your-app.vercel.app"
echo ""
echo "Next steps:"
echo "1. Add environment variables in Vercel dashboard"
echo "2. Connect your GitHub repo for automatic deployments"
echo "3. Configure custom domain (optional)"
