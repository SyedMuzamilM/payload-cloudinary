import type { CollectionConfig, Field } from "payload";
import { cloudinaryFields } from "./fields/cloudinary";
import { versionFields } from "./fields/versions";
import {
  generateCustomFields,
  defaultMediaCustomFields,
} from "./fields/customFields";
import type { CloudinaryStorageOptions } from "../../types";

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
