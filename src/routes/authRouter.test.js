const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database');

// Helper function to create a test user
async function createTestUser(name = 'Test User', email = `test${Date.now()}@test.com`, password = 'password123') {
  return await DB.addUser({ name, email, password, roles: [{ role: Role.Diner }] });
}

// Helper function to login and get token
async function loginTestUser(email, password) {
  const response = await request(app).put('/api/auth').send({ email, password });
  return response.body.token;
}

describe('Auth Router', () => {
  describe('POST /api/auth (Register)', () => {
    test('register new user successfully', async () => {
      const userData = {
        name: 'New User',
        email: `newuser${Date.now()}@test.com`,
        password: 'password123',
      };

      const response = await request(app).post('/api/auth').send(userData);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.roles).toEqual([{ role: 'diner' }]);
    });

    test('register fails without name', async () => {
      const response = await request(app).post('/api/auth').send({ email: 'test@test.com', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('name, email, and password are required');
    });

    test('register fails without email', async () => {
      const response = await request(app).post('/api/auth').send({ name: 'Test', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('name, email, and password are required');
    });

    test('register fails without password', async () => {
      const response = await request(app).post('/api/auth').send({ name: 'Test', email: 'test@test.com' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('name, email, and password are required');
    });
  });

  describe('PUT /api/auth (Login)', () => {
    test('login existing user successfully', async () => {
      // Create a user first
      const email = `loginuser${Date.now()}@test.com`;
      const password = 'password123';
      await createTestUser('Login User', email, password);

      // Now login
      const response = await request(app).put('/api/auth').send({ email, password });

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(email);
      expect(response.body.token).toBeDefined();
    });

    test('login fails with wrong password', async () => {
      // Create a user first
      const email = `wrongpass${Date.now()}@test.com`;
      await createTestUser('Wrong Pass User', email, 'correctpass');

      // Try to login with wrong password
      const response = await request(app).put('/api/auth').send({ email, password: 'wrongpass' });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('login fails with non-existent email', async () => {
      const response = await request(app)
        .put('/api/auth')
        .send({ email: 'nonexistent@test.com', password: 'password123' });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('DELETE /api/auth (Logout)', () => {
    test('logout successfully with valid token', async () => {
      // Create and login a user
      const email = `logoutuser${Date.now()}@test.com`;
      const password = 'password123';
      await createTestUser('Logout User', email, password);
      const token = await loginTestUser(email, password);

      // Now logout
      const response = await request(app).delete('/api/auth').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('logout successful');
    });

    test('logout fails without token', async () => {
      const response = await request(app).delete('/api/auth');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('unauthorized');
    });

    test('logout fails with invalid token', async () => {
      const response = await request(app).delete('/api/auth').set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('unauthorized');
    });
  });

  describe('Authentication middleware', () => {
    test('handles malformed JWT gracefully', async () => {
      // Send a request with a malformed JWT
      const response = await request(app).get('/api/user/me').set('Authorization', 'Bearer malformed.jwt.token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('unauthorized');
    });

    test('handles request without auth token', async () => {
      const response = await request(app).get('/api/user/me');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('unauthorized');
    });
  });
});
