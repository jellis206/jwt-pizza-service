const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database');

// Helper functions
async function createTestUser(name = 'Test User', email = `test${Date.now()}@test.com`, password = 'password123') {
  return await DB.addUser({ name, email, password, roles: [{ role: Role.Diner }] });
}

async function createAdminUser() {
  return await DB.addUser({
    name: 'Admin User',
    email: `admin${Date.now()}@test.com`,
    password: 'adminpass',
    roles: [{ role: Role.Admin }],
  });
}

async function loginUser(email, password) {
  const response = await request(app).put('/api/auth').send({ email, password });
  return response.body;
}

describe('User Router', () => {
  describe('GET /api/user/me', () => {
    test('get authenticated user successfully', async () => {
      const email = `getme${Date.now()}@test.com`;
      const password = 'password123';
      await createTestUser('Get Me User', email, password);
      const { token, user } = await loginUser(email, password);

      const response = await request(app).get('/api/user/me').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe(email);
      expect(response.body.id).toBe(user.id);
    });

    test('fails without authentication', async () => {
      const response = await request(app).get('/api/user/me');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('unauthorized');
    });
  });

  describe('PUT /api/user/:userId', () => {
    test('user can update their own information', async () => {
      const email = `updateself${Date.now()}@test.com`;
      const password = 'password123';
      const user = await createTestUser('Update Self User', email, password);
      const { token } = await loginUser(email, password);

      const updatedData = {
        name: 'Updated Name',
        email: email,
        password: password,
      };

      const response = await request(app)
        .put(`/api/user/${user.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body.user.name).toBe(updatedData.name);
      expect(response.body.token).toBeDefined();
    });

    test('user cannot update another user without admin role', async () => {
      const email1 = `user1${Date.now()}@test.com`;
      const email2 = `user2${Date.now()}@test.com`;
      await createTestUser('User 1', email1, 'password123');
      const user2 = await createTestUser('User 2', email2, 'password123');
      const { token } = await loginUser(email1, 'password123');

      const response = await request(app)
        .put(`/api/user/${user2.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked', email: email2, password: 'password123' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('unauthorized');
    });

    test('admin can update any user', async () => {
      const regularEmail = `regular${Date.now()}@test.com`;
      const regularUser = await createTestUser('Regular User', regularEmail, 'password123');

      const adminUser = await createAdminUser();
      const { token } = await loginUser(adminUser.email, 'adminpass');

      const response = await request(app)
        .put(`/api/user/${regularUser.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Admin Updated', email: regularEmail, password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.user.name).toBe('Admin Updated');
    });

    test('fails without authentication', async () => {
      const response = await request(app)
        .put('/api/user/1')
        .send({ name: 'Test', email: 'test@test.com', password: 'password' });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/user/:userId', () => {
    test('admin can delete a user', async () => {
      const targetEmail = `deletetarget${Date.now()}@test.com`;
      const targetUser = await createTestUser('Delete Target', targetEmail, 'password123');

      const adminUser = await createAdminUser();
      const { token } = await loginUser(adminUser.email, 'adminpass');

      const response = await request(app).delete(`/api/user/${targetUser.id}`).set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('user deleted');
    });

    test('non-admin cannot delete user', async () => {
      const email = `deleteuser${Date.now()}@test.com`;
      const user = await createTestUser('Delete User', email, 'password123');
      const { token } = await loginUser(email, 'password123');

      const response = await request(app).delete(`/api/user/${user.id}`).set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('unauthorized');
    });

    test('fails without authentication', async () => {
      const response = await request(app).delete('/api/user/1');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/user', () => {
    test('admin can list users', async () => {
      const adminUser = await createAdminUser();
      const { token } = await loginUser(adminUser.email, 'adminpass');

      const response = await request(app).get('/api/user').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(typeof response.body.more).toBe('boolean');
    });

    test('admin can list users with pagination', async () => {
      const adminUser = await createAdminUser();
      const { token } = await loginUser(adminUser.email, 'adminpass');

      const response = await request(app).get('/api/user?page=0&limit=2').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeLessThanOrEqual(2);
    });

    test('admin can filter users by name', async () => {
      const uniqueName = `UniqueTestUser${Date.now()}`;
      await createTestUser(uniqueName, `filter${Date.now()}@test.com`, 'password123');

      const adminUser = await createAdminUser();
      const { token } = await loginUser(adminUser.email, 'adminpass');

      const response = await request(app).get(`/api/user?name=*${uniqueName}*`).set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBeGreaterThan(0);
      expect(response.body.users[0].name).toBe(uniqueName);
    });

    test('non-admin cannot list users', async () => {
      const email = `listuser${Date.now()}@test.com`;
      await createTestUser('List User', email, 'password123');
      const { token } = await loginUser(email, 'password123');

      const response = await request(app).get('/api/user').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('unauthorized');
    });

    test('fails without authentication', async () => {
      const response = await request(app).get('/api/user');

      expect(response.status).toBe(401);
    });
  });
});
