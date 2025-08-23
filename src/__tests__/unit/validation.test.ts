import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validateCloudinaryConfig,
  validateFile,
  validatePublicId,
  validateFolderPath,
  sanitizeString,
  ValidationError,
  ConfigurationError,
  FileValidationError
} from '../../validation';
import { CloudinaryConfig } from '../../types';

describe('Validation', () => {
  describe('validateCloudinaryConfig', () => {
    it('should pass with valid configuration', () => {
      const config: CloudinaryConfig = {
        cloud_name: 'test-cloud',
        api_key: 'test-key',
        api_secret: 'test-secret'
      };

      expect(() => validateCloudinaryConfig(config)).not.toThrow();
    });

    it('should throw ConfigurationError for missing config', () => {
      expect(() => validateCloudinaryConfig(null as any))
        .toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for missing cloud_name', () => {
      const config = {
        api_key: 'test-key',
        api_secret: 'test-secret'
      } as CloudinaryConfig;

      expect(() => validateCloudinaryConfig(config))
        .toThrow('Valid cloud_name is required');
    });

    it('should throw ConfigurationError for empty cloud_name', () => {
      const config: CloudinaryConfig = {
        cloud_name: '',
        api_key: 'test-key',
        api_secret: 'test-secret'
      };

      expect(() => validateCloudinaryConfig(config))
        .toThrow('Valid cloud_name is required');
    });

    it('should throw ConfigurationError for invalid cloud_name characters', () => {
      const config: CloudinaryConfig = {
        cloud_name: 'test@cloud!',
        api_key: 'test-key',
        api_secret: 'test-secret'
      };

      expect(() => validateCloudinaryConfig(config))
        .toThrow('cloud_name contains invalid characters');
    });

    it('should allow valid cloud_name characters', () => {
      const config: CloudinaryConfig = {
        cloud_name: 'test-cloud_123',
        api_key: 'test-key',
        api_secret: 'test-secret'
      };

      expect(() => validateCloudinaryConfig(config)).not.toThrow();
    });

    it('should throw ConfigurationError for missing api_key', () => {
      const config = {
        cloud_name: 'test-cloud',
        api_secret: 'test-secret'
      } as CloudinaryConfig;

      expect(() => validateCloudinaryConfig(config))
        .toThrow('Valid api_key is required');
    });

    it('should throw ConfigurationError for missing api_secret', () => {
      const config = {
        cloud_name: 'test-cloud',
        api_key: 'test-key'
      } as CloudinaryConfig;

      expect(() => validateCloudinaryConfig(config))
        .toThrow('Valid api_secret is required');
    });
  });

  describe('validateFile', () => {
    let validFile: { filename: string; buffer: Buffer };

    beforeEach(() => {
      validFile = {
        filename: 'test-image.jpg',
        buffer: Buffer.from('test file content')
      };
    });

    it('should pass with valid file', () => {
      expect(() => validateFile(validFile)).not.toThrow();
    });

    it('should throw FileValidationError for null file', () => {
      expect(() => validateFile(null as any))
        .toThrow(FileValidationError);
    });

    it('should throw FileValidationError for missing filename', () => {
      const file = { ...validFile, filename: '' };
      expect(() => validateFile(file))
        .toThrow('Valid filename is required');
    });

    it('should throw FileValidationError for missing buffer', () => {
      const file = { filename: 'test.jpg' } as any;
      expect(() => validateFile(file))
        .toThrow('File buffer is required');
    });

    it('should throw FileValidationError for empty buffer', () => {
      const file = { ...validFile, buffer: Buffer.alloc(0) };
      expect(() => validateFile(file))
        .toThrow('File cannot be empty');
    });

    it('should throw FileValidationError for oversized file', () => {
      const file = {
        ...validFile,
        buffer: Buffer.alloc(200 * 1024 * 1024) // 200MB
      };
      expect(() => validateFile(file, { maxSize: 100 * 1024 * 1024 }))
        .toThrow('File size');
    });

    it('should throw FileValidationError for unsupported extension', () => {
      const file = { ...validFile, filename: 'test.unknown' };
      expect(() => validateFile(file))
        .toThrow('File type \'.unknown\' is not supported');
    });

    it('should throw FileValidationError for suspicious files', () => {
      const suspiciousFiles = [
        'malware.exe',
        'script.php',
        'trojan.scr',
        'virus.bat'
      ];

      suspiciousFiles.forEach(filename => {
        const file = { ...validFile, filename };
        expect(() => validateFile(file))
          .toThrow('File type is not allowed for security reasons');
      });
    });

    it('should throw FileValidationError for path traversal attempts', () => {
      const dangerousFiles = [
        '../../../etc/passwd',
        'test/../../secret.txt',
        'file\\with\\backslashes.jpg'
      ];

      dangerousFiles.forEach(filename => {
        const file = { ...validFile, filename };
        expect(() => validateFile(file))
          .toThrow('Filename contains invalid characters');
      });
    });

    it('should allow custom max size', () => {
      const file = {
        ...validFile,
        buffer: Buffer.alloc(50 * 1024 * 1024) // 50MB
      };
      
      expect(() => validateFile(file, { maxSize: 60 * 1024 * 1024 }))
        .not.toThrow();
      
      expect(() => validateFile(file, { maxSize: 40 * 1024 * 1024 }))
        .toThrow('File size');
    });

    it('should allow custom allowed extensions', () => {
      const file = { ...validFile, filename: 'document.custom' };
      
      expect(() => validateFile(file, { allowedExtensions: ['.custom'] }))
        .not.toThrow();
    });
  });

  describe('validatePublicId', () => {
    it('should pass with valid public ID', () => {
      expect(() => validatePublicId('folder/subfolder/file-name_123'))
        .not.toThrow();
    });

    it('should throw ValidationError for empty public ID', () => {
      expect(() => validatePublicId(''))
        .toThrow('Public ID must be a non-empty string');
    });

    it('should throw ValidationError for non-string public ID', () => {
      expect(() => validatePublicId(123 as any))
        .toThrow('Public ID must be a non-empty string');
    });

    it('should throw ValidationError for too long public ID', () => {
      const longId = 'a'.repeat(256);
      expect(() => validatePublicId(longId))
        .toThrow('Public ID cannot exceed 255 characters');
    });

    it('should throw ValidationError for invalid characters', () => {
      const invalidIds = [
        'file<name>',
        'file:name',
        'file"name',
        'file\\name',
        'file|name',
        'file?name',
        'file*name'
      ];

      invalidIds.forEach(id => {
        expect(() => validatePublicId(id))
          .toThrow('Public ID contains invalid characters');
      });
    });
  });

  describe('validateFolderPath', () => {
    it('should pass with valid folder path', () => {
      expect(() => validateFolderPath('media/uploads'))
        .not.toThrow();
    });

    it('should throw ValidationError for empty folder path', () => {
      expect(() => validateFolderPath(''))
        .toThrow('Folder path must be a non-empty string');
    });

    it('should throw ValidationError for path traversal attempts', () => {
      expect(() => validateFolderPath('media/../secrets'))
        .toThrow('Folder path cannot contain ".." for security reasons');
    });

    it('should throw ValidationError for too long folder path', () => {
      const longPath = 'a'.repeat(256);
      expect(() => validateFolderPath(longPath))
        .toThrow('Folder path cannot exceed 255 characters');
    });
  });

  describe('sanitizeString', () => {
    it('should sanitize string properly', () => {
      expect(sanitizeString('Hello World!')).toBe('hello-world');
      expect(sanitizeString('file_name@2023.jpg')).toBe('file-name-2023-jpg');
      expect(sanitizeString('---multiple---hyphens---')).toBe('multiple-hyphens');
      expect(sanitizeString('UPPERCASE')).toBe('uppercase');
    });

    it('should limit string length', () => {
      const longString = 'a'.repeat(150);
      const result = sanitizeString(longString);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('should handle special cases', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString('123')).toBe('123');
      expect(sanitizeString('---')).toBe('');
    });
  });

  describe('Error classes', () => {
    it('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Test message', 'TEST_CODE');
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
    });

    it('should create ConfigurationError as subclass of ValidationError', () => {
      const error = new ConfigurationError('Config error');
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error instanceof ValidationError).toBe(true);
    });

    it('should create FileValidationError as subclass of ValidationError', () => {
      const error = new FileValidationError('File error');
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('FILE_VALIDATION_ERROR');
      expect(error instanceof ValidationError).toBe(true);
    });
  });
});