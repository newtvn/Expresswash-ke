# 🚀 ExpressWash Deployment Guide

Complete guide for deploying ExpressWash to production.

---

## 📊 DEPLOYMENT OPTIONS COMPARISON

| Feature | **Vercel** ⭐ | **GitHub Pages** |
|---------|--------------|------------------|
| **Performance** | ⚡ Excellent (Global CDN) | 🟡 Good (GitHub CDN) |
| **Setup Time** | ✅ 5 minutes | 🟡 15 minutes |
| **Automatic Deploys** | ✅ On every push | ✅ On main push |
| **Custom Domain** | ✅ Free SSL | ✅ Free SSL |
| **Environment Variables** | ✅ Easy UI | 🟡 GitHub Secrets |
| **Server Functions** | ✅ Supported | ❌ Not supported |
| **Analytics** | ✅ Built-in | ❌ Need Google Analytics |
| **Preview Deployments** | ✅ Every PR | ❌ No |
| **Rollback** | ✅ One-click | 🟡 Manual |
| **Cost** | ✅ Free (hobby) | ✅ Free |
| **Recommendation** | ⭐ **RECOMMENDED** | ⚠️ Static only |

---

## ⭐ OPTION 1: VERCEL (RECOMMENDED)

**Best for:** Production deployments, teams, professional projects

### Prerequisites
- GitHub account
- Vercel account (free at vercel.com)

### Quick Deploy (5 minutes)

#### Method A: One-Click Deploy (Easiest)

1. **Push to GitHub:**
   ```bash
   git push origin main
   ```

2. **Import to Vercel:**
   - Go to https://vercel.com/new
   - Click "Import Git Repository"
   - Select your `Expresswash-ke` repository
   - Click "Import"

3. **Configure Environment Variables:**
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Deploy:**
   - Click "Deploy"
   - Wait 2-3 minutes
   - Done! 🎉

#### Method B: CLI Deploy

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod

# Follow prompts:
# - Link to existing project or create new? → Create new
# - Project name? → expresswash-ke
# - Directory? → ./
```

### Post-Deployment

1. **Set Environment Variables** (Vercel Dashboard):
   - Go to Project Settings → Environment Variables
   - Add:
     ```
     VITE_SUPABASE_URL
     VITE_SUPABASE_ANON_KEY
     ```

2. **Configure Custom Domain** (Optional):
   - Go to Project Settings → Domains
   - Add your domain: `expresswash.com`
   - Update DNS records as instructed

3. **Enable Automatic Deployments:**
   - Already configured! ✅
   - Every push to `main` auto-deploys

### Vercel Features

- ✅ **Preview Deployments**: Every PR gets unique URL
- ✅ **Instant Rollbacks**: One-click rollback to any deployment
- ✅ **Analytics**: Real-time performance metrics
- ✅ **Edge Network**: 100+ global edge locations
- ✅ **Security Headers**: Applied automatically (from vercel.json)

---

## 🔧 OPTION 2: GITHUB PAGES

**Best for:** Personal projects, static demos, open-source showcases

### Prerequisites
- GitHub repository
- GitHub Pages enabled

### Setup (15 minutes)

#### Step 1: Enable GitHub Pages

1. Go to your GitHub repository
2. Settings → Pages
3. Source: **GitHub Actions**
4. Save

#### Step 2: Add Environment Secrets

1. Settings → Secrets and variables → Actions
2. Add secrets:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

#### Step 3: Deploy

```bash
# Push to main branch (triggers automatic deployment)
git push origin main

# Or manually trigger workflow
# Go to Actions tab → Deploy to GitHub Pages → Run workflow
```

#### Step 4: Access Your Site

Your app will be live at:
```
https://newtvn.github.io/Expresswash-ke/
```

### GitHub Pages Limitations

⚠️ **Important Limitations:**

1. **Static Only**: No server-side rendering
2. **Supabase Edge Functions**: Must stay on Supabase (separate service)
3. **Payment Callbacks**: Use Supabase Functions endpoint
4. **Base Path**: App runs at `/Expresswash-ke/` not root
5. **No Preview Deployments**: Only main branch deploys

### Troubleshooting GitHub Pages

**Issue: Blank page after deployment**
```bash
# Check browser console for errors
# Usually caused by base path issues

# Fix: Ensure VITE_BASE_URL is set correctly
# In workflow: VITE_BASE_URL: /${{ github.event.repository.name }}/
```

**Issue: Routing not working (404 on page refresh)**
```bash
# Already fixed! The 404.html handles SPA routing
# If still broken, check:
# 1. public/404.html exists
# 2. index.html has redirect script
```

---

## 🔐 ENVIRONMENT VARIABLES

### Required Variables

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Analytics
VITE_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

### Where to Set Them

**Vercel:**
- Dashboard → Project → Settings → Environment Variables

**GitHub Pages:**
- Repository → Settings → Secrets → Actions

**Local Development:**
```bash
# Create .env file
cp .env.example .env

# Edit .env with your values
VITE_SUPABASE_URL=your-url
VITE_SUPABASE_ANON_KEY=your-key
```

---

## 📦 SUPABASE EDGE FUNCTIONS DEPLOYMENT

**Important:** Edge Functions must be deployed separately to Supabase.

### Deploy Edge Functions

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Link to your project
supabase link --project-ref your-project-ref

# 4. Set secrets
supabase secrets set BANK_API_BASE_URL=https://api.creditbank.co.ke
supabase secrets set BANK_CONSUMER_KEY=your-key
supabase secrets set BANK_CONSUMER_SECRET=your-secret

# 5. Deploy functions
supabase functions deploy stk-push
supabase functions deploy payment-callback

# 6. Verify deployment
supabase functions list
```

### Edge Function URLs

After deployment, your functions will be at:
```
https://your-project.supabase.co/functions/v1/stk-push
https://your-project.supabase.co/functions/v1/payment-callback
```

---

## 🗄️ DATABASE MIGRATIONS

### Run Migrations

```bash
# 1. Security migration (RLS policies, constraints)
psql -h db.xxxxxxxxxxxxx.supabase.co \
     -U postgres \
     -d postgres \
     -f supabase-migration-security-fixes.sql

# 2. Performance migration (indexes)
psql -h db.xxxxxxxxxxxxx.supabase.co \
     -U postgres \
     -d postgres \
     -f supabase-migration-performance-indexes.sql
```

Or via Supabase Dashboard:
1. Dashboard → SQL Editor
2. Copy contents of migration file
3. Run query

---

## ✅ DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] All code committed and pushed
- [ ] Environment variables configured
- [ ] Supabase project created
- [ ] Database migrations ready
- [ ] Edge Functions tested locally

### Deployment

- [ ] Frontend deployed (Vercel/GitHub Pages)
- [ ] Database migrations run
- [ ] Edge Functions deployed to Supabase
- [ ] Environment secrets set

### Post-Deployment

- [ ] Test user registration
- [ ] Test order creation
- [ ] Test payment flow (with Credit Bank sandbox)
- [ ] Verify email notifications
- [ ] Check error logging (Sentry)
- [ ] Monitor performance (Vercel Analytics)

### Security

- [ ] Security headers applied (check with securityheaders.com)
- [ ] HTTPS enabled
- [ ] RLS policies tested
- [ ] Rate limiting verified
- [ ] No secrets in frontend code

---

## 🔍 VERIFY DEPLOYMENT

### Frontend Tests

```bash
# 1. Check site loads
curl -I https://your-site.vercel.app

# 2. Check security headers
curl -I https://your-site.vercel.app | grep -i "x-frame-options"

# 3. Test API connectivity
# Open browser console on your site:
# Check Network tab for Supabase requests
```

### Backend Tests

```bash
# 1. Test Edge Function
curl -X POST https://your-project.supabase.co/functions/v1/stk-push \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# 2. Check database connection
# Go to Supabase Dashboard → Database → Logs
# Should see connection attempts
```

---

## 📊 MONITORING

### Set Up Monitoring

1. **Vercel Analytics** (Automatic)
   - Dashboard → Analytics
   - View page views, load times

2. **Sentry Error Tracking**
   ```bash
   npm install @sentry/react
   # Configure in src/main.tsx
   ```

3. **Supabase Logs**
   - Dashboard → Logs
   - Monitor database queries
   - Track Edge Function calls

### Key Metrics to Monitor

- **Response Time**: Should be <200ms
- **Error Rate**: Should be <0.1%
- **Cache Hit Rate**: Should be >70%
- **Database Connections**: Should be <80% of limit

---

## 🚨 TROUBLESHOOTING

### Common Issues

**Issue: Site not loading**
```bash
# Check deployment status
vercel ls

# Check logs
vercel logs your-deployment-url
```

**Issue: Supabase connection failing**
```bash
# Verify environment variables
vercel env ls

# Check Supabase URL format
# Should be: https://xxxxx.supabase.co (no trailing slash)
```

**Issue: Payment callback not working**
```bash
# Check Edge Function logs
supabase functions logs payment-callback

# Verify callback URL in Credit Bank dashboard
# Should be: https://your-project.supabase.co/functions/v1/payment-callback
```

---

## 🎯 RECOMMENDED SETUP

For production, we recommend:

1. **Frontend**: Vercel (this guide)
2. **Backend**: Supabase Edge Functions
3. **Database**: Supabase PostgreSQL
4. **Monitoring**: Sentry + Vercel Analytics
5. **Caching**: Upstash Redis (Phase 1 of scalability plan)

**Total Monthly Cost:** ~$100-200 at 10K users

---

## 📚 NEXT STEPS

After deployment:

1. **Set up monitoring** (SCALABILITY_PLAN.md - Phase 1)
2. **Run performance indexes** (`supabase-migration-performance-indexes.sql`)
3. **Configure caching** (Upstash Redis)
4. **Test with Credit Bank sandbox**
5. **Go live!** 🚀

---

## 💡 TIPS

- **Use Vercel** for best experience and performance
- **Set up automatic deployments** for seamless updates
- **Monitor errors** with Sentry from day 1
- **Run migrations** in order (security first, then performance)
- **Test payment flow** thoroughly before going live
- **Keep secrets secure** - never commit them to Git

---

**Need help?** Check the documentation:
- `SECURITY_AUDIT_FIXES.md` - Security setup
- `SCALABILITY_PLAN.md` - Scaling to 10K users
- `CODE_REVIEW_SUMMARY.md` - Code quality analysis

**Happy deploying! 🚀**
