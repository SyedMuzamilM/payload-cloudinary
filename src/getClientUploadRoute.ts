import { v2 as cloudinary } from 'cloudinary'
import { APIError, Forbidden } from 'payload'
import type { PayloadRequest } from 'payload'
import type { ClientUploadsAccess } from '@payloadcms/plugin-cloud-storage/types'
import type { PublicIDOptions, CloudinaryVersioningOptions, CloudinaryStorageOptions } from './types'
import path from 'path'
import { getResourceType } from './utils'
import { generatePublicID } from './publicID'

export interface GetClientUploadRouteOptions {
  cloudName: string
  apiKey: string
  apiSecret: string
  folder: string
  collections: CloudinaryStorageOptions['collections']
  access?: ClientUploadsAccess
  publicID?: PublicIDOptions
  versioning?: CloudinaryVersioningOptions
}

const defaultAccess: ClientUploadsAccess = ({ req }) => Boolean(req.user)

export const getClientUploadRoute = (options: GetClientUploadRouteOptions) => {
  const access = options.access ?? defaultAccess

  return async (req: PayloadRequest) => {
    // Reconfigure cloudinary here to ensure it uses the correct config for this plugin instance
    cloudinary.config({
      cloud_name: options.cloudName,
      api_key: options.apiKey,
      api_secret: options.apiSecret,
    })

    if (typeof req.json !== 'function') {
      throw new APIError('Content-Type expected to be application/json', 400)
    }

    const body = (await req.json()) as Record<string, any>
    const { collectionSlug, docPrefix, filename } = body || {}

    if (!collectionSlug || !filename) {
      throw new APIError('collectionSlug and filename are required', 400)
    }

    const collectionConfig = options.collections[collectionSlug as keyof typeof options.collections]
    if (!collectionConfig) {
      throw new APIError(
        `Collection ${collectionSlug} was not found in Cloudinary storage options`,
        400,
      )
    }

    if (!(await access({ collectionSlug, req }))) {
      throw new Forbidden()
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000)

      // Build the folder path the same way handleUpload does
      const folderPath = docPrefix
        ? path.posix.join(options.folder, docPrefix)
        : options.folder

      // Generate public_id using the same shared logic as handleUpload
      const publicIdValue = generatePublicID(filename, folderPath, options.publicID)

      // Determine resource type from filename extension
      const ext = path.extname(filename).toLowerCase()
      const resourceType = getResourceType(ext)

      // Build the parameters that MUST be signed.
      // Cloudinary requires all params (except file, api_key, resource_type, cloud_name)
      // to be included in the signature.
      const paramsToSign: Record<string, any> = {
        timestamp,
        public_id: publicIdValue,
        asset_folder: folderPath,
        use_filename: true,
        unique_filename: true,
      }

      // Add versioning invalidation if enabled
      if (options.versioning?.autoInvalidate) {
        paramsToSign.invalidate = true
      }

      const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        options.apiSecret,
      )

      // Build the correct upload URL with the specific resource type
      const uploadUrl = `https://api.cloudinary.com/v1_1/${options.cloudName}/${resourceType}/upload`

      return Response.json({
        signature,
        timestamp,
        apiKey: options.apiKey,
        cloudName: options.cloudName,
        publicId: publicIdValue,
        resourceType,
        uploadUrl,
        // Send all signed params so the client can include them in the upload
        uploadParams: paramsToSign,
      })
    } catch (error) {
      if (error instanceof APIError || error instanceof Forbidden) {
        throw error
      }

      req.payload.logger.error({ err: error }, 'Failed to generate Cloudinary upload signature')

      throw new APIError('Failed to generate upload signature', 400)
    }
  }
}
