import express, { Express, Request, Response } from 'express';
import { config, validateConfig } from './utils/config';
import { logger } from './utils/logger';
import { scheduler } from './services/scheduler';
import { databaseService } from './services/database';
import { TargetLocation } from './services/qualification';

const app: Express = express();

app.use(express.json());

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  const stats = scheduler.getStats();
  const dbStatus = config.supabase.url ? 'connected' : 'not configured';

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    scheduler: {
      running: stats.isRunning,
      totalScans: stats.totalScans,
      totalLeads: stats.totalLeads,
      lastScan: stats.lastScanTime,
    },
    database: dbStatus,
  });
});

// Get scheduler stats
app.get('/api/stats', async (_req: Request, res: Response) => {
  const schedulerStats = scheduler.getStats();
  const dbStats = await databaseService.getStats();

  res.json({
    ...schedulerStats,
    ...dbStats,
    targets: scheduler.getTargets(),
    currentTargetIndex: schedulerStats.currentTargetIndex,
  });
});

// Get recent leads
app.get('/api/leads', async (_req: Request, res: Response) => {
  const leads = await databaseService.getRecentLeads(100);
  res.json(leads);
});

// Trigger manual scan
app.post('/api/scan', async (_req: Request, res: Response) => {
  try {
    logger.info('Manual scan triggered via API');
    const qualifiedLeads = await scheduler.triggerManualScan();
    res.json({
      success: true,
      leadsFound: qualifiedLeads.length,
      leads: qualifiedLeads,
    });
  } catch (err) {
    logger.error('Manual scan failed:', err);
    res.status(500).json({
      success: false,
      error: 'Scan failed',
    });
  }
});

// Start/stop scheduler
app.post('/api/scheduler/toggle', (req: Request, res: Response) => {
  const stats = scheduler.getStats();

  if (stats.isRunning) {
    scheduler.stop();
    res.json({ status: 'stopped', running: false });
  } else {
    scheduler.start();
    res.json({ status: 'started', running: true });
  }
});

// Add new target location
app.post('/api/targets', (req: Request, res: Response) => {
  const target = req.body as TargetLocation;

  if (!target.city || !target.state || !target.niche) {
    return res.status(400).json({
      error: 'Missing required fields: city, state, niche',
    });
  }

  scheduler.addTarget(target);
  res.json({ success: true, target });
});

// Get current targets
app.get('/api/targets', (_req: Request, res: Response) => {
  res.json(scheduler.getTargets());
});

// Index route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'B2B Prospecting Backend',
    version: '1.0.0',
    endpoints: [
      'GET /health',
      'GET /api/stats',
      'GET /api/leads',
      'POST /api/scan',
      'POST /api/scheduler/toggle',
      'GET /api/targets',
      'POST /api/targets',
    ],
  });
});

// Start server
export function startServer(): void {
  validateConfig();

  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);

    // Start autonomous scheduler if enabled
    if (config.scheduler.autonomousMode) {
      logger.info('Autonomous mode enabled - starting scheduler');
      scheduler.start();
    } else {
      logger.info('Autonomous mode disabled - use API to trigger scans');
    }
  });
}

startServer();
