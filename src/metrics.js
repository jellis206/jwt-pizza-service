const os = require('os');
const config = require('./config.js');

// Process start time for OTel cumulative sum startTimeUnixNano
const startTime = Date.now() * 1_000_000;

// In-memory counters
const requests = { total: 0, GET: 0, POST: 0, PUT: 0, DELETE: 0 };
const auth = { success: 0, failure: 0 };
const activeUserSet = new Set();
const pizzas = { sold: 0, failures: 0, revenue: 0 };
const latency = { serviceTotal: 0, pizzaTotal: 0 };
const latencyByEndpoint = {};

function getCpuUsagePercentage() {
  return parseFloat(((os.loadavg()[0] / os.cpus().length) * 100).toFixed(2));
}

function getMemoryUsagePercentage() {
  const used = os.totalmem() - os.freemem();
  return parseFloat(((used / os.totalmem()) * 100).toFixed(2));
}

// Express middleware — tracks HTTP method counts and per-endpoint latency
function requestTracker(req, res, next) {
  const start = Date.now();
  const method = req.method;
  requests.total++;
  if (requests[method] !== undefined) {
    requests[method]++;
  }
  res.on('finish', () => {
    const ms = Date.now() - start;
    latency.serviceTotal += ms;
    const endpoint = req.route ? req.route.path : req.path;
    latencyByEndpoint[endpoint] = (latencyByEndpoint[endpoint] || 0) + ms;
  });
  next();
}

function recordAuth(success) {
  if (success) {
    auth.success++;
  } else {
    auth.failure++;
  }
}

function trackUserLogin(userId) {
  activeUserSet.add(userId);
}

function trackUserLogout(userId) {
  activeUserSet.delete(userId);
}

function getActiveUserCount() {
  return activeUserSet.size;
}

function recordPizzaPurchase(success, latencyMs, revenue) {
  if (success) {
    pizzas.sold++;
    pizzas.revenue += revenue;
  } else {
    pizzas.failures++;
  }
  latency.pizzaTotal += latencyMs;
}

function createMetric(name, value, unit, type, attributes = {}) {
  const allAttributes = { source: config.metrics.source, ...attributes };
  const dataPoint = {
    asInt: Math.round(value),
    startTimeUnixNano: startTime,
    timeUnixNano: Date.now() * 1_000_000,
    attributes: Object.entries(allAttributes).map(([key, value]) => ({
      key,
      value: { stringValue: String(value) },
    })),
  };

  const metric = { name, unit, [type]: { dataPoints: [dataPoint] } };

  if (type === 'sum') {
    metric[type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[type].isMonotonic = true;
  }

  return metric;
}

function buildMetrics() {
  const metrics = [];

  // HTTP request counts by method
  metrics.push(createMetric('requests_total', requests.total, '1', 'sum', { method: 'total' }));
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    metrics.push(createMetric('requests_total', requests[method], '1', 'sum', { method }));
  }

  // Auth attempts
  metrics.push(createMetric('auth_attempts_total', auth.success, '1', 'sum', { result: 'success' }));
  metrics.push(createMetric('auth_attempts_total', auth.failure, '1', 'sum', { result: 'failure' }));

  // Active users
  metrics.push(createMetric('active_users', activeUserSet.size, '1', 'gauge'));

  // System metrics
  metrics.push(createMetric('cpu_percent', getCpuUsagePercentage(), '%', 'gauge'));
  metrics.push(createMetric('memory_percent', getMemoryUsagePercentage(), '%', 'gauge'));

  // Pizza metrics
  metrics.push(createMetric('pizzas_sold_total', pizzas.sold, '1', 'sum'));
  metrics.push(createMetric('pizza_failures_total', pizzas.failures, '1', 'sum'));
  metrics.push(createMetric('pizza_revenue_total', pizzas.revenue, '1', 'sum'));

  // Latency
  metrics.push(createMetric('service_latency_ms_total', latency.serviceTotal, 'ms', 'sum'));
  metrics.push(createMetric('pizza_creation_latency_ms_total', latency.pizzaTotal, 'ms', 'sum'));

  // Per-endpoint latency
  for (const [endpoint, ms] of Object.entries(latencyByEndpoint)) {
    metrics.push(createMetric('endpoint_latency_ms_total', ms, 'ms', 'sum', { endpoint }));
  }

  return metrics;
}

async function sendToGrafana(metrics) {
  const body = JSON.stringify({
    resourceMetrics: [{ scopeMetrics: [{ metrics }] }],
  });

  const auth64 = Buffer.from(`${config.metrics.userId}:${config.metrics.apiKey}`).toString('base64');

  try {
    const response = await fetch(config.metrics.endpointUrl, {
      method: 'POST',
      body,
      headers: {
        Authorization: `Basic ${auth64}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`Metrics push failed (${response.status}): ${text}`);
    }
  } catch (error) {
    console.error('Error pushing metrics:', error.message);
  }
}

function sendMetricsPeriodically(intervalMs) {
  if (!config.metrics.endpointUrl) {
    return; // No endpoint configured — skip (e.g. during tests)
  }
  setInterval(async () => {
    await sendToGrafana(buildMetrics());
  }, intervalMs);
}

module.exports = {
  requestTracker,
  recordAuth,
  trackUserLogin,
  trackUserLogout,
  getActiveUserCount,
  recordPizzaPurchase,
  sendMetricsPeriodically,
};
