import type {
  Adapter,
  PluginOptions as CloudStoragePluginOptions,
  CollectionOptions,
  GeneratedAdapter,
} from '@payloadcms/plugin-cloud-storage/types'
import type { Config } from 'payload'

import { v2 as cloudinary } from 'cloudinary'
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import path from 'path'

import { getGenerateURL } from './generateURL'
import { getHandleDelete } from './handleDelete'
import { getHandleUpload } from './handleUpload'
import { getHandler } from './staticHandler'
import { generateMediaCollection } from './collections/Media'
import { generateCustomFields } from './collections/Media/fields/customFields'
import { cloudinaryFields } from './collections/Media/fields/cloudinary'
import { versionFields } from './collections/Media/fields/versions'
import type { 
  CloudinaryStorageOptions, 
  CloudinaryStoragePlugin, 
  CloudinaryMetadata, 
  CloudinaryAdapter,
  PayloadDocument
} from './types'

export type { CloudinaryStorageOptions, CloudinaryStoragePlugin, CloudinaryMetadata, CloudinaryAdapter }
export { generateMediaCollection }

// Function to check if a filename is a PDF by extension
const isPDF = (filename?: string): boolean => {
  if (!filename) return false;
  return path.extname(filename).toLowerCase() === '.pdf';
};

// Default adminThumbnail generator for PDFs
const defaultPDFThumbnailGenerator = (doc: PayloadDocument, cloudName: string): string => {
  if (!doc.cloudinary?.public_id) return '';
  const page = doc.cloudinary?.selected_page || 1;
  return `https://res.cloudinary.com/${cloudName}/image/upload/pg_${page},w_300,h_400,c_fill,q_auto,f_jpg/${doc.cloudinary.public_id}.pdf`;
};

export const cloudinaryStorage: CloudinaryStoragePlugin =
  (cloudinaryOptions: CloudinaryStorageOptions) =>
  (incomingConfig: Config): Config => {
    if (cloudinaryOptions.enabled === false) {
      return incomingConfig
    }

    const adapter = cloudinaryStorageInternal(cloudinaryOptions)

    // Add adapter to each collection option object
    const collectionsWithAdapter: CloudStoragePluginOptions['collections'] = Object.entries(
      cloudinaryOptions.collections,
    ).reduce(
      (acc, [slug, collOptions]) => ({
        ...acc,
        [slug]: {
          ...(collOptions === true ? {} : collOptions),
          adapter,
        },
      }),
      {} as Record<string, CollectionOptions>,
    )

    // Create a new config with our modifications
    const config = {
      ...incomingConfig,
      collections: (incomingConfig.collections || []).map((collection) => {
        // Check if this collection is one we should apply Cloudinary to
        const shouldApplyCloudinary = !!collectionsWithAdapter[collection.slug as keyof typeof collectionsWithAdapter];
        
        if (!shouldApplyCloudinary) {
          return collection;
        }

        // First, modify the upload configuration to disable local storage
        const modifiedCollection = {
          ...collection,
          upload: {
            ...(typeof collection.upload === 'object' ? collection.upload : {}),
            disableLocalStorage: true,
          },
        };

        // Add PDF thumbnail support if this is an upload collection
        if (modifiedCollection.upload) {
          const uploadConfig = modifiedCollection.upload;
          
          // If no adminThumbnail specified, or we specifically enable PDF thumbnails
          if (!uploadConfig.adminThumbnail || cloudinaryOptions.enablePDFThumbnails !== false) {
            modifiedCollection.upload = {
              ...uploadConfig,
              // Set custom adminThumbnail function that handles PDFs
              adminThumbnail: ({ doc }) => {
                const document = doc as PayloadDocument;
                
                // For PDFs, return a Cloudinary-generated thumbnail
                if (isPDF(document.filename) && document.cloudinary?.public_id) {
                  return defaultPDFThumbnailGenerator(document, cloudinaryOptions.config.cloud_name);
                }
                
                // For other types, use existing adminThumbnail if defined
                if (typeof uploadConfig.adminThumbnail === 'function') {
                  return uploadConfig.adminThumbnail({ doc });
                }
                
                if (typeof uploadConfig.adminThumbnail === 'string' && document.sizes?.[uploadConfig.adminThumbnail]) {
                  return document.sizes[uploadConfig.adminThumbnail].url;
                }
                
                // Default to secure_url from Cloudinary
                return document.cloudinary?.secure_url || '';
              }
            };
          }
        }

        // Generate all fields we need to add
        const customFields = generateCustomFields(cloudinaryOptions.customFields || []);
        const versionFieldsToAdd = cloudinaryOptions.versioning?.enabled && 
                                  cloudinaryOptions.versioning?.storeHistory ? 
                                  versionFields : [];
        
        // Make sure fields is an array
        modifiedCollection.fields = modifiedCollection.fields || [];
        
        // Add our fields to the collection
        modifiedCollection.fields = [
          ...modifiedCollection.fields,
          ...customFields,
          ...cloudinaryFields, // Always add Cloudinary fields
          ...versionFieldsToAdd,
        ];
        
        return modifiedCollection;
      }),
    };

    return cloudStoragePlugin({
      collections: collectionsWithAdapter,
    })(config)
  }

function cloudinaryStorageInternal({
  config,
  folder = 'payload-media',
  versioning = {
    enabled: false,
    autoInvalidate: false,
    storeHistory: false,
  },
  publicID,
}: CloudinaryStorageOptions): Adapter {
  return ({ collection, prefix }): GeneratedAdapter => {
    // Configure cloudinary
    cloudinary.config({
      cloud_name: config.cloud_name,
      api_key: config.api_key,
      api_secret: config.api_secret,
    })

    return {
      name: 'cloudinary',
      generateURL: getGenerateURL({ config, folder, versioning }),
      handleDelete: getHandleDelete({ cloudinary, folder }),
      handleUpload: getHandleUpload({
        cloudinary,
        collection,
        folder,
        prefix,
        versioning,
        publicID,
      }),
      staticHandler: getHandler({ cloudinary, collection, folder }),   
    }
  }
}
