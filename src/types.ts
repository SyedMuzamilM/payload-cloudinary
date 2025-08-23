import type { Adapter, CollectionOptions, GenerateURL } from '@payloadcms/plugin-cloud-storage/types'
import type { Plugin, UploadCollectionSlug, Field } from 'payload'
import type { Logger } from './errors'

// Define a simplified PayloadDocument type for use with thumbnails
export interface PayloadDocument {
  id?: string;
  filename?: string;
  cloudinary?: CloudinaryMetadata;
  versions?: CloudinaryVersionInfo[];
  sizes?: Record<string, { 
    url: string; 
    width: number; 
    height: number; 
    filename?: string;
    filesize?: number;
    mimeType?: string;
  }>;
  [key: string]: any;
}

// Extend the GenerateURL parameter type
export type GenerateURLParams = Parameters<GenerateURL>[0] & {
  version?: string | number;
  pdf_page?: number; // Page number for PDF thumbnails
  format?: string; // Target format for conversion
}

export type CloudinaryURLResponse = {
  url: string;
  public_id: string;
}

// Extend the original GenerateURL type
export type CloudinaryGenerateURL = (args: GenerateURLParams) => CloudinaryURLResponse;

// Override the GenerateURL args only
declare module '@payloadcms/plugin-cloud-storage/types' {
  interface GenerateURLArgs {
    version?: string | number;
    pdf_page?: number; // Page number for PDF thumbnails
    format?: string; // Target format for conversion
  }
}

// Extend the original GenerateURL type
export type CloudinaryConfig = {
  cloud_name: string
  api_key: string
  api_secret: string
}

export type CloudinaryVersioningOptions = {
  /**
   * Whether to enable versioning support
   * @default false
   */
  enabled?: boolean

  /**
   * Whether to automatically invalidate old versions in CDN
   * @default false
   */
  autoInvalidate?: boolean

  /**
   * Whether to store version history in PayloadCMS
   * @default false
   */
  storeHistory?: boolean
}

/**
 * Options for customizing Cloudinary public ID generation
 */
export type PublicIDOptions = {
  /**
   * Whether to enable custom public ID generation
   * @default true
   */
  enabled?: boolean

  /**
   * Whether to use the original filename as part of the public ID
   * @default true
   */
  useFilename?: boolean

  /**
   * Whether to ensure unique filenames by adding a random suffix
   * @default true
   */
  uniqueFilename?: boolean

  /**
   * Custom function to generate a public ID
   * If provided, this will override useFilename and uniqueFilename
   * @param filename The original filename
   * @param prefix The file prefix (if any)
   * @param folder The base folder
   * @returns A string to use as the public ID
   */
  generatePublicID?: (filename: string, prefix?: string, folder?: string) => string
}

export type CloudinaryStorageOptions = {
  /**
   * Collection options to apply the Cloudinary adapter to.
   */
  collections: Partial<Record<UploadCollectionSlug, Omit<CollectionOptions, 'adapter'> | true>>

  /**
   * Cloudinary configuration
   */
  config: CloudinaryConfig

  /**
   * Folder path in Cloudinary where files will be uploaded
   * @default 'payload-media'
   */
  folder?: string

  /**
   * Whether or not to disable local storage
   * @default true
   */
  disableLocalStorage?: boolean

  /**
   * Whether or not to enable the plugin
   * @default true
   */
  enabled?: boolean

  /**
   * Versioning configuration options
   */
  versioning?: CloudinaryVersioningOptions

  /**
   * Public ID configuration options
   */
  publicID?: PublicIDOptions

  /**
   * Support for Dynamic Folder Mode
   * When true, uses asset_folder parameter in upload to ensure correct folder display in Media Library
   * @default true
   */
  supportDynamicFolderMode?: boolean

  /**
   * Additional custom fields to add to media collection
   * These will be merged with the default fields (cloudinary, versions, etc.)
   */
  customFields?: Field[]

  /**
   * Enable PDF thumbnails in the admin UI
   * @default true
   */
  enablePDFThumbnails?: boolean

  /**
   * Custom logger instance for the plugin
   * @default defaultLogger (console-based)
   */
  logger?: Logger

  /**
   * File validation options
   */
  fileValidation?: FileValidationOptions
}

export interface FileValidationOptions {
  /**
   * Maximum file size in bytes
   * @default 100MB (100 * 1024 * 1024)
   */
  maxSize?: number;

  /**
   * Additional allowed file extensions (without the dot)
   * @example ['.pdf', '.docx', '.csv']
   */
  allowedExtensions?: string[];

  /**
   * Blocked file extensions for security
   * @default ['.exe', '.scr', '.bat', '.com', '.pif', '.vbs', '.js', '.jar', '.php']
   */
  blockedExtensions?: string[];

  /**
   * Custom file validation function
   * @param file The file to validate
   * @returns void if valid, throws error if invalid
   */
  customValidator?: (file: { filename: string; buffer: Buffer }) => void;
}

export interface UploadFileInput {
  filename: string;
  buffer: Buffer;
  mimeType?: string;
}

export interface UploadDataInput {
  prefix?: string;
  [key: string]: any;
}

export interface UploadResult extends UploadDataInput {
  cloudinary: CloudinaryMetadata;
  versions?: CloudinaryVersionInfo[];
}

/**
 * Strict configuration type with required fields
 */
export interface CloudinaryConfigStrict {
  cloud_name: string;
  api_key: string;
  api_secret: string;
}

/**
 * Runtime configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type CloudinaryStoragePlugin = (cloudinaryArgs: CloudinaryStorageOptions) => Plugin

export type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto';

export interface CloudinaryUploadResult {
  public_id: string;
  resource_type: CloudinaryResourceType;
  format: string;
  secure_url: string;
  bytes: number;
  created_at: string;
  version?: number;
  version_id?: string;
  width?: number;
  height?: number;
  pages?: number;
  duration?: number;
  eager?: Array<{
    transformation: string;
    width?: number;
    height?: number;
    bytes?: number;
    format: string;
    url: string;
    secure_url: string;
  }>;
}

export interface CloudinaryMetadata {
  public_id: string;
  resource_type: CloudinaryResourceType;
  format: string;
  secure_url: string;
  bytes: number;
  created_at: string;
  version?: string;
  version_id?: string;
  // Image/Video specific
  width?: number;
  height?: number;
  duration?: number;
  eager?: Array<{
    transformation: string;
    width?: number;
    height?: number;
    bytes?: number;
    format: string;
    url: string;
    secure_url: string;
  }>;
  // PDF specific
  pages?: number;
  selected_page?: number;
  thumbnail_url?: string;
}

export interface CloudinaryVersionInfo {
  version: string;
  version_id: string;
  created_at: string;
  secure_url: string;
}

export type CloudinaryAdapter = Adapter