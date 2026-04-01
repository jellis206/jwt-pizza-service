global.fetch = jest.fn();

describe('logger module', () => {
  let logger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    jest.mock('./config.js', () => ({
      logging: {
        source: 'jwt-pizza-service-test',
        endpointUrl: 'logging-endpoint-placeholder',
        accountId: 'test-account',
        apiKey: 'test-key',
      },
    }));

    logger = require('./logger');
  });

  describe('sanitize', () => {
    it('masks password fields in log data', () => {
      const result = logger.sanitize({ email: 'a@b.com', password: 'secret' });
      expect(result).toContain('"password":"*****"');
      expect(result).not.toContain('secret');
    });

    it('masks password fields nested inside reqBody strings', () => {
      const reqBody = JSON.stringify({ email: 'a@b.com', password: 'secret' });
      const result = logger.sanitize({ method: 'POST', path: '/api/auth', statusCode: 200, reqBody });
      expect(result).not.toContain('secret');
    });

    it('leaves non-sensitive fields untouched', () => {
      const result = logger.sanitize({ email: 'a@b.com', name: 'Jay' });
      expect(result).toContain('a@b.com');
      expect(result).toContain('Jay');
    });
  });

  describe('log', () => {
    it('does not call fetch when endpointUrl is placeholder', () => {
      logger.log('info', 'http', { method: 'GET' });
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('log with real endpoint', () => {
    beforeEach(() => {
      jest.resetModules();
      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      jest.mock('./config.js', () => ({
        logging: {
          source: 'jwt-pizza-service-test',
          endpointUrl: 'https://metrics.example.com/victorialogs/insert/loki/api/v1/push',
          accountId: 'test-account',
          apiKey: 'test-key',
        },
      }));

      logger = require('./logger');
    });

    it('sends a Loki-format payload to the endpoint', () => {
      logger.log('info', 'http', { method: 'GET', path: '/api/order' });
      expect(fetch).toHaveBeenCalledWith(
        'https://metrics.example.com/victorialogs/insert/loki/api/v1/push',
        expect.objectContaining({
          method: 'post',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.streams).toBeDefined();
      expect(body.streams[0].stream.level).toBe('info');
      expect(body.streams[0].stream.type).toBe('http');
    });
  });

  describe('statusToLogLevel', () => {
    it('returns error for 5xx', () => {
      expect(logger.statusToLogLevel(500)).toBe('error');
      expect(logger.statusToLogLevel(503)).toBe('error');
    });

    it('returns warn for 4xx', () => {
      expect(logger.statusToLogLevel(400)).toBe('warn');
      expect(logger.statusToLogLevel(404)).toBe('warn');
    });

    it('returns info for 2xx and 3xx', () => {
      expect(logger.statusToLogLevel(200)).toBe('info');
      expect(logger.statusToLogLevel(302)).toBe('info');
    });
  });

  describe('httpLogger middleware', () => {
    it('calls next()', () => {
      const req = { method: 'GET', originalUrl: '/api/order/menu', headers: {}, body: {}, user: null };
      const res = { send: jest.fn(), statusCode: 200 };
      const next = jest.fn();

      logger.httpLogger(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('wraps res.send to capture response', () => {
      const req = { method: 'GET', originalUrl: '/api/order/menu', headers: {}, body: {}, user: null };
      const originalSend = jest.fn().mockReturnThis();
      const res = { send: originalSend, statusCode: 200 };
      const next = jest.fn();

      logger.httpLogger(req, res, next);
      res.send('{"result":"ok"}');

      expect(originalSend).toHaveBeenCalledWith('{"result":"ok"}');
    });
  });
});
