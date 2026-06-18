# B2B Prospecting Backend

Autonomous lead generation and qualification engine that runs 24/7 on cloud infrastructure.

## Features

- **24/7 Autonomous Operation**: CRON-based scheduling (default: every 4 hours)
- **3-Criteria Lead Qualification**:
  1. Contact form present on website
  2. No live chat widget detected
  3. Facebook Messenger button active
- **Supabase Integration**: Persistent lead storage
- **Google Sheets Export**: Webhook-based spreadsheet sync (Make/Zapier)

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure your environment variables
# Then run in development mode
npm run dev
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3000) |
| `NODE_ENV` | Environment | No |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | No |
| `GOOGLE_SHEETS_WEBHOOK_URL` | Make/Zapier webhook URL | No |
| `SCAN_INTERVAL_CRON` | CRON schedule | No (default: `0 */4 * * *`) |
| `AUTONOMOUS_MODE` | Start scheduler on boot | No (default: false) |
| `LOG_LEVEL` | Logging verbosity | No (default: info) |

## Deployment

### Render

1. Connect your repository to Render
2. Select "Docker" as the environment
3. Set the Dockerfile path: `backend/Dockerfile`
4. Add environment variables in the dashboard
5. Deploy

### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init

# Link to project
railway link

# Set environment variables
railway variables set SUPABASE_URL=your_url
railway variables set SUPABASE_ANON_KEY=your_key

# Deploy
railway up
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/stats` | GET | Scheduler & database stats |
| `/api/leads` | GET | Recent leads (last 100) |
| `/api/scan` | POST | Trigger manual scan |
| `/api/scheduler/toggle` | POST | Start/stop scheduler |
| `/api/targets` | GET | List target locations |
| `/api/targets` | POST | Add new target |

## Integrating with Make/Zapier for Google Sheets

1. Create a new Make/Zapier scenario
2. Add a webhook trigger
3. Copy the webhook URL
4. Set `GOOGLE_SHEETS_WEBHOOK_URL` environment variable
5. Configure the scenario to:
   - Receive: `companyName`, `dmLink`, `outreachScript`, `status`
   - Action: Append row to Google Sheets

## License

MIT
