const { StatusCodeError, asyncHandler } = require('./endpointHelper');

describe('EndpointHelper', () => {
  describe('StatusCodeError', () => {
    test('creates error with message and status code', () => {
      const error = new StatusCodeError('Test error', 404);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(404);
      expect(error instanceof Error).toBe(true);
    });

    test('creates error with different status codes', () => {
      const error403 = new StatusCodeError('Forbidden', 403);
      expect(error403.statusCode).toBe(403);

      const error500 = new StatusCodeError('Internal error', 500);
      expect(error500.statusCode).toBe(500);
    });
  });

  describe('asyncHandler', () => {
    test('handles successful async function', async () => {
      const mockReq = {};
      const mockRes = { json: jest.fn() };
      const mockNext = jest.fn();

      const asyncFn = async (req, res) => {
        res.json({ success: true });
      };

      const handler = asyncHandler(asyncFn);
      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('catches and passes errors to next', async () => {
      const mockReq = {};
      const mockRes = {};
      const mockNext = jest.fn();

      const error = new Error('Test error');
      const asyncFn = async () => {
        throw error;
      };

      const handler = asyncHandler(asyncFn);
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    test('catches StatusCodeError', async () => {
      const mockReq = {};
      const mockRes = {};
      const mockNext = jest.fn();

      const error = new StatusCodeError('Not found', 404);
      const asyncFn = async () => {
        throw error;
      };

      const handler = asyncHandler(asyncFn);
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });
  });
});
