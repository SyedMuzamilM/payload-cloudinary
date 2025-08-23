import type { HandleDelete } from '@payloadcms/plugin-cloud-storage/types'
import type { v2 as cloudinaryType } from 'cloudinary'

import path from 'path'
import { CloudinaryDeleteError, defaultLogger, handleError, type Logger } from './errors'

interface Args {
  cloudinary: typeof cloudinaryType
  folder: string
  logger?: Logger
}

export const getHandleDelete =
  ({ cloudinary, folder, logger = defaultLogger }: Args): HandleDelete =>
  async ({ filename }) => {
    try {
      const filePath = path.posix.join(folder, filename)

      // Extract public_id without file extension
      const publicId = filePath.replace(/\.[^/.]+$/, '')

      logger.debug('Attempting to delete file from Cloudinary', {
        filename,
        publicId,
        folder
      })

      const result = await cloudinary.uploader.destroy(publicId)

      if (result.result === 'ok') {
        logger.info('File deleted from Cloudinary successfully', {
          filename,
          publicId,
          result: result.result
        })
      } else if (result.result === 'not found') {
        logger.warn('File not found in Cloudinary, may have been already deleted', {
          filename,
          publicId,
          result: result.result
        })
        // Don't throw error for "not found" - file deletion is idempotent
      } else {
        throw new CloudinaryDeleteError(
          `Unexpected result from Cloudinary delete: ${result.result}`,
          undefined,
          publicId
        )
      }
    } catch (error) {
      if (error instanceof CloudinaryDeleteError) {
        throw error
      }

      const deleteError = new CloudinaryDeleteError(
        `Failed to delete file from Cloudinary: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
        filename
      )

      logger.error('Error deleting file from Cloudinary', {
        filename,
        error: deleteError.toLogObject()
      })

      throw deleteError
    }
  }
