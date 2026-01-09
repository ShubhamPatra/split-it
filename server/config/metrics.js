import promBundle from 'express-prom-bundle';
import { register, Counter, Histogram } from 'prom-client';

export const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { app: 'split-it' },
  promClient: { collectDefaultMetrics: {} },
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'collection'],
});

export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Cache hit count',
  labelNames: ['cache_type'],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Cache miss count',
  labelNames: ['cache_type'],
});
