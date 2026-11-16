import {
  cloudinaryStorage,
  generateMediaCollection,
  type CloudinaryMetadata,
  type CloudinaryStorageOptions,
} from 'payload-cloudinary';

export const plugin = cloudinaryStorage({
  config: { cloud_name: 'demo', api_key: 'key', api_secret: 'secret' },
  collections: { media: true },
  publicID: {
    generatePublicID: (filename, prefix, folder) =>
      `${folder?.toLowerCase() ?? ''}/${prefix?.toLowerCase() ?? ''}${filename.toLowerCase()}`,
  },
});

// @ts-expect-error The collection factory must retain its function type.
export const bad: symbol = generateMediaCollection;

// @ts-expect-error The collection factory's options must remain typed.
generateMediaCollection({ config: 123 });

// @ts-expect-error Re-exported options must retain their object type.
export const badOptions: CloudinaryStorageOptions = 'options';

// @ts-expect-error Re-exported metadata must retain its object type.
export const badMetadata: CloudinaryMetadata = 'metadata';
