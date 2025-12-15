import type { CollectionBeforeReadHook } from "payload";

/**
 * This hook constructs the proper URL for accessing the file through Payload's API
 * It uses the server URL, collection slug, and Cloudinary public ID to create the URL
 *
 * @param {Object} params - The hook parameters
 * @param {Object} params.doc - The document being read
 * @param {Object} params.req - The request object
 * @param {Object} params.collection - The collection configuration
 * @returns {Object} The document with updated URL
 */
export const beforeRead: CollectionBeforeReadHook = async ({
  doc,
  req,
  collection,
}) => {
  try {
    // Check if we have Cloudinary metadata
    if (!doc?.cloudinary) {
      console.warn(
        "Payload Cloudinary: No Cloudinary metadata found for document:",
        doc.id,
      );
      return doc;
    }

    // Extract necessary data from Cloudinary metadata
    const { public_id, format } = doc.cloudinary;
    if (!public_id || !format) {
      console.warn("Payload Cloudinary: Missing required Cloudinary metadata", {
        id: doc.id,
        public_id,
        format,
      });
      return doc;
    }

    // Get server URL from config
    const serverURL = req.payload.config?.serverURL?.replace(/\/$/, ""); // Remove trailing slash if present
    if (!serverURL) {
      console.warn("Payload Cloudinary: No server URL found in config");
      // Fallback to relative URL if no server URL is configured
      doc.url = `/${collection.slug}/file/${public_id}.${format}`;
      return doc;
    }

    // Construct the full URL
    const filename = public_id.toLowerCase().endsWith(`.${format}`)
      ? public_id
      : `${public_id}.${format}`;
    doc.url = `${serverURL}/${collection.slug}/file/${filename}`;

    return doc;
  } catch (error) {
    console.error("Payload Cloudinary Error in beforeRead hook:", error);
    // Return original document if there's an error
    return doc;
  }
};
