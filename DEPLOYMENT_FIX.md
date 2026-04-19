# Cloud Run Deployment - Fixed Files

## What Was Wrong
- Your app runs on **Node.js** (Express), not Python
- Cloud Run couldn't find the correct Dockerfile
- Server was hardcoded to port 3000; Cloud Run requires port 8080

## What I Fixed
1. ✅ Created `Dockerfile` - Multi-stage build for Node.js
2. ✅ Updated `server.ts` - Changed port to 8080 (reads from `PORT` env var)
3. ✅ Created `.dockerignore` - Excludes unnecessary files from build

## Next Steps

### 1. Push these changes to GitHub
```bash
git add Dockerfile .dockerignore server.ts
git commit -m "Add Cloud Run Dockerfile and fix port configuration"
git push origin main
```

### 2. Re-deploy on Cloud Run
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Navigate to **Cloud Run**
- Click your service → **Edit and deploy new revision**
- Source: **GitHub** (select your repo)
- Select latest commit
- Let Cloud Run auto-detect and build using the Dockerfile
- **Deploy** ✅

### 3. Set Environment Variables (If Needed)
If your app needs `GEMINI_API_KEY` or other secrets:
1. In Cloud Run service settings → **Variables & Secrets**
2. Add secret: `GEMINI_API_KEY` = your key
3. Reference it in deployment: `--update-secrets GEMINI_API_KEY=projects/YOUR_PROJECT/secrets/GEMINI_API_KEY:latest`

## Build Details
- **Base image**: node:18-alpine (small, fast)
- **Build output**: dist/server.cjs (bundled server)
- **Start command**: `node dist/server.cjs`
- **Port**: 8080 (required by Cloud Run)

Your app should now deploy successfully! 🚀
