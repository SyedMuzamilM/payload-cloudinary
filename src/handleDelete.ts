import type { HandleDelete } from '@payloadcms/plugin-cloud-storage/types'
import type { v2 as cloudinaryType } from 'cloudinary'

// import path from 'path' // Not needed anymore

interface Args {
  cloudinary: typeof cloudinaryType
  // folder: string // Not needed anymore as public_id comes from doc
}

export const getHandleDelete =
  ({ cloudinary }: Args): HandleDelete =>
  async ({ doc }) => {
    const cloudinaryData = doc?.cloudinary as { public_id?: string; resource_type?: string } | undefined;
    const publicId = cloudinaryData?.public_id;
    const resourceType = cloudinaryData?.resource_type;

    if (!publicId) {
      const errMessage = 'Error: public_id not found on doc.cloudinary. Cannot delete from Cloudinary.';
      console.error(errMessage, 'Doc:', doc);
      throw new Error(errMessage);
    }

    const options: { resource_type?: string } = {};
    if (resourceType) {
      options.resource_type = resourceType;
    } else {
      console.warn(`Warning: resource_type not found on doc.cloudinary for public_id: ${publicId}. Deleting without specifying resource_type.`);
    }

    try {
      await cloudinary.uploader.destroy(publicId, options);
    } catch (error) {
      console.error(`Error deleting file from Cloudinary (public_id: ${publicId}):`, error);
      throw error;
    }
  }
