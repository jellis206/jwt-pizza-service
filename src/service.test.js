const request = require('supertest');
const app = require('./service');

describe('Service', () => {
  test('GET / returns welcome message', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('welcome to JWT Pizza');
    expect(response.body.version).toBeDefined();
  });

  test('GET /api/docs returns documentation', async () => {
    const response = await request(app).get('/api/docs');
    expect(response.status).toBe(200);
    expect(response.body.endpoints).toBeDefined();
    expect(response.body.config).toBeDefined();
    expect(response.body.version).toBeDefined();
  });

  test('GET /unknown returns 404', async () => {
    const response = await request(app).get('/unknown');
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('unknown endpoint');
  });

  test('CORS headers are set', async () => {
    const response = await request(app).get('/').set('Origin', 'http://localhost:3000');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  test('Error handler catches errors without status code', async () => {
    // Test by trying to create order without auth (will cause DB error)
    const response = await request(app).post('/api/order').send({ items: [] });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
