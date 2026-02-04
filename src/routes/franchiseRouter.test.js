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

describe('Franchise Router', () => {
  describe('GET /api/franchise', () => {
    test('list all franchises without authentication', async () => {
      const response = await request(app).get('/api/franchise');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('franchises');
      expect(response.body).toHaveProperty('more');
      expect(Array.isArray(response.body.franchises)).toBe(true);
    });

    test('list franchises with pagination', async () => {
      const response = await request(app).get('/api/franchise?page=0&limit=5');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('franchises');
      expect(response.body).toHaveProperty('more');
    });

    test('list franchises with name filter', async () => {
      const response = await request(app).get('/api/franchise?name=test');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('franchises');
    });
  });

  describe('GET /api/franchise/:userId', () => {
    test('user can get their own franchises', async () => {
      const email = `franchiseowner${Date.now()}@test.com`;
      const user = await createTestUser('Franchise Owner', email, 'password123');
      const { token } = await loginUser(email, 'password123');

      const response = await request(app).get(`/api/franchise/${user.id}`).set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('admin can get any user franchises', async () => {
      const regularEmail = `regular${Date.now()}@test.com`;
      const regularUser = await createTestUser('Regular User', regularEmail, 'password123');

      const adminUser = await createAdminUser();
      const { token } = await loginUser(adminUser.email, 'adminpass');

      const response = await request(app)
        .get(`/api/franchise/${regularUser.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('user cannot get other user franchises', async () => {
      const email1 = `user1${Date.now()}@test.com`;
      const email2 = `user2${Date.now()}@test.com`;
      await createTestUser('User 1', email1, 'password123');
      const user2 = await createTestUser('User 2', email2, 'password123');
      const { token } = await loginUser(email1, 'password123');

      const response = await request(app).get(`/api/franchise/${user2.id}`).set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('fails without authentication', async () => {
      const response = await request(app).get('/api/franchise/1');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/franchise', () => {
    test('admin can create franchise', async () => {
      const adminUser = await createAdminUser();
      const { token } = await loginUser(adminUser.email, 'adminpass');

      const franchiseData = {
        name: `TestFranchise${Date.now()}`,
        admins: [{ email: adminUser.email }],
      };

      const response = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${token}`)
        .send(franchiseData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(franchiseData.name);
    });

    test('non-admin cannot create franchise', async () => {
      const email = `diner${Date.now()}@test.com`;
      await createTestUser('Diner User', email, 'password123');
      const { token } = await loginUser(email, 'password123');

      const franchiseData = {
        name: 'TestFranchise',
        admins: [{ email }],
      };

      const response = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${token}`)
        .send(franchiseData);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('unable to create a franchise');
    });

    test('fails without authentication', async () => {
      const franchiseData = {
        name: 'TestFranchise',
        admins: [{ email: 'test@test.com' }],
      };

      const response = await request(app).post('/api/franchise').send(franchiseData);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/franchise/:franchiseId', () => {
    test('delete franchise successfully', async () => {
      const adminUser = await createAdminUser();
      const { token } = await loginUser(adminUser.email, 'adminpass');

      // Create a franchise first
      const franchiseData = {
        name: `DeleteFranchise${Date.now()}`,
        admins: [{ email: adminUser.email }],
      };

      const createResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${token}`)
        .send(franchiseData);

      const franchiseId = createResponse.body.id;

      // Now delete it
      const response = await request(app).delete(`/api/franchise/${franchiseId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('franchise deleted');
    });
  });

  describe('POST /api/franchise/:franchiseId/store', () => {
    test('admin can create store', async () => {
      const adminUser = await createAdminUser();
      const { token } = await loginUser(adminUser.email, 'adminpass');

      // Create a franchise first
      const franchiseData = {
        name: `StoreFranchise${Date.now()}`,
        admins: [{ email: adminUser.email }],
      };

      const franchiseResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${token}`)
        .send(franchiseData);

      const franchiseId = franchiseResponse.body.id;

      // Create a store
      const storeData = {
        name: 'Test Store',
      };

      const response = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send(storeData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(storeData.name);
    });

    test('franchise admin can create store', async () => {
      const adminUser = await createAdminUser();
      const franchiseOwnerEmail = `franchiseowner${Date.now()}@test.com`;
      await createTestUser('Franchise Owner', franchiseOwnerEmail, 'password123');

      // Admin creates franchise with franchiseOwner as admin
      const { token: adminToken } = await loginUser(adminUser.email, 'adminpass');
      const franchiseData = {
        name: `OwnerFranchise${Date.now()}`,
        admins: [{ email: franchiseOwnerEmail }],
      };

      const franchiseResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(franchiseData);

      const franchiseId = franchiseResponse.body.id;

      // Franchise owner creates store
      const { token: ownerToken } = await loginUser(franchiseOwnerEmail, 'password123');
      const storeData = {
        name: 'Owner Store',
      };

      const response = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(storeData);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(storeData.name);
    });

    test('non-admin and non-franchise-owner cannot create store', async () => {
      const adminUser = await createAdminUser();
      const { token: adminToken } = await loginUser(adminUser.email, 'adminpass');

      // Create franchise
      const franchiseData = {
        name: `SecureFranchise${Date.now()}`,
        admins: [{ email: adminUser.email }],
      };

      const franchiseResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(franchiseData);

      const franchiseId = franchiseResponse.body.id;

      // Random user tries to create store
      const randomEmail = `random${Date.now()}@test.com`;
      await createTestUser('Random User', randomEmail, 'password123');
      const { token: randomToken } = await loginUser(randomEmail, 'password123');

      const storeData = {
        name: 'Unauthorized Store',
      };

      const response = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${randomToken}`)
        .send(storeData);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('unable to create a store');
    });

    test('fails without authentication', async () => {
      const storeData = {
        name: 'Test Store',
      };

      const response = await request(app).post('/api/franchise/1/store').send(storeData);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/franchise/:franchiseId/store/:storeId', () => {
    test('admin can delete store', async () => {
      const adminUser = await createAdminUser();
      const { token } = await loginUser(adminUser.email, 'adminpass');

      // Create franchise and store
      const franchiseData = {
        name: `DeleteStoreFranchise${Date.now()}`,
        admins: [{ email: adminUser.email }],
      };

      const franchiseResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${token}`)
        .send(franchiseData);

      const franchiseId = franchiseResponse.body.id;

      const storeResponse = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Store to Delete' });

      const storeId = storeResponse.body.id;

      // Delete the store
      const response = await request(app)
        .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('store deleted');
    });

    test('franchise owner can delete store', async () => {
      const adminUser = await createAdminUser();
      const ownerEmail = `owner${Date.now()}@test.com`;
      await createTestUser('Owner', ownerEmail, 'password123');

      const { token: adminToken } = await loginUser(adminUser.email, 'adminpass');

      // Create franchise
      const franchiseData = {
        name: `OwnerDeleteFranchise${Date.now()}`,
        admins: [{ email: ownerEmail }],
      };

      const franchiseResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(franchiseData);

      const franchiseId = franchiseResponse.body.id;

      // Owner creates and deletes store
      const { token: ownerToken } = await loginUser(ownerEmail, 'password123');

      const storeResponse = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Owner Store' });

      const storeId = storeResponse.body.id;

      const response = await request(app)
        .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('store deleted');
    });

    test('non-owner cannot delete store', async () => {
      const adminUser = await createAdminUser();
      const { token: adminToken } = await loginUser(adminUser.email, 'adminpass');

      // Create franchise and store
      const franchiseData = {
        name: `SecureDeleteFranchise${Date.now()}`,
        admins: [{ email: adminUser.email }],
      };

      const franchiseResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(franchiseData);

      const franchiseId = franchiseResponse.body.id;

      const storeResponse = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Secure Store' });

      const storeId = storeResponse.body.id;

      // Random user tries to delete
      const randomEmail = `random${Date.now()}@test.com`;
      await createTestUser('Random', randomEmail, 'password123');
      const { token: randomToken } = await loginUser(randomEmail, 'password123');

      const response = await request(app)
        .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${randomToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('unable to delete a store');
    });

    test('fails without authentication', async () => {
      const response = await request(app).delete('/api/franchise/1/store/1');

      expect(response.status).toBe(401);
    });
  });
});
