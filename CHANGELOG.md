# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2024-01-XX

### 🔒 Security

- **BREAKING:** Added comprehensive input validation for all file uploads
- **BREAKING:** Added Cloudinary configuration validation
- Added security checks for file types and paths to prevent malicious uploads
- Implemented path traversal protection
- Added file size limits and extension whitelisting/blacklisting
- Added public ID validation to prevent injection attacks

### 🛡️ Error Handling

- **NEW:** Complete error handling system with custom error classes
- **NEW:** Structured logging with configurable log levels
- **NEW:** `CloudinaryError`, `CloudinaryUploadError`, `CloudinaryDeleteError`, `CloudinaryResourceError` error types
- **NEW:** Error context and debugging information
- **NEW:** Graceful error recovery for non-critical failures
- **NEW:** `handleError` utility function for consistent error management

### ⚡ Performance

- **IMPROVED:** Optimized PDF page count fetching (uses upload result when available)
- **IMPROVED:** Eliminated duplicate resource fetching in static handler
- **IMPROVED:** Streamlined file upload process (removed unnecessary stream creation)
- **IMPROVED:** Added efficient caching headers for static files
- **IMPROVED:** Reduced API calls through smarter resource management

### 🏗️ TypeScript & Type Safety

- **NEW:** Enhanced TypeScript definitions with stricter types
- **NEW:** `CloudinaryResourceType`, `CloudinaryUploadResult`, `CloudinaryVersionInfo` interfaces
- **NEW:** `FileValidationOptions`, `UploadFileInput`, `UploadResult` types
- **NEW:** `CloudinaryConfigStrict` for runtime validation
- **IMPROVED:** Better type inference and IDE support
- **IMPROVED:** More specific error types with additional context properties

### 🧪 Testing

- **NEW:** Comprehensive test suite with Jest
- **NEW:** Unit tests for validation, error handling, and utilities
- **NEW:** Mock setup for Cloudinary API
- **NEW:** Test coverage reporting (70%+ threshold)
- **NEW:** Automated testing in CI/CD pipeline

### 🛠️ Development Experience

- **NEW:** ESLint configuration with TypeScript and security rules
- **NEW:** Prettier configuration for consistent code formatting
- **NEW:** VS Code workspace settings and extension recommendations
- **NEW:** Pre-commit hooks for code quality
- **IMPROVED:** Build process with type checking and linting

### 📦 CI/CD & Security

- **NEW:** GitHub Actions workflow for automated testing and deployment
- **NEW:** Dependabot configuration for automated dependency updates
- **NEW:** Security vulnerability scanning with Snyk
- **NEW:** Automated NPM publishing on releases
- **NEW:** Code coverage reporting with Codecov

### 📚 Documentation

- **NEW:** Comprehensive API reference documentation
- **NEW:** Detailed troubleshooting guide with common issues and solutions
- **NEW:** Performance optimization guide
- **NEW:** Error handling examples and best practices
- **IMPROVED:** README with better examples and feature highlights

### 🔧 Configuration

- **NEW:** `logger` option for custom logging implementation
- **NEW:** `fileValidation` options for file upload validation
- **NEW:** Enhanced validation with detailed error messages
- **IMPROVED:** Better default values and validation

### 🐛 Bug Fixes

- Fixed PDF page count fetching when result doesn't include pages
- Fixed memory leaks in file upload process
- Improved error messages for better debugging
- Fixed race conditions in resource fetching
- Better handling of edge cases in file validation

### 🗑️ Deprecated

- `sanitizeForPublicID` function (use `sanitizeString` from validation module)

### Breaking Changes

⚠️ **BREAKING CHANGES in v2.1.0:**

1. **Validation:** File uploads now require passing validation checks
2. **Configuration:** Cloudinary config is validated at startup
3. **Error Types:** Error handling now uses specific error classes instead of generic Error
4. **Dependencies:** Updated minimum Node.js version to 18+

### Migration Guide

#### From v2.0.x to v2.1.0

```typescript
// Before v2.1.0
cloudinaryStorage({
  config: {
    // Configuration wasn't validated
    cloud_name: undefined, // This would fail silently
  }
});

// v2.1.0+
cloudinaryStorage({
  config: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // Now validated
    api_key: process.env.CLOUDINARY_API_KEY,       // Required
    api_secret: process.env.CLOUDINARY_API_SECRET, // Required
  },
  // NEW: Optional validation settings
  fileValidation: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedExtensions: ['.jpg', '.png', '.pdf'],
  },
  // NEW: Custom logger
  logger: customLogger,
});
```

#### Error Handling Updates

```typescript
// Before v2.1.0
try {
  await uploadFile();
} catch (error) {
  console.error('Upload failed:', error.message);
}

// v2.1.0+
try {
  await uploadFile();
} catch (error) {
  if (error instanceof CloudinaryUploadError) {
    console.error('Upload failed:', error.filename, error.message);
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.code, error.message);
  }
}
```

## [2.0.0] - 2023-XX-XX

### Added
- Initial release with Cloudinary integration
- PDF support with thumbnail generation
- Version management and history tracking
- Custom field support
- Static file handling

---

For complete details on any release, see the [releases page](https://github.com/syedmuzamilm/payload-cloudinary/releases).