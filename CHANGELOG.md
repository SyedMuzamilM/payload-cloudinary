# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0-beta.2] - 2026-08-02

### Fixed
- **Client uploads compile error**: Stopped importing `initClientUploads` from `@payloadcms/plugin-cloud-storage/utilities`, which is missing in some installed package versions and caused Next.js/Webpack `Attempted import error` failures.
- Vendored `initClientUploads` locally so client-upload endpoint + admin provider registration always works.
- Pass `clientUploads` on the GeneratedAdapter (required for plugin-cloud-storage to skip server `handleUpload` for client-uploaded files).
- Call `initClientUploads` on `incomingConfig` *before* spreading into the returned config, so endpoints/providers are not dropped.
- Add authenticated access checks + collection validation on the signature route (matches official Payload storage adapters).

## [2.4.0-beta.1] - 2025-06-09

### Added
- **Client-side Uploads**: Upload files directly from the browser to Cloudinary, bypassing server limits (e.g., Vercel's 4.5MB request limit).
  - Enable via `clientUploads: true` in the plugin options.
  - Secure signature generation on the server — your Cloudinary API Secret is never exposed to the frontend.
  - `NEXT_PUBLIC_CLOUDINARY_API_KEY` environment variable is **no longer required** — the API key is securely passed from the server handler.
  - Full support for `useCompositePrefixes` for flexible document paths.
- **Metadata persistence for client uploads**: Added an `afterChange` hook that persists Cloudinary metadata (public_id, secure_url, format, dimensions, etc.) for client-uploaded files. This fixes the core issue where `plugin-cloud-storage` skips `handleUpload` for client uploads.
- **Shared public ID generation**: Extracted `generatePublicID` and `sanitizeForPublicID` into a shared `publicID.ts` module so both server-side and client-side uploads produce identical public IDs.

### Changed
- **Server handler rewrite** (`getClientUploadRoute.ts`): Now generates proper `public_id` using the same logic as `handleUpload`, signs all upload parameters (not just timestamp), and returns the API key and resource-type-specific upload URL.
- **Client handler rewrite** (`CloudinaryClientUploadHandler.ts`): Uses server-provided signed params and API key instead of manually constructing FormData with environment variables.
- **Guarded `initClientUploads`**: Only initializes client upload providers when `clientUploads` is truthy and collections are configured, with the correct `enabled` flag.
- **Defensive `collections` handling**: Plugin no longer crashes if `collections` is omitted from config — defaults to an empty object.
- Exported `./client` module in `package.json` so the `CloudinaryClientUploadHandler` is correctly resolved by the Payload Admin UI.
- Internal refactor: `handleUpload` now imports from shared `publicID.ts` module.

### Fixed
- Fixed signature mismatch errors on client uploads — server now signs all parameters the client sends to Cloudinary.
- Fixed `public_id` inconsistency between client and server upload paths.
- Fixed example config missing required `collections` property.
- Removed orphaned dist files (`createServerHandler`, `generateClientUploadSignature`) from a previous approach.

### Removed
- **`NEXT_PUBLIC_CLOUDINARY_API_KEY` dependency**: The client handler no longer reads from `process.env`. API key is provided by the server handler response.

## [2.3.0] - 2025-05-20

### Added
- **PDF Support**: Added comprehensive PDF handling with thumbnail generation
  - Automatic page count detection
  - Page selection for thumbnails
  - Thumbnail URL generation
  - Admin UI PDF thumbnails
- **Dynamic Folder Mode**: Support for Cloudinary's Dynamic Folder Mode via `asset_folder` parameter
- **Custom Fields**: Support for adding custom fields to media collections via `customFields` option
- **Public ID Customization**: Full control over Cloudinary public ID generation
  - `useFilename` option
  - `uniqueFilename` option
  - Custom `generatePublicID` function support
- **Versioning**: Added version history tracking with `storeHistory` option

### Changed
- Improved file type detection with comprehensive extension lists
- Better handling of raw file uploads (documents, archives, etc.)
