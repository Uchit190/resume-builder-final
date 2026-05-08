# ResumeForge

ResumeForge is a vanilla HTML/CSS/JavaScript resume builder with a secure Node.js backend, MySQL persistence, JWT authentication, and OpenRouter-powered voice resume enrichment.

The frontend remains unchanged in `frontend/`. The backend lives in `backend/` and exposes the same API endpoints used by the existing login, signup, dashboard, resume builders, and voice assistant.

## Structure

```text
resume_builder/
  frontend/
    index.html
    signup.html
    dashboard.html
    technical.html
    non-technical.html
    app.js
    config.js
    voice-assistant.js
    *.css
  backend/
    server.js
    package.json
    .env.example
    sql/
      schema.sql
    src/
      app.js
      config/mysql.js
      controllers/
      middleware/
      routes/
      services/
      utils/
```

## Local Setup

1. Create the MySQL database and tables:

```bash
mysql -u root -p < backend/sql/schema.sql
```

2. Create `backend/.env` from `backend/.env.example`.

3. Use these required database values:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=Resume_builder
DB_PORT=3306
```

4. Install and run the backend:

```bash
cd backend
npm install
npm run dev
```

5. Serve the frontend separately from `frontend/`:

```bash
cd frontend
npx serve . -l 5500
```

6. Open `http://localhost:5500`.

## API Endpoints

```text
GET  /api/health
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
POST /api/resumes
GET  /api/resumes
GET  /api/resumes/latest
POST /api/voice-assistant/enrich
```

## OpenRouter

The backend calls:

```text
https://openrouter.ai/api/v1/chat/completions
```

Default model:

```text
meta-llama/llama-3-8b-instruct:free
```

Set this in `backend/.env`:

```env
OPENROUTER_API_KEY=your-openrouter-api-key
```

If the key is missing or OpenRouter is unavailable, the voice assistant still returns a local fallback summary and ATS skills.

## Mobile Voice Notes

The backend binds to `0.0.0.0`, so LAN access works when your firewall allows the port. Browser microphone and speech recognition are most reliable on `localhost` or HTTPS. For mobile voice testing, use the Vercel HTTPS frontend URL or an HTTPS tunnel.
