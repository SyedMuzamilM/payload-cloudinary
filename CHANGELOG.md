# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Client-side Uploads**: Added support for uploading files directly from the browser to Cloudinary. This bypasses server limits (e.g., Vercel's 4.5MB request limit) and speeds up the upload process.
  - Enable via `clientUploads: true` in the plugin options.
  - Automatically handles generating a secure signature on the server, avoiding exposure of your Cloudinary API Secret to the frontend.
  - Fully supports Payload CMS `useCompositePrefixes` for flexible document paths.
- Proper routing and processing to extract full Cloudinary metadata (including PDF thumbnail generation and Image dimension checks) directly from the client upload payload so no functionality is lost when doing client-side uploads.

### Changed
- Exported `./client` module in `package.json` so the `CloudinaryClientUploadHandler` is correctly resolved by the Payload Admin UI.
- Updated the bundle script to properly mark external dependencies, fixing bundling issues with `@payloadcms/plugin-cloud-storage` internals.
- Internal refactor of `handleUpload` to gracefully intercept `clientUploadContext` payloads.
