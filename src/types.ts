import type { Adapter, CollectionOptions, GenerateURL } from '@payloadcms/plugin-cloud-storage/types'
import type { Plugin, UploadCollectionSlug } from 'payload'

// Extend the GenerateURL parameter type
export type GenerateURLParams = Parameters<GenerateURL>[0] & {
  version?: string | number;
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
}

export type CloudinaryAdapter = Adapter