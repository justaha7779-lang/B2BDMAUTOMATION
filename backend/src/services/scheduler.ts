import { CronJob } from 'cron';
import { config } from '../utils/config';
import { discoverLeadsForTarget, TargetLocation, QualifiedLead } from './qualification';
import { saveLeadsToDatabase, updateLeadStatus } from './database';
import { appendToGoogleSheets } from './sheets';
import { logger } from '../utils/logger';

export interface SchedulerStats {
  totalScans: number;
  totalLeads: number;
  qualifiedLeads: number;
  lastScanTime: string | null;
  currentTargetIndex: number;
  isRunning: boolean;
}

class LeadScheduler {
  private cronJob: CronJob | null = null;
  private stats: SchedulerStats = {
    totalScans: 0,
    totalLeads: 0,
    qualifiedLeads: 0,
    lastScanTime: null,
    currentTargetIndex: 0,
    isRunning: false,
  };
  private targetQueue: TargetLocation[] = [];

  constructor() {
    this.targetQueue = [...config.targets];
  }

  start(): void {
    if (this.cronJob) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info('Starting autonomous lead generation scheduler');
    logger.info(`CRON schedule: ${config.scheduler.scanInterval}`);

    this.cronJob = new CronJob(
      config.scheduler.scanInterval,
      async () => {
        await this.executeScanCycle();
      },
      null,
      true,
      'America/New_York'
    );

    this.stats.isRunning = true;

    // Execute immediately on startup if autonomous mode is enabled
    if (config.scheduler.autonomousMode) {
      setTimeout(() => this.executeScanCycle(), 5000);
    }
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.stats.isRunning = false;
    logger.info('Scheduler stopped');
  }

  private async executeScanCycle(): Promise<void> {
    try {
      const target = this.targetQueue[this.stats.currentTargetIndex];
      logger.info(`[SCAN START] Target: ${target.niche} in ${target.city}, ${target.state}`);

      // Discover and qualify leads
      const leads = await discoverLeadsForTarget(target);
      const qualifiedLeads = leads.filter(l => l.dm_eligible);

      logger.info(`[SCAN COMPLETE] Found ${leads.length} leads, ${qualifiedLeads.length} qualified`);

      // Save to Supabase database
      await saveLeadsToDatabase(leads);

      // Export qualified leads to Google Sheets
      for (const lead of qualifiedLeads) {
        await appendToGoogleSheets(lead);
      }

      // Update stats
      this.stats.totalScans++;
      this.stats.totalLeads += leads.length;
      this.stats.qualifiedLeads += qualifiedLeads.length;
      this.stats.lastScanTime = new Date().toISOString();
      this.stats.currentTargetIndex = (this.stats.currentTargetIndex + 1) % this.targetQueue.length;

    } catch (error) {
      logger.error('[SCAN ERROR]', error);
    }
  }

  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  async triggerManualScan(): Promise<QualifiedLead[]> {
    const target = this.targetQueue[this.stats.currentTargetIndex];
    const leads = await discoverLeadsForTarget(target);
    const qualifiedLeads = leads.filter(l => l.dm_eligible);

    await saveLeadsToDatabase(leads);

    for (const lead of qualifiedLeads) {
      await appendToGoogleSheets(lead);
    }

    this.stats.totalScans++;
    this.stats.totalLeads += leads.length;
    this.stats.qualifiedLeads += qualifiedLeads.length;
    this.stats.lastScanTime = new Date().toISOString();

    return qualifiedLeads;
  }

  addTarget(target: TargetLocation): void {
    this.targetQueue.push(target);
    logger.info(`Added new target: ${target.niche} in ${target.city}, ${target.state}`);
  }

  getTargets(): TargetLocation[] {
    return [...this.targetQueue];
  }
}

export const scheduler = new LeadScheduler();
