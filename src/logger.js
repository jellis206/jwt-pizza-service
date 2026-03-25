const config = require('./config');

class Logger {
  httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.user,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
        resBody: typeof resBody === 'string' ? resBody : JSON.stringify(resBody),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  log(level, type, logData) {
    if (!config.logging.endpointUrl || config.logging.endpointUrl.includes('placeholder')) {
      return;
    }
    const labels = { source: config.logging.source, level, type };
    const values = [[String(Date.now() * 1_000_000), this.sanitize(logData)]];
    const logEvent = { streams: [{ stream: labels, values }] };
    this.sendLogToVictoriaLogs(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  sanitize(logData) {
    let data = JSON.stringify({ _msg: this.toMessage(logData), ...logData });
    return data.replace(/"password"\s*:\s*"(?:[^"\\]|\\.)*"/g, '"password":"*****"');
  }

  toMessage(logData) {
    if (logData.method && logData.path) return `${logData.method} ${logData.path} ${logData.statusCode ?? ''}`.trim();
    if (logData.sql) return logData.sql.slice(0, 80);
    if (logData.request) return `factory request`;
    if (logData.response) return `factory response`;
    if (logData.message) return logData.message;
    return 'log';
  }

  sendLogToVictoriaLogs(event) {
    const body = JSON.stringify(event);
    const auth = Buffer.from(`${config.logging.accountId}:${config.logging.apiKey}`).toString('base64');
    fetch(config.logging.endpointUrl, {
      method: 'post',
      body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
    })
      .then((res) => {
        if (!res.ok) res.text().then((t) => console.log(`Failed to send log to VictoriaLogs (${res.status}): ${t}`));
      })
      .catch((err) => {
        console.log('Error sending log to VictoriaLogs', err.message);
      });
  }
}

module.exports = new Logger();
