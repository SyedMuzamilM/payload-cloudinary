import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  CloudinaryError,
  CloudinaryUploadError,
  CloudinaryDeleteError,
  CloudinaryResourceError,
  CloudinaryAPIError,
  defaultLogger,
  handleError,
  withErrorHandling,
  type Logger
} from '../../errors';

describe('Error Handling', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };
  });

  describe('CloudinaryError', () => {
    it('should create error with all properties', () => {
      const cause = new Error('Original error');
      const error = new CloudinaryError('Test message', cause, 'TEST_CODE', 400);

      expect(error.name).toBe('CloudinaryError');
      expect(error.message).toBe('Test message');
      expect(error.cause).toBe(cause);
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
    });

    it('should create error with default values', () => {
      const error = new CloudinaryError('Test message');

      expect(error.statusCode).toBe(500);
      expect(error.cause).toBeUndefined();
      expect(error.code).toBeUndefined();
    });

    it('should create CloudinaryError from Error', () => {
      const originalError = new Error('Original message');
      const error = CloudinaryError.fromError(originalError);

      expect(error.message).toBe('Original message');
      expect(error.cause).toBe(originalError);
      expect(error.code).toBe('UNKNOWN_ERROR');
    });

    it('should return same CloudinaryError when passed CloudinaryError', () => {
      const originalError = new CloudinaryError('Original', undefined, 'ORIGINAL_CODE');
      const error = CloudinaryError.fromError(originalError);

      expect(error).toBe(originalError);
    });

    it('should create CloudinaryError from string', () => {
      const error = CloudinaryError.fromError('String error');

      expect(error.message).toBe('String error');
      expect(error.code).toBe('STRING_ERROR');
    });

    it('should create CloudinaryError from unknown type', () => {
      const error = CloudinaryError.fromError({ unknown: 'object' });

      expect(error.message).toBe('Unknown error occurred');
      expect(error.code).toBe('UNKNOWN_ERROR');
    });

    it('should create proper log object', () => {
      const cause = new Error('Cause error');
      const error = new CloudinaryError('Test message', cause, 'TEST_CODE', 400);

      const logObject = error.toLogObject();

      expect(logObject).toEqual({
        name: 'CloudinaryError',
        message: 'Test message',
        code: 'TEST_CODE',
        statusCode: 400,
        stack: error.stack,
        cause: {
          name: 'Error',
          message: 'Cause error',
          stack: cause.stack
        }
      });
    });

    it('should create log object without cause', () => {
      const error = new CloudinaryError('Test message', undefined, 'TEST_CODE');

      const logObject = error.toLogObject();

      expect(logObject.cause).toBeUndefined();
    });
  });

  describe('Specific Error Types', () => {
    it('should create CloudinaryUploadError with correct properties', () => {
      const error = new CloudinaryUploadError('Upload failed', undefined, 'test.jpg');

      expect(error.name).toBe('CloudinaryUploadError');
      expect(error.code).toBe('UPLOAD_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.filename).toBe('test.jpg');
    });

    it('should create CloudinaryDeleteError with correct properties', () => {
      const error = new CloudinaryDeleteError('Delete failed', undefined, 'test-id');

      expect(error.name).toBe('CloudinaryDeleteError');
      expect(error.code).toBe('DELETE_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.publicId).toBe('test-id');
    });

    it('should create CloudinaryResourceError with correct properties', () => {
      const error = new CloudinaryResourceError('Resource not found', undefined, 'resource-id');

      expect(error.name).toBe('CloudinaryResourceError');
      expect(error.code).toBe('RESOURCE_ERROR');
      expect(error.statusCode).toBe(404);
      expect(error.resourceId).toBe('resource-id');
    });

    it('should create CloudinaryAPIError with correct properties', () => {
      const error = new CloudinaryAPIError('API failed', undefined, 'upload');

      expect(error.name).toBe('CloudinaryAPIError');
      expect(error.code).toBe('API_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.apiMethod).toBe('upload');
    });
  });

  describe('defaultLogger', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = {
        error: jest.spyOn(console, 'error').mockImplementation(),
        warn: jest.spyOn(console, 'warn').mockImplementation(),
        info: jest.spyOn(console, 'info').mockImplementation(),
        debug: jest.spyOn(console, 'debug').mockImplementation()
      };
    });

    afterEach(() => {
      Object.values(consoleSpy).forEach((spy: any) => spy.mockRestore());
    });

    it('should log error messages', () => {
      defaultLogger.error('Test error', { key: 'value' });
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '[Cloudinary Plugin] ERROR: Test error',
        '{\n  "key": "value"\n}'
      );
    });

    it('should log warn messages', () => {
      defaultLogger.warn('Test warning');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[Cloudinary Plugin] WARN: Test warning',
        ''
      );
    });

    it('should log info messages', () => {
      defaultLogger.info('Test info', { data: 123 });
      expect(consoleSpy.info).toHaveBeenCalledWith(
        '[Cloudinary Plugin] INFO: Test info',
        '{\n  "data": 123\n}'
      );
    });

    it('should only log debug when DEBUG is set', () => {
      const originalDebug = process.env.DEBUG;
      
      // Debug should not log by default
      defaultLogger.debug('Test debug');
      expect(consoleSpy.debug).not.toHaveBeenCalled();

      // Debug should log when DEBUG is true
      process.env.DEBUG = 'true';
      defaultLogger.debug('Test debug');
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        '[Cloudinary Plugin] DEBUG: Test debug',
        ''
      );

      // Debug should log when DEBUG is cloudinary
      process.env.DEBUG = 'cloudinary';
      defaultLogger.debug('Test debug 2');
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        '[Cloudinary Plugin] DEBUG: Test debug 2',
        ''
      );

      process.env.DEBUG = originalDebug;
    });
  });

  describe('handleError', () => {
    it('should handle CloudinaryError and log as error for 5xx status', () => {
      const error = new CloudinaryError('Server error', undefined, 'SERVER_ERROR', 500);
      const result = handleError(error, mockLogger, 'test-context');

      expect(result).toBe(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[test-context] Server error',
        expect.objectContaining({
          context: 'test-context',
          error: expect.objectContaining({
            name: 'CloudinaryError',
            message: 'Server error'
          })
        })
      );
    });

    it('should handle CloudinaryError and log as warning for 4xx status', () => {
      const error = new CloudinaryError('Client error', undefined, 'CLIENT_ERROR', 400);
      const result = handleError(error, mockLogger, 'test-context');

      expect(result).toBe(error);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[test-context] Client error',
        expect.any(Object)
      );
    });

    it('should handle CloudinaryError and log as info for other status codes', () => {
      const error = new CloudinaryError('Info message', undefined, 'INFO_CODE', 200);
      const result = handleError(error, mockLogger);

      expect(result).toBe(error);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Info message',
        expect.any(Object)
      );
    });

    it('should convert regular Error to CloudinaryError', () => {
      const error = new Error('Regular error');
      const result = handleError(error, mockLogger, 'test-context');

      expect(result).toBeInstanceOf(CloudinaryError);
      expect(result.message).toBe('Regular error');
      expect(result.cause).toBe(error);
    });

    it('should handle string error', () => {
      const result = handleError('String error', mockLogger, 'test-context');

      expect(result).toBeInstanceOf(CloudinaryError);
      expect(result.message).toBe('String error');
      expect(result.code).toBe('STRING_ERROR');
    });

    it('should handle unknown error types', () => {
      const result = handleError({ weird: 'object' }, mockLogger, 'test-context');

      expect(result).toBeInstanceOf(CloudinaryError);
      expect(result.message).toBe('Unknown error occurred');
      expect(result.code).toBe('UNKNOWN_ERROR');
    });

    it('should use defaultLogger when no logger provided', () => {
      const error = new Error('Test error');
      const result = handleError(error);

      expect(result).toBeInstanceOf(CloudinaryError);
    });
  });

  describe('withErrorHandling', () => {
    it('should wrap function and return result on success', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = withErrorHandling(mockFn, 'test-context', mockLogger);

      const result = await wrappedFn('arg1', 'arg2');

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should wrap function and handle errors', async () => {
      const error = new Error('Function error');
      const mockFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = withErrorHandling(mockFn, 'test-context', mockLogger);

      await expect(wrappedFn('arg1')).rejects.toThrow(CloudinaryError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[test-context] Function error',
        expect.any(Object)
      );
    });

    it('should preserve function signature', async () => {
      const typedFn = async (a: string, b: number): Promise<string> => {
        return `${a}-${b}`;
      };

      const wrappedFn = withErrorHandling(typedFn, 'test-context', mockLogger);
      const result = await wrappedFn('hello', 123);

      expect(result).toBe('hello-123');
    });

    it('should use defaultLogger when no logger provided', async () => {
      const error = new Error('Test error');
      const mockFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = withErrorHandling(mockFn, 'test-context');

      await expect(wrappedFn()).rejects.toThrow(CloudinaryError);
    });
  });
});