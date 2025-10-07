import type { HandleDelete } from '@payloadcms/plugin-cloud-storage/types'
import type { v2 as cloudinaryType } from 'cloudinary'

import type { CloudinaryMetadata } from './types'

import path from 'path'

type HandleDeleteArgs = Parameters<HandleDelete>[0]
type DocWithCloudinaryMetadata = HandleDeleteArgs['doc'] & {
  cloudinary?: CloudinaryMetadata
}

interface Args {
  cloudinary: typeof cloudinaryType
  folder: string
}

export const getHandleDelete =
  ({ cloudinary, folder }: Args): HandleDelete =>
  async ({ filename, doc }) => {
    const filePath = path.posix.join(folder, filename)
    const docWithCloudinary = doc as DocWithCloudinaryMetadata

    try {
      // Extract public_id without file extension
      let publicId = filePath.replace(/\.[^/.]+$/, '')
      
      // Try to get metadata from doc if available (from Cloudinary plugin)
      let resourceType: string = 'image'
      let deliveryType: string = 'upload'
      
      if (docWithCloudinary.cloudinary) {
        // Use stored Cloudinary metadata if available
        publicId = docWithCloudinary.cloudinary.public_id || publicId
        resourceType = docWithCloudinary.cloudinary.resource_type || resourceType
        deliveryType = docWithCloudinary.cloudinary.type || deliveryType
      }

      // Attempt deletion with proper parameters
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        type: deliveryType,
        invalidate: true, // Invalidate CDN cache
      })

      // Log the result for debugging
      const okResults = new Set(['ok', 'not found', 'already deleted'])
      if (!okResults.has(result?.result)) {
        console.warn(
          `Cloudinary destroy returned unexpected result for ${publicId}:`,
          result
        )
      } else {
        console.log(`Successfully deleted ${publicId} from Cloudinary`)
      }
      
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error)
      // Don't throw - allow the CMS deletion to proceed
      // throw error
    }
  }
