import type {
  Adapter,
  PluginOptions as CloudStoragePluginOptions,
  CollectionOptions,
  GeneratedAdapter,
} from '@payloadcms/plugin-cloud-storage/types'
import type { Config } from 'payload'

import { v2 as cloudinary } from 'cloudinary'
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'

import { getGenerateURL } from './generateURL'
import { getHandleDelete } from './handleDelete'
import { getHandleUpload } from './handleUpload'
import { getHandler } from './staticHandler'
import { generateMediaCollection } from './collections/Media'
import { generateCustomFields } from './collections/Media/fields/customFields'
import { cloudinaryFields } from './collections/Media/fields/cloudinary'
import { versionFields } from './collections/Media/fields/versions'
import type { CloudinaryStorageOptions, CloudinaryStoragePlugin, CloudinaryMetadata, CloudinaryAdapter } from './types'

export type { CloudinaryStorageOptions, CloudinaryStoragePlugin, CloudinaryMetadata, CloudinaryAdapter }
export { generateMediaCollection }

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

        // Then, inject our custom fields if they're provided
        if (cloudinaryOptions.customFields && cloudinaryOptions.customFields.length > 0) {
          // Generate all fields we need to add
          const customFields = generateCustomFields(cloudinaryOptions.customFields);
          const versionFieldsToAdd = cloudinaryOptions.versioning?.enabled && 
                                    cloudinaryOptions.versioning?.storeHistory ? 
                                    versionFields : [];
          
          // Make sure fields is an array
          modifiedCollection.fields = modifiedCollection.fields || [];
          
          // Add our fields to the collection
          modifiedCollection.fields = [
            ...modifiedCollection.fields,
            ...customFields,
            ...cloudinaryFields,
            ...versionFieldsToAdd,
          ];
        }

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
