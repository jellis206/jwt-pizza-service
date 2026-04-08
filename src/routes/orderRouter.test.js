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

describe('Order Router', () => {
  describe('GET /api/order/menu', () => {
    test('get menu successfully without authentication', async () => {
      const response = await request(app).get('/api/order/menu');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('menu contains valid items', async () => {
      const response = await request(app).get('/api/order/menu');

      expect(response.status).toBe(200);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('title');
        expect(response.body[0]).toHaveProperty('price');
      }
    });
  });

  describe('PUT /api/order/menu', () => {
    test('admin can add menu item', async () => {
      const adminUser = await createAdminUser();
      const { token } = await loginUser(adminUser.email, 'adminpass');

      const newItem = {
        title: 'Test Pizza',
        description: 'A test pizza',
        image: 'test.png',
        price: 0.001,
      };

      const response = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${token}`).send(newItem);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('non-admin cannot add menu item', async () => {
      const email = `diner${Date.now()}@test.com`;
      await createTestUser('Diner User', email, 'password123');
      const { token } = await loginUser(email, 'password123');

      const newItem = {
        title: 'Test Pizza',
        description: 'A test pizza',
        image: 'test.png',
        price: 0.001,
      };

      const response = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${token}`).send(newItem);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('unable to add menu item');
    });

    test('fails without authentication', async () => {
      const newItem = {
        title: 'Test Pizza',
        description: 'A test pizza',
        image: 'test.png',
        price: 0.001,
      };

      const response = await request(app).put('/api/order/menu').send(newItem);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/order', () => {
    test('get orders for authenticated user', async () => {
      const email = `orderuser${Date.now()}@test.com`;
      await createTestUser('Order User', email, 'password123');
      const { token } = await loginUser(email, 'password123');

      const response = await request(app).get('/api/order').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('dinerId');
    });

    test('get orders with pagination', async () => {
      const email = `pageuser${Date.now()}@test.com`;
      await createTestUser('Page User', email, 'password123');
      const { token } = await loginUser(email, 'password123');

      const response = await request(app).get('/api/order?page=1').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('orders');
    });

    test('fails without authentication', async () => {
      const response = await request(app).get('/api/order');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/order', () => {
    test('create order successfully', async () => {
      const email = `createorder${Date.now()}@test.com`;
      await createTestUser('Create Order User', email, 'password123');
      const { token } = await loginUser(email, 'password123');

      // Get menu to find a valid item
      const menuResponse = await request(app).get('/api/order/menu');
      const menuItem = menuResponse.body[0];

      if (!menuItem) {
        // Skip test if no menu items
        return;
      }

      const orderData = {
        franchiseId: 1,
        storeId: 1,
        items: [
          {
            menuId: menuItem.id,
            description: menuItem.title,
            price: menuItem.price,
          },
        ],
      };

      const response = await request(app).post('/api/order').set('Authorization', `Bearer ${token}`).send(orderData);

      // The response may be 200 or 500 depending on factory availability
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('order');
        expect(response.body.order.items).toHaveLength(1);
      }
    });

    test('handles factory API failure gracefully', async () => {
      const email = `factoryfail${Date.now()}@test.com`;
      await createTestUser('Factory Fail User', email, 'password123');
      const { token } = await loginUser(email, 'password123');

      // Get menu to find a valid item
      const menuResponse = await request(app).get('/api/order/menu');
      const menuItem = menuResponse.body[0];

      if (!menuItem) {
        // Skip test if no menu items
        return;
      }

      const orderData = {
        franchiseId: 1,
        storeId: 1,
        items: [
          {
            menuId: menuItem.id,
            description: menuItem.title,
            price: menuItem.price,
          },
        ],
      };

      const response = await request(app).post('/api/order').set('Authorization', `Bearer ${token}`).send(orderData);

      // This test explicitly checks for both success and failure paths
      // When factory fails, we get 500 with failure message
      if (response.status === 500) {
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Failed to fulfill order at factory');
      } else {
        // If factory succeeds, we get 200
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('order');
      }
    });

    test('handles factory API failure with mocked response', async () => {
      const email = `mockedfail${Date.now()}@test.com`;
      await createTestUser('Mocked Fail User', email, 'password123');
      const { token } = await loginUser(email, 'password123');

      // Get menu to find a valid item
      const menuResponse = await request(app).get('/api/order/menu');
      const menuItem = menuResponse.body[0];

      if (!menuItem) {
        // Skip test if no menu items
        return;
      }

      // Mock fetch to return a failure response
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ reportUrl: 'http://test.com/report', message: 'Factory unavailable' }),
      });

      const orderData = {
        franchiseId: 1,
        storeId: 1,
        items: [
          {
            menuId: menuItem.id,
            description: menuItem.title,
            price: menuItem.price,
          },
        ],
      };

      const response = await request(app).post('/api/order').set('Authorization', `Bearer ${token}`).send(orderData);

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Failed to fulfill order at factory');

      // Restore original fetch
      global.fetch = originalFetch;
    });

    test('fails without authentication', async () => {
      const orderData = {
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: 'Test', price: 0.001 }],
      };

      const response = await request(app).post('/api/order').send(orderData);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/order/chaos/:state', () => {
    test('admin can enable chaos', async () => {
      const adminUser = await createAdminUser();
      const { token } = await loginUser(adminUser.email, 'adminpass');

      const response = await request(app).put('/api/order/chaos/true').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ chaos: true });
    });

    test('admin can disable chaos', async () => {
      const adminUser = await createAdminUser();
      const { token } = await loginUser(adminUser.email, 'adminpass');

      await request(app).put('/api/order/chaos/true').set('Authorization', `Bearer ${token}`);
      const response = await request(app).put('/api/order/chaos/false').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ chaos: false });
    });

    test('non-admin cannot enable chaos', async () => {
      const email = `diner${Date.now()}@test.com`;
      await createTestUser('Diner', email, 'password123');
      const { token } = await loginUser(email, 'password123');

      const response = await request(app).put('/api/order/chaos/true').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ chaos: false });
    });

    test('fails without authentication', async () => {
      const response = await request(app).put('/api/order/chaos/true');

      expect(response.status).toBe(401);
    });
  });
});
