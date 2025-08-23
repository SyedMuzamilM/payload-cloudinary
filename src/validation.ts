import path from 'path';
import { CloudinaryConfig } from './types';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, RAW_EXTENSIONS } from './constants';

export class ValidationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends ValidationError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
  }
}

export class FileValidationError extends ValidationError {
  constructor(message: string) {
    super(message, 'FILE_VALIDATION_ERROR');
  }
}

/**
 * Validates Cloudinary configuration
 */
export const validateCloudinaryConfig = (config: CloudinaryConfig): void => {
  if (!config) {
    throw new ConfigurationError('Cloudinary configuration is required');
  }

  const { cloud_name, api_key, api_secret } = config;

  if (!cloud_name || typeof cloud_name !== 'string' || cloud_name.trim() === '') {
    throw new ConfigurationError('Valid cloud_name is required in Cloudinary configuration');
  }

  if (!api_key || typeof api_key !== 'string' || api_key.trim() === '') {
    throw new ConfigurationError('Valid api_key is required in Cloudinary configuration');
  }

  if (!api_secret || typeof api_secret !== 'string' || api_secret.trim() === '') {
    throw new ConfigurationError('Valid api_secret is required in Cloudinary configuration');
  }

  // Validate cloud_name format (alphanumeric, hyphens, underscores only)
  if (!/^[a-zA-Z0-9_-]+$/.test(cloud_name)) {
    throw new ConfigurationError('cloud_name contains invalid characters. Only alphanumeric, hyphens, and underscores are allowed');
  }
};

/**
 * Validates file upload parameters
 */
export const validateFile = (file: { filename: string; buffer: Buffer }, options?: {
  maxSize?: number;
  allowedExtensions?: string[];
}): void => {
  const maxSize = options?.maxSize || 100 * 1024 * 1024; // 100MB default
  const allowedExtensions = options?.allowedExtensions || [
    ...VIDEO_EXTENSIONS,
    ...IMAGE_EXTENSIONS,
    ...RAW_EXTENSIONS
  ];

  if (!file) {
    throw new FileValidationError('File is required');
  }

  if (!file.filename || typeof file.filename !== 'string' || file.filename.trim() === '') {
    throw new FileValidationError('Valid filename is required');
  }

  if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new FileValidationError('File buffer is required');
  }

  if (file.buffer.length === 0) {
    throw new FileValidationError('File cannot be empty');
  }

  if (file.buffer.length > maxSize) {
    throw new FileValidationError(
      `File size (${Math.round(file.buffer.length / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(maxSize / 1024 / 1024)}MB)`
    );
  }

  const ext = path.extname(file.filename).toLowerCase();
  if (!ext) {
    throw new FileValidationError('File must have a valid extension');
  }

  if (!allowedExtensions.includes(ext)) {
    throw new FileValidationError(
      `File type '${ext}' is not supported. Allowed types: ${allowedExtensions.join(', ')}`
    );
  }

  // Basic filename security checks
  if (file.filename.includes('..') || file.filename.includes('/') || file.filename.includes('\\')) {
    throw new FileValidationError('Filename contains invalid characters');
  }

  // Check for suspicious file patterns
  const suspiciousPatterns = [
    /\.php$/i,
    /\.exe$/i,
    /\.scr$/i,
    /\.bat$/i,
    /\.com$/i,
    /\.pif$/i,
    /\.vbs$/i,
    /\.js$/i,
    /\.jar$/i
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(file.filename))) {
    throw new FileValidationError('File type is not allowed for security reasons');
  }
};

/**
 * Validates public ID to prevent injection attacks
 */
export const validatePublicId = (publicId: string): void => {
  if (!publicId || typeof publicId !== 'string') {
    throw new ValidationError('Public ID must be a non-empty string');
  }

  // Cloudinary public ID restrictions
  if (publicId.length > 255) {
    throw new ValidationError('Public ID cannot exceed 255 characters');
  }

  // Check for invalid characters that could cause issues
  if (/[<>:"\\|?*]/.test(publicId)) {
    throw new ValidationError('Public ID contains invalid characters');
  }
};

/**
 * Validates folder path
 */
export const validateFolderPath = (folder: string): void => {
  if (!folder || typeof folder !== 'string') {
    throw new ValidationError('Folder path must be a non-empty string');
  }

  if (folder.includes('..')) {
    throw new ValidationError('Folder path cannot contain ".." for security reasons');
  }

  if (folder.length > 255) {
    throw new ValidationError('Folder path cannot exceed 255 characters');
  }
};

/**
 * Sanitizes a string to be used safely in URLs and file paths
 */
export const sanitizeString = (input: string): string => {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-') // Replace any character that's not a letter or number with a hyphen
    .replace(/-+/g, '-') // Replace consecutive hyphens with a single hyphen
    .replace(/^-|-$/g, '') // Remove leading or trailing hyphens
    .substring(0, 100); // Limit length
};