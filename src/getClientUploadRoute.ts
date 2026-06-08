import { v2 as cloudinary } from 'cloudinary'
import type { PayloadRequest } from 'payload'
import type { PublicIDOptions, CloudinaryVersioningOptions } from './types'
import path from 'path'
import { getResourceType } from './utils'
import { generatePublicID } from './publicID'

export interface GetClientUploadRouteOptions {
  cloudName: string
  apiKey: string
  apiSecret: string
  folder: string
  publicID?: PublicIDOptions
  versioning?: CloudinaryVersioningOptions
}

export const getClientUploadRoute = (options: GetClientUploadRouteOptions) => {
  return async (req: PayloadRequest) => {
    // Reconfigure cloudinary here to ensure it uses the correct config for this plugin instance
    cloudinary.config({
      cloud_name: options.cloudName,
      api_key: options.apiKey,
      api_secret: options.apiSecret,
    })

    const body = (typeof req.json === 'function' ? await req.json() : req.body) as Record<string, any>
    const { collectionSlug, docPrefix, filename, filesize, mimeType } = body || {}

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
        options.apiSecret
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
      return Response.json(
        { errors: [{ message: 'Failed to generate upload signature' }] },
        { status: 400 }
      )
    }
  }
}
