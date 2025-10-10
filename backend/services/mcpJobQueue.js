const { randomUUID } = require('crypto');

const { runMcpJob } = require('./mcpJobRunner');

const jobs = new Map();
const cleanupTimers = new Map();

const DEFAULT_RETENTION_MS = 30 * 60 * 1000; // 30 minutes
const JOB_RETENTION_MS = Number.parseInt(process.env.MCP_JOB_RETENTION_MS || `${DEFAULT_RETENTION_MS}`, 10);

function safeClone(value) {
  if (value === undefined || value === null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return value;
  }
}

function serializeEngine(engine) {
  return {
    id: engine.id,
    label: engine.label,
    category: engine.category,
    status: engine.status,
    cancelRequested: engine.cancelRequested,
    startedAt: engine.startedAt ? new Date(engine.startedAt).toISOString() : null,
    completedAt: engine.completedAt ? new Date(engine.completedAt).toISOString() : null,
    durationMs: engine.durationMs || 0,
    output: engine.output ? safeClone(engine.output) : null,
    error: engine.error || '',
    input: engine.input ? safeClone(engine.input) : {},
    media: Array.isArray(engine.media) ? safeClone(engine.media) : [],
    mediaAssignments: Array.isArray(engine.mediaAssignments) ? safeClone(engine.mediaAssignments) : []
  };
}

function sanitizeJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    prompt: job.prompt,
    filePrefix: job.filePrefix,
    status: job.status,
    cancelRequested: job.cancelRequested,
    createdAt: new Date(job.createdAt).toISOString(),
    completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : null,
    engines: job.engines.map(serializeEngine)
  };
}

function updateJobStatus(job) {
  if (!job) return;
  const engineStatuses = job.engines.map((engine) => engine.status);
  if (engineStatuses.every((status) => status === 'pending')) {
    job.status = job.cancelRequested ? 'cancelling' : 'pending';
    return;
  }
  if (engineStatuses.some((status) => status === 'running')) {
    job.status = job.cancelRequested ? 'cancelling' : 'running';
    return;
  }
  if (engineStatuses.every((status) => status === 'completed')) {
    job.status = 'completed';
    return;
  }
  if (engineStatuses.some((status) => status === 'failed')) {
    job.status = job.cancelRequested && engineStatuses.every((status) => status === 'failed' || status === 'cancelled')
      ? 'cancelled'
      : 'failed';
    return;
  }
  if (engineStatuses.every((status) => status === 'cancelled')) {
    job.status = 'cancelled';
    return;
  }
  job.status = job.cancelRequested ? 'cancelling' : 'running';
}

function scheduleCleanup(jobId) {
  if (cleanupTimers.has(jobId)) return;
  const timer = setTimeout(() => {
    cleanupTimers.delete(jobId);
    const job = jobs.get(jobId);
    if (!job) return;
    if (job.completedAt && Date.now() - job.completedAt >= JOB_RETENTION_MS) {
      jobs.delete(jobId);
    } else {
      scheduleCleanup(jobId);
    }
  }, JOB_RETENTION_MS);
  cleanupTimers.set(jobId, timer);
}

async function runEngine(job, engine) {
  if (engine.cancelRequested || job.cancelRequested) {
    engine.status = 'cancelled';
    engine.startedAt = engine.startedAt || Date.now();
    engine.completedAt = engine.completedAt || engine.startedAt;
    engine.durationMs = engine.completedAt - engine.startedAt;
    updateJobStatus(job);
    return;
  }

  engine.status = 'running';
  engine.startedAt = Date.now();
  updateJobStatus(job);

  try {
    const result = await runMcpJob({
      serverId: engine.id,
      input: engine.input,
      prompt: job.prompt,
      label: engine.label,
      filePrefix: job.filePrefix,
      media: engine.media,
      mediaCache: job.mediaCache,
      cancellationSignal: () => engine.cancelRequested || job.cancelRequested
    });
    engine.completedAt = Date.now();
    engine.durationMs = engine.completedAt - engine.startedAt;
    engine.output = {
      success: true,
      id: engine.id,
      label: engine.label,
      category: engine.category,
      result
    };
    if (engine.cancelRequested || job.cancelRequested) {
      engine.status = 'cancelled';
    } else {
      engine.status = 'completed';
    }
  } catch (err) {
    engine.completedAt = Date.now();
    engine.durationMs = engine.completedAt - (engine.startedAt || engine.completedAt);
    engine.error = err instanceof Error ? err.message : String(err);
    engine.output = {
      success: false,
      id: engine.id,
      label: engine.label,
      category: engine.category,
      error: engine.error
    };
    if (err && typeof err === 'object') {
      if (err.code) {
        engine.output.errorCode = err.code;
      }
      if (Array.isArray(err.statusHistory) && err.statusHistory.length && !engine.output.statusHistory) {
        engine.output.statusHistory = err.statusHistory;
      }
      if (Array.isArray(err.logs) && err.logs.length && !engine.output.logs) {
        engine.output.logs = err.logs;
      }
      if (err.code === 'MCP_JOB_CANCELLED' || err.code === 'MCP_JOB_TIMEOUT') {
        engine.cancelRequested = true;
      }
    }
    engine.status = engine.cancelRequested || job.cancelRequested ? 'cancelled' : 'failed';
  }

  updateJobStatus(job);
}

async function executeJob(job) {
  updateJobStatus(job);
  const tasks = job.engines.map((engine) => runEngine(job, engine));
  await Promise.allSettled(tasks);
  job.completedAt = Date.now();
  updateJobStatus(job);
  scheduleCleanup(job.id);
}

function queueJobExecution(job) {
  setImmediate(() => {
    executeJob(job).catch((err) => {
      console.error('[MCP] job execution error', job.id, err);
    });
  });
}

function createJob({ prompt, filePrefix, engines }) {
  const id = randomUUID();
  const job = {
    id,
    prompt,
    filePrefix,
    createdAt: Date.now(),
    completedAt: null,
    status: 'pending',
    cancelRequested: false,
    mediaCache: new Map(),
    engines: engines.map((engine) => ({
      id: engine.id,
      label: engine.label || '',
      category: engine.category || '',
      input: engine.input || {},
      media: Array.isArray(engine.media) ? engine.media : [],
      mediaAssignments: Array.isArray(engine.mediaAssignments) ? engine.mediaAssignments : [],
      status: 'pending',
      cancelRequested: false,
      startedAt: null,
      completedAt: null,
      durationMs: 0,
      output: null,
      error: ''
    }))
  };
  jobs.set(id, job);
  queueJobExecution(job);
  return sanitizeJob(job);
}

function getJob(jobId) {
  return sanitizeJob(jobs.get(jobId));
}

function listJobs() {
  return Array.from(jobs.values()).map(sanitizeJob);
}

function cancelJob(jobId, engineId = null) {
  const job = jobs.get(jobId);
  if (!job) return null;

  if (!engineId) {
    job.cancelRequested = true;
    job.engines.forEach((engine) => {
      engine.cancelRequested = true;
      if (engine.status === 'pending') {
        engine.status = 'cancelled';
        engine.startedAt = engine.startedAt || Date.now();
        engine.completedAt = engine.completedAt || engine.startedAt;
        engine.durationMs = engine.completedAt - engine.startedAt;
      }
    });
    updateJobStatus(job);
    return sanitizeJob(job);
  }

  const engine = job.engines.find((entry) => entry.id === engineId);
  if (!engine) {
    return sanitizeJob(job);
  }
  engine.cancelRequested = true;
  if (engine.status === 'pending') {
    engine.status = 'cancelled';
    engine.startedAt = engine.startedAt || Date.now();
    engine.completedAt = engine.completedAt || engine.startedAt;
    engine.durationMs = engine.completedAt - engine.startedAt;
  }
  updateJobStatus(job);
  return sanitizeJob(job);
}

module.exports = {
  createJob,
  getJob,
  listJobs,
  cancelJob
};
