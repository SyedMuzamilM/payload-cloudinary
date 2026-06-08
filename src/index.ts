import type {
  Adapter,
  PluginOptions as CloudStoragePluginOptions,
  CollectionOptions,
  GeneratedAdapter,
} from "@payloadcms/plugin-cloud-storage/types";
import type { Config } from "payload";

import { v2 as cloudinary } from "cloudinary";
import { cloudStoragePlugin } from "@payloadcms/plugin-cloud-storage";
import { initClientUploads } from '@payloadcms/plugin-cloud-storage/utilities';

import type { CloudinaryClientUploadHandlerExtra } from './client/CloudinaryClientUploadHandler';
import { getClientUploadRoute } from './getClientUploadRoute';

import path from "path";

import { getGenerateURL } from "./generateURL";
import { getHandleDelete } from "./handleDelete";
import { getHandleUpload } from "./handleUpload";
import { getHandler } from "./staticHandler";
import { generateMediaCollection } from "./collections/Media";
import { generateCustomFields } from "./collections/Media/fields/customFields";
import { cloudinaryFields } from "./collections/Media/fields/cloudinary";
import { versionFields } from "./collections/Media/fields/versions";
import type {
  CloudinaryStorageOptions,
  CloudinaryStoragePlugin,
  CloudinaryMetadata,
  CloudinaryAdapter,
  PayloadDocument,
} from "./types";

export type {
  CloudinaryStorageOptions,
  CloudinaryStoragePlugin,
  CloudinaryMetadata,
  CloudinaryAdapter,
};
export { generateMediaCollection };

// Function to check if a filename is a PDF by extension
const isPDF = (filename?: string): boolean => {
  if (!filename) return false;
  return path.extname(filename).toLowerCase() === ".pdf";
};

// Default adminThumbnail generator for PDFs
const defaultPDFThumbnailGenerator = (
  doc: PayloadDocument,
  cloudName: string,
): string => {
  if (!doc.cloudinary?.public_id) return "";
  const page = doc.cloudinary?.selected_page || 1;
  return `https://res.cloudinary.com/${cloudName}/image/upload/pg_${page},w_300,h_400,c_fill,q_auto,f_jpg/${doc.cloudinary.public_id}.pdf`;
};

export const cloudinaryStorage: CloudinaryStoragePlugin =
  (cloudinaryOptions: CloudinaryStorageOptions) =>
  (incomingConfig: Config): Config => {
    if (cloudinaryOptions.enabled === false) {
      return incomingConfig;
    }

    const adapter = cloudinaryStorageInternal(cloudinaryOptions);

    // Ensure collections is always an object (defensive handling)
    const pluginCollections = cloudinaryOptions.collections || {};

    // Add adapter to each collection option object
    const collectionsWithAdapter: CloudStoragePluginOptions["collections"] =
      Object.entries(pluginCollections).reduce(
        (acc, [slug, collOptions]) => ({
          ...acc,
          [slug]: {
            ...(collOptions === true ? {} : collOptions),
            adapter,
          },
        }),
        {} as Record<string, CollectionOptions>,
      );

    // Create a new config with our modifications
    const config = {
      ...incomingConfig,
      collections: (incomingConfig.collections || []).map((collection) => {
        // Check if this collection is one we should apply Cloudinary to
        const shouldApplyCloudinary =
          !!collectionsWithAdapter[
            collection.slug as keyof typeof collectionsWithAdapter
          ];

        if (!shouldApplyCloudinary) {
          return collection;
        }

        // First, modify the upload configuration to disable local storage
        const modifiedCollection = {
          ...collection,
          upload: {
            ...(typeof collection.upload === "object" ? collection.upload : {}),
            disableLocalStorage: true,
          },
        };

        // Add PDF thumbnail support if this is an upload collection
        if (modifiedCollection.upload) {
          const uploadConfig = modifiedCollection.upload;

          // If no adminThumbnail specified, or we specifically enable PDF thumbnails
          if (
            !uploadConfig.adminThumbnail ||
            cloudinaryOptions.enablePDFThumbnails !== false
          ) {
            modifiedCollection.upload = {
              ...uploadConfig,
              // Set custom adminThumbnail function that handles PDFs
              adminThumbnail: ({ doc }) => {
                const document = doc as PayloadDocument;

                // For PDFs, return a Cloudinary-generated thumbnail
                if (
                  isPDF(document.filename) &&
                  document.cloudinary?.public_id
                ) {
                  return defaultPDFThumbnailGenerator(
                    document,
                    cloudinaryOptions.config.cloud_name,
                  );
                }

                // For other types, use existing adminThumbnail if defined
                if (typeof uploadConfig.adminThumbnail === "function") {
                  return uploadConfig.adminThumbnail({ doc });
                }

                if (
                  typeof uploadConfig.adminThumbnail === "string" &&
                  document.sizes?.[uploadConfig.adminThumbnail]
                ) {
                  return document.sizes[uploadConfig.adminThumbnail].url;
                }

                // Default to secure_url from Cloudinary
                return document.cloudinary?.secure_url || "";
              },
            };
          }
        }

        // Generate all fields we need to add
        const customFields = generateCustomFields(
          cloudinaryOptions.customFields || [],
        );
        const versionFieldsToAdd =
          cloudinaryOptions.versioning?.enabled &&
          cloudinaryOptions.versioning?.storeHistory
            ? versionFields
            : [];

        // Make sure fields is an array
        modifiedCollection.fields = modifiedCollection.fields || [];

        // Add our fields to the collection
        modifiedCollection.fields = [
          ...modifiedCollection.fields,
          ...customFields,
          ...cloudinaryFields, // Always add Cloudinary fields
          ...versionFieldsToAdd,
        ];

        // Add afterChange hook for client upload metadata persistence.
        // When clientUploads is enabled, plugin-cloud-storage SKIPS calling handleUpload
        // for client-uploaded files (since the file is already on Cloudinary).
        // This hook catches those cases and persists the Cloudinary metadata that
        // would normally be saved by handleUpload.
        if (cloudinaryOptions.clientUploads) {
          const existingAfterChange = modifiedCollection.hooks?.afterChange || [];
          modifiedCollection.hooks = {
            ...modifiedCollection.hooks,
            afterChange: [
              ...existingAfterChange,
              async ({ doc, req, operation }) => {
                // Skip if this is an internal update to prevent infinite loop
                if (req.context?.skipCloudinaryClientUpload) {
                  return doc;
                }

                // Check if this came from a client upload by looking at the file's clientUploadContext
                const clientUploadContext = req.file?.clientUploadContext as { uploadResult?: any } | undefined;
                if (!clientUploadContext?.uploadResult) {
                  return doc;
                }

                // Already has cloudinary metadata (e.g., from a prior hook run)
                if (doc.cloudinary?.public_id) {
                  return doc;
                }

                const result = clientUploadContext.uploadResult;
                const isPDFFile = doc.filename && path.extname(doc.filename).toLowerCase() === '.pdf';

                const baseMetadata = {
                  public_id: result.public_id,
                  resource_type: result.resource_type,
                  format: isPDFFile ? result.format || 'pdf' : result.format,
                  secure_url: result.secure_url,
                  bytes: result.bytes,
                  created_at: result.created_at,
                  version: result.version ? String(result.version) : result.version,
                  version_id: result.version_id,
                };

                let typeSpecificMetadata: Record<string, any> = {};

                if (result.resource_type === 'video') {
                  typeSpecificMetadata = {
                    duration: result.duration,
                    width: result.width,
                    height: result.height,
                    eager: result.eager,
                  };
                } else if (isPDFFile) {
                  typeSpecificMetadata = {
                    pages: result.pages || 1,
                    selected_page: 1,
                    width: result.width,
                    height: result.height,
                    format: 'pdf',
                    thumbnail_url: `https://res.cloudinary.com/${cloudinaryOptions.config.cloud_name}/image/upload/pg_1,f_jpg,q_auto/${result.public_id}.pdf`,
                  };
                } else if (result.resource_type === 'image') {
                  typeSpecificMetadata = {
                    width: result.width,
                    height: result.height,
                  };
                }

                const cloudinaryMetadata = {
                  ...baseMetadata,
                  ...typeSpecificMetadata,
                };

                // Persist the metadata via an update call
                if (!req.context) {
                  req.context = {};
                }
                req.context.skipCloudinaryClientUpload = true;

                try {
                  await req.payload.update({
                    id: doc.id,
                    collection: collection.slug,
                    data: { cloudinary: cloudinaryMetadata },
                    depth: 0,
                    req,
                  });
                } finally {
                  delete req.context.skipCloudinaryClientUpload;
                }

                return {
                  ...doc,
                  cloudinary: cloudinaryMetadata,
                };
              },
            ],
          };
        }

        return modifiedCollection;
      }),
    };

    // Initialize client uploads only if explicitly enabled and collections are configured
    if (cloudinaryOptions.clientUploads && Object.keys(pluginCollections).length > 0) {
      initClientUploads<
        CloudinaryClientUploadHandlerExtra,
        CloudinaryStorageOptions["collections"][string]
      >({
        clientHandler:
          "payload-cloudinary/client#CloudinaryClientUploadHandler",
        collections: pluginCollections,
        config: incomingConfig,
        enabled: Boolean(cloudinaryOptions.clientUploads),
        extraClientHandlerProps: () => ({
          useCompositePrefixes: !!cloudinaryOptions.useCompositePrefixes,
        }),
        serverHandler: getClientUploadRoute({
          apiKey: cloudinaryOptions.config.api_key,
          apiSecret: cloudinaryOptions.config.api_secret,
          cloudName: cloudinaryOptions.config.cloud_name,
          folder: cloudinaryOptions.folder || 'payload-media',
          publicID: cloudinaryOptions.publicID,
          versioning: cloudinaryOptions.versioning,
        }),
        serverHandlerPath: "/cloudinary-client-upload-route",
      });
    }

    return cloudStoragePlugin({
      collections: collectionsWithAdapter,
    })(config);
  };

function cloudinaryStorageInternal({
  config,
  folder = "payload-media",
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
    });

    return {
      name: "cloudinary",
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
    };
  };
}
