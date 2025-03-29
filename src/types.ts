import type { Adapter, CollectionOptions, GenerateURL } from '@payloadcms/plugin-cloud-storage/types'
import type { Plugin, UploadCollectionSlug, Field } from 'payload'

// Define a simplified PayloadDocument type for use with thumbnails
export interface PayloadDocument {
  id?: string;
  filename?: string;
  cloudinary?: CloudinaryMetadata;
  sizes?: Record<string, { url: string; width: number; height: number; }>;
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
   * Additional custom fields to add to media collection
   * These will be merged with the default fields (cloudinary, versions, etc.)
   */
  customFields?: Field[]

  /**
   * Enable PDF thumbnails in the admin UI
   * @default true
   */
  enablePDFThumbnails?: boolean
}

export type CloudinaryStoragePlugin = (cloudinaryArgs: CloudinaryStorageOptions) => Plugin

export type CloudinaryMetadata = {
  public_id: string
  resource_type: string
  format: string
  secure_url: string
  bytes: number
  created_at: string
  duration?: number
  width?: number
  height?: number
  eager?: any[]
  version?: string
  version_id?: string
  pages?: number
  selected_page?: number
  thumbnail_url?: string
}

export type CloudinaryAdapter = Adapter