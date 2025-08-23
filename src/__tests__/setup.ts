// Global test setup
import { jest } from '@jest/globals';

// Mock Cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
    api: {
      resource: jest.fn(),
    },
  },
}));

// Mock Payload CMS utilities
jest.mock('@payloadcms/plugin-cloud-storage/utilities', () => ({
  getFilePrefix: jest.fn(),
}));

// Set test environment variables
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.DEBUG = 'false';

// Global test timeout
jest.setTimeout(10000);

// Suppress console logs during tests unless DEBUG is true
if (process.env.DEBUG !== 'true') {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.debug = jest.fn();
}