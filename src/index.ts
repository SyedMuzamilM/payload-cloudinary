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
import type { CloudinaryStorageOptions, CloudinaryStoragePlugin, CloudinaryMetadata, CloudinaryAdapter } from './types'

export type { CloudinaryStorageOptions, CloudinaryStoragePlugin, CloudinaryMetadata, CloudinaryAdapter }

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

    // Set disableLocalStorage: true for collections specified in the plugin options
    const config = {
      ...incomingConfig,
      collections: (incomingConfig.collections || []).map((collection) => {
        if (!collectionsWithAdapter[collection.slug as keyof typeof collectionsWithAdapter]) {
          return collection
        }

        return {
          ...collection,
          upload: {
            ...(typeof collection.upload === 'object' ? collection.upload : {}),
            disableLocalStorage: true,
          },
        }
      }),
    }

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
      }),
      staticHandler: getHandler({ cloudinary, collection, folder }),   
    }
  }
}
