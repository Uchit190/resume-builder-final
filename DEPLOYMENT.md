# ResumeForge Deployment Guide

This version uses:

```text
Frontend: Netlify or Vercel
Backend: Render
Database: MySQL
AI: OpenRouter
```

## MySQL Setup

Run the schema:

```bash
mysql -u root -p < backend/sql/schema.sql
```

For production, use a hosted MySQL provider and run the same SQL file there.

## Render Backend

Render service settings:

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

Render environment variables:

```env
NODE_ENV=production
HOST=0.0.0.0
DB_HOST=your-mysql-host
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
DB_NAME=Resume_builder
DB_PORT=3306
JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
FRONTEND_URL=https://your-vercel-app.vercel.app
CORS_ORIGIN=https://your-vercel-app.vercel.app
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=meta-llama/llama-3-8b-instruct:free
```

Render provides `PORT` automatically. The backend uses `process.env.PORT`.

Health check:

```text
https://your-render-service.onrender.com/api/health
```

## Netlify Frontend

Netlify settings:

```text
Base directory: frontend
Build command: leave empty
Publish directory: frontend
```

The repository includes:

```text
netlify.toml
frontend/_redirects
```

These files make clean routes such as `/dashboard`, `/technical`, and `/non-technical` load the matching HTML files.

Set your Render API URL in:

```text
frontend/config.js
```

Example:

```js
window.RESUMEFORGE_API_BASE = 'https://your-render-service.onrender.com';
```

## Vercel Frontend

Vercel settings:

```text
Framework Preset: Other
Root Directory: frontend
Build Command: leave empty
Output Directory: .
Install Command: leave empty
```

Set your Render API URL in:

```text
frontend/config.js
```

Example:

```js
window.RESUMEFORGE_API_BASE = 'https://your-render-service.onrender.com';
```

## Production Checklist

```text
MySQL schema created
Render backend deployed
/api/health returns ok
Netlify or Vercel frontend deployed over HTTPS
frontend/config.js points to Render URL
CORS_ORIGIN includes frontend HTTPS URL
Signup works
Login works
Dashboard loads
/dashboard clean route loads
/technical clean route loads
/non-technical clean route loads
Technical resume saves and reloads
Non-technical resume saves and reloads
Voice assistant enrich endpoint works
Voice assistant microphone tested on HTTPS in Android Chrome
```
