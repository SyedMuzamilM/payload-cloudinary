import type { GenerateURL } from "@payloadcms/plugin-cloud-storage/types";
import type { CloudinaryStorageOptions } from "./index";
import type { GenerateURLParams, CloudinaryGenerateURL } from "./types"; // Assuming CloudinaryGenerateURL might be extended or used

import path from "path";
import { IMAGE_EXTENSIONS, RAW_EXTENSIONS, VIDEO_EXTENSIONS } from "./constants";

interface Args {
  config: CloudinaryStorageOptions["config"];
  // folder: string; // No longer needed at this level due to public_id from doc
  versioning?: CloudinaryStorageOptions["versioning"];
}

const getResourceType = (ext: string): string => {
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (RAW_EXTENSIONS.includes(ext)) return "raw";
  return "auto"; // Default to auto for unknown types
};

/**
 * Check if a file is a PDF based on its file extension
 */
const isPDF = (filename: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.pdf';
};

export const getGenerateURL =
  ({ config, versioning }: Args): GenerateURL => {
    // Main function now directly takes doc and other params
    const generateURLCore = (params: GenerateURLParams & { doc: Record<string, unknown> }) => {
      const { doc, filename, prefix = "", pdf_page } = params; // Removed 'version' from here as it comes from doc

      const cloudinaryData = doc?.cloudinary as { public_id?: string; resource_type?: string; version?: string | number } | undefined;
      const public_id = cloudinaryData?.public_id;

      if (!public_id) {
        const errMessage = "Error: public_id not found on doc.cloudinary. Cannot generate URL.";
        console.error(errMessage, 'Doc:', doc);
        throw new Error(errMessage);
      }
      
      const docVersion = cloudinaryData?.version;
      const ext = path.extname(filename).toLowerCase(); // filename is still needed for extension
      const resourceTypeForURL = getResourceType(ext); // URL resource type based on extension
      const baseUrl = `https://res.cloudinary.com/${config.cloud_name}`;

      // Add version to URL if versioning is enabled and version is provided on the doc
      const versionSegment = (versioning?.enabled && docVersion) ? `/v${docVersion}` : '';

      const isPDFFile = isPDF(filename);
      
      let url: string;
      
      // Special handling for PDFs when requested as images (thumbnails)
      // Uses the public_id from doc, appends .pdf for Cloudinary to process correctly
      if (isPDFFile && params.format === 'jpg') {
        const pageNumber = pdf_page || 1;
        // Cloudinary expects the public_id and then format transformations for PDFs
        // The public_id itself should not have .pdf, but we might need to append it for the transformation
        // Assuming public_id from doc does NOT include .pdf
        url = `${baseUrl}/image/upload${versionSegment}/pg_${pageNumber},f_jpg,q_auto/${public_id}.pdf`;
      } else {
        // Construct the full path for the URL, including the filename (extension part)
        // Cloudinary's URLs often include the filename/extension after the public_id for delivery
        // The `public_id` from `doc.cloudinary` is the base identifier.
        // The `filename` (or at least its extension) is appended for correct content delivery/transformation.
        // Example: public_id = 'folder/image', filename = 'image.jpg' -> folder/image.jpg in URL
        // However, Cloudinary typically uses public_id as the unique ID, and format/resource type dictates delivery.
        // Let's assume public_id is the complete identifier without extension, and Cloudinary handles the rest.
        // If filename must be part of the URL path (e.g. public_id is 'folder/img' and URL needs 'folder/img.jpg')
        // we need to ensure public_id from doc is used correctly.
        // For now, we'll use public_id and append the extension from filename for clarity,
        // but transformations like f_auto should handle most cases.

        // Re-evaluating: Cloudinary URLs are typically <base>/<resource_type>/<delivery_type>/<transformations>/<version>/<public_id_with_folder_if_any>.<format_if_specified_or_auto>
        // The `public_id` stored in `doc.cloudinary.public_id` should be the full public ID, including any folder structure.
        // The `filename` parameter passed to generateURL might be redundant if public_id is complete.
        // However, `getResourceType` and `isPDF` depend on `filename`.

        const filePathInURL = public_id + ext; // Construct path for URL using public_id and original extension

        switch (resourceTypeForURL) {
          case "video":
            url = `${baseUrl}/video/upload${versionSegment}/f_auto,q_auto/${filePathInURL}`;
            break;
          case "image":
            url = `${baseUrl}/image/upload${versionSegment}/f_auto,q_auto/${filePathInURL}`;
            break;
          case "raw":
            url = `${baseUrl}/raw/upload${versionSegment}/${filePathInURL}`;
            break;
          default: // auto
            url = `${baseUrl}/auto/upload${versionSegment}/${filePathInURL}`;
        }
      }

      return {
        url,
        public_id // Return the authoritative public_id from doc
      };
    };

    // Adapt to the expected GenerateURL signature
    return (params: GenerateURLParams & { doc: Record<string, unknown> }) => {
      // The original GenerateURL from plugin-cloud-storage might not pass 'doc'.
      // This needs to be reconciled with how Payload calls this.
      // Assuming 'doc' will be available in params as per the new requirement.
      if (!params.doc) {
        // Fallback or error if doc is not provided - this indicates a mismatch with Payload's calling convention
        // For now, let's throw an error, as 'doc' is critical.
        const errMessage = "Error: 'doc' object was not provided to generateURL function.";
        console.error(errMessage, "Params received:", params);
        throw new Error(errMessage);
      }
      return generateURLCore(params).url;
    };
  };
