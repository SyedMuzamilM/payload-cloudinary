# API Reference

## Table of Contents

- [Main Functions](#main-functions)
- [Types](#types)
- [Error Classes](#error-classes)
- [Configuration Options](#configuration-options)
- [Validation Functions](#validation-functions)

## Main Functions

### `cloudinaryStorage(options: CloudinaryStorageOptions)`

The main plugin function that integrates Cloudinary storage with Payload CMS.

**Parameters:**
- `options: CloudinaryStorageOptions` - Configuration options for the plugin

**Returns:**
- `Plugin` - A Payload CMS plugin function

**Example:**
```typescript
import { cloudinaryStorage } from 'payload-cloudinary';

export default buildConfig({
  plugins: [
    cloudinaryStorage({
      config: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      },
      collections: {
        'media': true
      }
    })
  ]
});
```

### `generateMediaCollection(options: CloudinaryStorageOptions, config?: Partial<CollectionConfig>)`

Generates a media collection configuration with Cloudinary integration.

**Parameters:**
- `options: CloudinaryStorageOptions` - Plugin configuration
- `config?: Partial<CollectionConfig>` - Optional collection configuration overrides

**Returns:**
- `CollectionConfig` - Complete collection configuration

**Example:**
```typescript
import { generateMediaCollection } from 'payload-cloudinary';

const mediaCollection = generateMediaCollection({
  config: cloudinaryConfig,
  collections: { media: true },
  versioning: { enabled: true, storeHistory: true }
});
```

## Types

### `CloudinaryStorageOptions`

Main configuration interface for the plugin.

```typescript
interface CloudinaryStorageOptions {
  collections: Partial<Record<UploadCollectionSlug, CollectionOptions | true>>;
  config: CloudinaryConfig;
  folder?: string;
  disableLocalStorage?: boolean;
  enabled?: boolean;
  versioning?: CloudinaryVersioningOptions;
  publicID?: PublicIDOptions;
  supportDynamicFolderMode?: boolean;
  customFields?: Field[];
  enablePDFThumbnails?: boolean;
  logger?: Logger;
  fileValidation?: FileValidationOptions;
}
```

### `CloudinaryConfig`

Cloudinary service configuration.

```typescript
interface CloudinaryConfig {
  cloud_name: string;
  api_key: string;
  api_secret: string;
}
```

### `CloudinaryVersioningOptions`

Configuration for file versioning support.

```typescript
interface CloudinaryVersioningOptions {
  enabled?: boolean;        // Enable versioning
  autoInvalidate?: boolean; // Auto-invalidate old versions
  storeHistory?: boolean;   // Store version history in Payload
}
```

### `PublicIDOptions`

Configuration for Cloudinary public ID generation.

```typescript
interface PublicIDOptions {
  enabled?: boolean;
  useFilename?: boolean;
  uniqueFilename?: boolean;
  generatePublicID?: (filename: string, prefix?: string, folder?: string) => string;
}
```

### `FileValidationOptions`

File upload validation configuration.

```typescript
interface FileValidationOptions {
  maxSize?: number;
  allowedExtensions?: string[];
  blockedExtensions?: string[];
  customValidator?: (file: { filename: string; buffer: Buffer }) => void;
}
```

### `CloudinaryMetadata`

Metadata stored for each uploaded file.

```typescript
interface CloudinaryMetadata {
  public_id: string;
  resource_type: CloudinaryResourceType;
  format: string;
  secure_url: string;
  bytes: number;
  created_at: string;
  version?: string;
  version_id?: string;
  width?: number;      // For images/videos
  height?: number;     // For images/videos
  duration?: number;   // For videos
  pages?: number;      // For PDFs
  selected_page?: number;     // For PDFs
  thumbnail_url?: string;     // For PDFs
  eager?: Array<{             // Transformations
    transformation: string;
    width?: number;
    height?: number;
    bytes?: number;
    format: string;
    url: string;
    secure_url: string;
  }>;
}
```

## Error Classes

### `CloudinaryError`

Base error class for all Cloudinary-related errors.

```typescript
class CloudinaryError extends Error {
  constructor(
    message: string,
    public cause?: Error,
    public code?: string,
    public statusCode: number = 500
  );
  
  static fromError(error: unknown, defaultMessage?: string): CloudinaryError;
  toLogObject(): Record<string, any>;
}
```

### `CloudinaryUploadError`

Error thrown during file upload operations.

```typescript
class CloudinaryUploadError extends CloudinaryError {
  constructor(message: string, cause?: Error, public filename?: string);
}
```

### `CloudinaryDeleteError`

Error thrown during file deletion operations.

```typescript
class CloudinaryDeleteError extends CloudinaryError {
  constructor(message: string, cause?: Error, public publicId?: string);
}
```

### `CloudinaryResourceError`

Error thrown when a resource is not found.

```typescript
class CloudinaryResourceError extends CloudinaryError {
  constructor(message: string, cause?: Error, public resourceId?: string);
}
```

### `ValidationError`

Error thrown during input validation.

```typescript
class ValidationError extends Error {
  constructor(message: string, public code?: string);
}
```

## Configuration Options

### Environment Variables

The plugin expects these environment variables:

```bash
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
DEBUG=cloudinary  # Optional: Enable debug logging
```

### Collection Configuration

```typescript
// Simple configuration
collections: {
  'media': true
}

// Advanced configuration
collections: {
  'media': {
    disableLocalStorage: true,
    generateFileURL: ({ filename, prefix }) => `custom-url/${prefix}/${filename}`,
    staticHandler: customStaticHandler
  }
}
```

### PDF Configuration

```typescript
{
  enablePDFThumbnails: true,  // Enable PDF thumbnail generation
  // PDFs will automatically generate thumbnails using Cloudinary transformations
}
```

## Validation Functions

### `validateCloudinaryConfig(config: CloudinaryConfig)`

Validates Cloudinary configuration.

**Throws:**
- `ConfigurationError` - If configuration is invalid

### `validateFile(file: { filename: string; buffer: Buffer }, options?: FileValidationOptions)`

Validates uploaded files.

**Throws:**
- `FileValidationError` - If file is invalid

### `validatePublicId(publicId: string)`

Validates Cloudinary public ID.

**Throws:**
- `ValidationError` - If public ID is invalid

### `validateFolderPath(folder: string)`

Validates folder path.

**Throws:**
- `ValidationError` - If folder path is invalid

## Logging

The plugin includes a comprehensive logging system:

```typescript
interface Logger {
  error(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
}

// Custom logger example
const customLogger: Logger = {
  error: (msg, meta) => winston.error(msg, meta),
  warn: (msg, meta) => winston.warn(msg, meta),
  info: (msg, meta) => winston.info(msg, meta),
  debug: (msg, meta) => winston.debug(msg, meta)
};

cloudinaryStorage({
  // ... other options
  logger: customLogger
});
```

## Error Handling

The plugin provides comprehensive error handling with specific error types:

```typescript
try {
  // Plugin operations
} catch (error) {
  if (error instanceof CloudinaryUploadError) {
    console.error('Upload failed:', error.filename, error.message);
  } else if (error instanceof CloudinaryDeleteError) {
    console.error('Delete failed:', error.publicId, error.message);
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.code, error.message);
  }
}
```