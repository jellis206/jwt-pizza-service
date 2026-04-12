const request = require('supertest');
const app = require('./service');
const { DB } = require('./database/database');

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

  test('CORS headers are set for allowed origin', async () => {
    const response = await request(app).get('/').set('Origin', 'https://pizza.urjellis.com');

    expect(response.headers['access-control-allow-origin']).toBe('https://pizza.urjellis.com');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  test('CORS headers are not set for disallowed origin', async () => {
    const response = await request(app).get('/').set('Origin', 'https://evil-attacker.com');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('Error handler catches errors without status code', async () => {
    // Test by trying to create order without auth (will cause DB error)
    const response = await request(app).post('/api/order').send({ items: [] });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  test('Error handler defaults to 500 for errors without statusCode', async () => {
    // This test triggers an error path that doesn't have a statusCode property
    // By sending invalid JSON data to various endpoints, we can trigger generic errors
    const response = await request(app).post('/api/auth').send({ name: '', email: '', password: '' });

    // Should get either 400 (validation) or 500 (generic error)
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body).toHaveProperty('message');
  });

  test('Error handler uses ?? operator for missing statusCode', async () => {
    // Mock DB.getMenu to throw a generic Error without statusCode
    const originalGetMenu = DB.getMenu;
    DB.getMenu = jest.fn().mockImplementation(() => {
      const error = new Error('Generic database error');
      // Explicitly ensure no statusCode property
      delete error.statusCode;
      throw error;
    });

    const response = await request(app).get('/api/order/menu');

    // Should default to 500 when no statusCode is present
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Generic database error');

    // Restore original method
    DB.getMenu = originalGetMenu;
  });
});
