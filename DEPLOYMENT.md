# ExpressWash Deployment Guide

## Quick Deploy to Vercel (CLI Method)

### Prerequisites
```bash
npm install -g vercel
vercel login
```

### Deploy Production
```bash
# 1. Build locally to test
npm run build
npm run preview

# 2. Deploy to Vercel
vercel --prod

# 3. Add environment variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_APP_NAME
vercel env add VITE_APP_VERSION
vercel env add VITE_SESSION_TIMEOUT_MINUTES
vercel env add VITE_USE_MOCK_DATA

# 4. Redeploy with environment variables
vercel --prod
```

### Environment Variables Required

**CRITICAL (Required for app to work):**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `VITE_USE_MOCK_DATA` - Set to `false` (use real Supabase data)

**Optional (Enhanced Features):**
- `VITE_GOOGLE_MAPS_API_KEY` - For driver route visualization
- `VITE_MPESA_SHORTCODE` - For M-Pesa payments (sandbox: 174379)
- `VITE_MPESA_ENV` - sandbox or production
- `VITE_AT_USERNAME` - Africa's Talking SMS username
- `VITE_AT_ENV` - sandbox or production

**App Configuration:**
- `VITE_APP_NAME` - ExpressWash
- `VITE_APP_VERSION` - 1.0.0
- `VITE_SESSION_TIMEOUT_MINUTES` - 30

---

## Alternative Deployment Platforms

### Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod

# Build settings:
# Build command: npm run build
# Publish directory: dist
```

### Cloudflare Pages
```bash
# Build settings:
# Framework preset: Vite
# Build command: npm run build
# Build output directory: dist
```

### AWS Amplify
```bash
# Build settings:
# Build command: npm run build
# Base directory: /
# Output directory: dist
```

### Railway
```bash
# railway.json (create this file)
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run preview",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## Post-Deployment Checklist

### 1. Test Core Functionality
- [ ] Visit production URL
- [ ] Sign up a new account
- [ ] Log in/out
- [ ] Place a test order
- [ ] Check order tracking
- [ ] Test customer dashboard
- [ ] Test admin login (use seed data credentials)
- [ ] Verify all pages load

### 2. Configure Production Services

**M-Pesa Integration (if needed):**
```bash
# 1. Sign up: https://developer.safaricom.co.ke/
# 2. Create app (Get consumer key & secret)
# 3. Set environment variables:
VITE_MPESA_SHORTCODE=your-shortcode
VITE_MPESA_ENV=production
# Note: Consumer key/secret should be server-side only!
```

**Africa's Talking SMS (if needed):**
```bash
# 1. Sign up: https://africastalking.com/
# 2. Get API key
# 3. Set environment variables:
VITE_AT_USERNAME=your-username
VITE_AT_ENV=production
# Note: API key should be server-side only!
```

**Google Maps (if needed):**
```bash
# 1. Go to: https://console.cloud.google.com/
# 2. Enable APIs: Maps JavaScript API, Geocoding API
# 3. Create API key with HTTP referrer restrictions
# 4. Set: VITE_GOOGLE_MAPS_API_KEY=your-key
```

### 3. Security Hardening

**Supabase RLS Policies:**
```sql
-- Verify RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
-- All should show 't' (true)
```

**API Key Restrictions:**
```bash
# In Supabase → Settings → API:
# ✅ Enable RLS on all tables
# ✅ Use anon key for frontend only
# ✅ Never expose service_role key
```

**Environment Variables:**
```bash
# Never commit .env to git!
# Verify .env is in .gitignore
grep -q "^\.env$" .gitignore && echo "✅ Safe" || echo "⚠️ Add .env to .gitignore"
```

### 4. Setup Custom Domain (Optional)

**Vercel:**
```bash
# 1. Go to: Project Settings → Domains
# 2. Add: expresswash.co.ke (or your domain)
# 3. Configure DNS:
#    - Type: A
#    - Name: @
#    - Value: 76.76.21.21
#
#    - Type: CNAME
#    - Name: www
#    - Value: cname.vercel-dns.com
```

### 5. Enable Monitoring

**Vercel Analytics (Free):**
```bash
# In Vercel Dashboard:
# Analytics → Enable Analytics (free tier)
```

**Sentry Error Monitoring (Optional):**
```bash
# 1. Sign up: https://sentry.io/
# 2. Create project
# 3. Get DSN
# 4. Follow: docs/SENTRY_SETUP.md
```

### 6. Performance Optimization

**Enable Compression:**
```bash
# Already configured in vercel.json
# Vercel automatically compresses assets
```

**Image Optimization:**
```bash
# Use Supabase Storage for images:
# Storage → Create bucket "images"
# Enable: Public bucket
# Use: supabase.getPublicUrl() in code
```

### 7. Backup Strategy

**Database Backups:**
```bash
# Supabase automatic backups:
# Free tier: Daily backups (7-day retention)
# Pro tier: Point-in-time recovery

# Manual backup:
# Dashboard → Database → Backups → Download
```

---

## Troubleshooting

### Build Fails
```bash
# Check Node version
node --version  # Should be 18.x or 20.x

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Environment Variables Not Working
```bash
# Vercel: Must start with VITE_
# Redeploy after adding env vars:
vercel --prod

# Check in browser console:
# Variables should NOT show "undefined"
```

### Supabase Connection Fails
```bash
# Test connection:
curl https://your-project.supabase.co/rest/v1/

# Check:
# 1. URL is correct (ends with .supabase.co)
# 2. Anon key is correct (starts with eyJhbGc)
# 3. RLS policies are set up
```

### Routes Not Working (404 on refresh)
```bash
# Ensure vercel.json has rewrites:
{
  "rewrites": [
    { "source": "/((?!assets/).*)", "destination": "/index.html" }
  ]
}
# Already configured! ✅
```

---

## Cost Estimation

### Free Tier (Sufficient for MVP)
- **Vercel:** Free (100GB bandwidth, 100 builds/day)
- **Supabase:** Free (500MB database, 50,000 monthly active users)
- **Total:** $0/month

### Production Tier (Growing Business)
- **Vercel Pro:** $20/month (unlimited bandwidth)
- **Supabase Pro:** $25/month (8GB database, 100k MAU)
- **Africa's Talking SMS:** ~$0.01/SMS (pay as you go)
- **M-Pesa:** Transaction fees (handled by Safaricom)
- **Google Maps API:** $0-$200/month (based on usage)
- **Total:** ~$45-$250/month

---

## Support & Resources

- **Vercel Docs:** https://vercel.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **M-Pesa API:** https://developer.safaricom.co.ke/docs
- **Africa's Talking:** https://developers.africastalking.com/
- **Project Issues:** https://github.com/newtvn/Expresswash-ke/issues

---

## Quick Commands Reference

```bash
# Local Development
npm run dev              # Start dev server (localhost:8080)
npm run build            # Production build
npm run preview          # Preview production build
npm run lint             # Run ESLint
npm test                 # Run tests

# Deployment
vercel                   # Deploy to preview
vercel --prod            # Deploy to production
vercel env ls            # List environment variables
vercel logs              # View production logs

# Git Operations
git status               # Check changes
git add .                # Stage changes
git commit -m "message"  # Commit
git push origin main     # Push to GitHub
```

---

## Success Checklist

After deployment, verify:
- [ ] App loads at production URL
- [ ] User signup/login works
- [ ] Orders can be created
- [ ] Admin dashboard accessible
- [ ] All API calls succeed (check Network tab)
- [ ] No console errors
- [ ] Mobile responsive works
- [ ] Pages load quickly (<3 seconds)
- [ ] SSL certificate active (https://)
- [ ] Custom domain configured (if applicable)

**Your app is now live!** 🚀
