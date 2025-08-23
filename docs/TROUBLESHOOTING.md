# Troubleshooting Guide

## Common Issues and Solutions

### 1. Configuration Issues

#### Problem: "Valid cloud_name is required in Cloudinary configuration"

**Cause:** Missing or invalid Cloudinary configuration.

**Solution:**
```typescript
// ❌ Incorrect
cloudinaryStorage({
  config: {
    cloud_name: '',  // Empty string
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  }
});

// ✅ Correct
cloudinaryStorage({
  config: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,  // Valid cloud name
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  }
});
```

**Check:**
- Verify environment variables are set
- Ensure cloud_name contains only alphanumeric characters, hyphens, and underscores
- Check for typos in environment variable names

#### Problem: "cloud_name contains invalid characters"

**Cause:** Cloud name contains forbidden characters.

**Solution:**
- Use only letters, numbers, hyphens, and underscores
- No spaces, special characters, or emojis
- Example: `my-app-123` ✅, `my app!` ❌

### 2. Upload Issues

#### Problem: "File size exceeds maximum allowed size"

**Cause:** File is larger than the configured maximum size.

**Solution:**
```typescript
cloudinaryStorage({
  // ... other config
  fileValidation: {
    maxSize: 200 * 1024 * 1024, // Increase to 200MB
  }
});
```

#### Problem: "File type is not allowed for security reasons"

**Cause:** Trying to upload a potentially dangerous file type.

**Solution:**
```typescript
// These files are blocked by default for security:
// .exe, .scr, .bat, .com, .pif, .vbs, .js, .jar, .php

// If you need to allow specific types (be very careful):
cloudinaryStorage({
  fileValidation: {
    blockedExtensions: ['.exe', '.scr', '.bat'], // Customize blocked list
  }
});
```

#### Problem: Upload fails with "Invalid filename"

**Cause:** Filename contains path traversal attempts or invalid characters.

**Solution:**
- Remove `../` from filenames
- Avoid backslashes `\` and forward slashes `/`
- Use simple filenames without special characters

### 3. PDF Issues

#### Problem: PDF thumbnails not generating

**Cause:** PDF thumbnail generation is disabled or failing.

**Solution:**
```typescript
cloudinaryStorage({
  // ... other config
  enablePDFThumbnails: true,  // Ensure this is enabled
});
```

**Debugging:**
```typescript
// Enable debug logging
process.env.DEBUG = 'cloudinary';

// Check logs for PDF processing errors
```

#### Problem: "Error getting PDF page count"

**Cause:** Cloudinary API issue or PDF is corrupted.

**Solution:**
- Verify PDF is valid and not corrupted
- Check Cloudinary account limits
- Try with a simpler PDF file

### 4. Performance Issues

#### Problem: Slow upload times

**Cause:** Large files or network issues.

**Solutions:**
1. **Optimize file sizes:**
```typescript
cloudinaryStorage({
  fileValidation: {
    maxSize: 50 * 1024 * 1024, // Reduce max size
  }
});
```

2. **Enable eager transformations:**
```typescript
// In handleUpload.ts, customize upload options
const uploadOptions = {
  eager: [{ quality: 'auto', format: 'auto' }],
  eager_async: true,
};
```

#### Problem: High memory usage

**Cause:** Large files being processed in memory.

**Solution:**
- Use streaming uploads for large files
- Implement file size limits
- Monitor memory usage

### 5. Error Handling Issues

#### Problem: Generic error messages

**Cause:** Error details are being swallowed.

**Solution:**
```typescript
// Enable detailed logging
const customLogger: Logger = {
  error: (msg, meta) => {
    console.error('Cloudinary Error:', msg);
    console.error('Error Details:', JSON.stringify(meta, null, 2));
  },
  // ... other methods
};

cloudinaryStorage({
  logger: customLogger,
  // ... other config
});
```

#### Problem: Errors not being caught properly

**Cause:** Missing try-catch blocks or improper error handling.

**Solution:**
```typescript
try {
  await cloudinaryOperation();
} catch (error) {
  if (error instanceof CloudinaryUploadError) {
    console.error('Upload failed:', error.filename, error.message);
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.code, error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### 6. TypeScript Issues

#### Problem: Type errors with custom fields

**Cause:** TypeScript can't infer custom field types.

**Solution:**
```typescript
import type { Field } from 'payload';

const customFields: Field[] = [
  {
    name: 'alt',
    type: 'text',
    label: 'Alt Text',
  } as Field,
];

cloudinaryStorage({
  customFields,
  // ... other config
});
```

#### Problem: "Property 'cloudinary' does not exist"

**Cause:** TypeScript doesn't know about the cloudinary field.

**Solution:**
```typescript
// Extend the Payload document type
declare module 'payload' {
  interface GeneratedTypes {
    collections: {
      media: {
        cloudinary?: CloudinaryMetadata;
      };
    };
  }
}
```

### 7. Development Environment Issues

#### Problem: Tests failing

**Cause:** Cloudinary API calls in tests.

**Solution:**
```typescript
// Mock Cloudinary in tests
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
```

#### Problem: Environment variables not loading

**Cause:** Missing .env file or incorrect setup.

**Solution:**
```bash
# Create .env file
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 8. Production Deployment Issues

#### Problem: "Resource not found" in production

**Cause:** Different environment configuration.

**Solution:**
- Verify environment variables are set in production
- Check Cloudinary account is accessible from production environment
- Ensure correct cloud name for production account

#### Problem: CORS issues

**Cause:** Cloudinary CORS settings.

**Solution:**
- Configure CORS in Cloudinary settings
- Add your domain to allowed origins
- Use secure URLs (HTTPS)

## Debugging Tips

### Enable Debug Logging

```bash
# Environment variable
DEBUG=cloudinary

# Or in code
process.env.DEBUG = 'cloudinary';
```

### Check Cloudinary Account

1. Verify account limits and usage
2. Check API credentials are correct
3. Ensure account is active and in good standing

### Test with Minimal Configuration

```typescript
// Start with minimal config and add features gradually
cloudinaryStorage({
  config: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  },
  collections: {
    'media': true,
  },
});
```

### Monitor Network Requests

- Use browser dev tools to monitor network requests
- Check for failed API calls to Cloudinary
- Verify URLs are correctly formed

## Getting Help

1. **Check the logs** - Enable debug logging first
2. **Verify configuration** - Double-check all settings
3. **Test in isolation** - Try with minimal configuration
4. **Check Cloudinary status** - Verify their service is operational
5. **Update dependencies** - Ensure you're using the latest version

## Error Reference

| Error Code | Description | Solution |
|------------|-------------|----------|
| `CONFIGURATION_ERROR` | Invalid Cloudinary config | Check environment variables |
| `FILE_VALIDATION_ERROR` | File validation failed | Check file size/type/name |
| `UPLOAD_ERROR` | Upload to Cloudinary failed | Check network/credentials |
| `DELETE_ERROR` | Delete from Cloudinary failed | Verify resource exists |
| `RESOURCE_ERROR` | Resource not found | Check public ID/URL |
| `VALIDATION_ERROR` | Input validation failed | Check input parameters |

## Performance Tips

1. **Use appropriate file sizes** - Don't upload unnecessarily large files
2. **Enable caching** - Use CDN features
3. **Optimize transformations** - Use efficient Cloudinary transformations
4. **Monitor usage** - Keep track of API calls and bandwidth
5. **Use eager transformations** - Pre-generate common transformations