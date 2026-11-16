import type { CollectionConfig, Field } from "payload";
import { cloudinaryFields } from "./fields/cloudinary.js";
import { versionFields } from "./fields/versions.js";
import {
  generateCustomFields,
  defaultMediaCustomFields,
} from "./fields/customFields.js";
import type { CloudinaryStorageOptions } from "../../types.js";

export const generateMediaCollection = (
  cloudinaryOptions: CloudinaryStorageOptions,
  collectionConfig: Partial<CollectionConfig> = {},
): CollectionConfig => {
  // Get custom fields from collection config or options
  const customFields =
    (collectionConfig.fields as Field[] | undefined) ||
    (cloudinaryOptions.customFields as Field[] | undefined) ||
    [];

  // Generate all fields
  const fields: Field[] = [
    ...generateCustomFields(customFields),
    ...cloudinaryFields,
    ...(cloudinaryOptions.versioning?.enabled &&
    cloudinaryOptions.versioning?.storeHistory
      ? versionFields
      : []),
  ];

  return {
    ...collectionConfig,
    slug: "media",
    upload: {
      ...(typeof collectionConfig.upload === "object"
        ? collectionConfig.upload
        : {}),
      disableLocalStorage: true,
    },
    fields,
    admin: {
      ...(collectionConfig.admin || {}),
      description: "Cloudinary storage with versioning support",
      useAsTitle: "filename",
    },
  };
};
