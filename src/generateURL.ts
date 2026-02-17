import type { GenerateURL } from "@payloadcms/plugin-cloud-storage/types";
import type { CloudinaryStorageOptions } from "./index";
import type { GenerateURLParams, CloudinaryGenerateURL } from "./types";

import path from "path";
import {
  IMAGE_EXTENSIONS,
  RAW_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from "./constants";

interface Args {
  config: CloudinaryStorageOptions["config"];
  folder: string;
  versioning?: CloudinaryStorageOptions["versioning"];
}

const getResourceType = (ext: string): string => {
  if (ext === ".pdf") return "image";
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
  return ext === ".pdf";
};

export const getGenerateURL = ({
  config,
  folder,
  versioning,
}: Args): GenerateURL => {
  const generateURL: CloudinaryGenerateURL = (params: GenerateURLParams) => {
    const { data, filename, prefix = "", version, pdf_page } = params;
    const cloudinaryMeta = data?.cloudinary;
    // Construct the folder path with proper handling of prefix
    const folderPath = prefix ? path.posix.join(folder, prefix) : folder;
    const filePath = path.posix.join(folderPath, filename);
    const fallbackPublicID = filePath.replace(/\.[^/.]+$/, ""); // Remove file extension
    const public_id = cloudinaryMeta?.public_id || fallbackPublicID;
    const ext = path.extname(filename).toLowerCase();
    const format = cloudinaryMeta?.format || ext.slice(1);
    const resourceType = cloudinaryMeta?.resource_type || getResourceType(ext);
    const baseUrl = `https://res.cloudinary.com/${config.cloud_name}`;

    // Add version to URL if versioning is enabled and version is provided
    const versionSegment = versioning?.enabled && version ? `/v${version}` : "";

    // Check if this is a PDF and we're requesting it as an image
    const isPDFFile = format === "pdf" || isPDF(filename);

    let url: string;

    // Special handling for PDFs when requested as images (thumbnails)
    if (isPDFFile && params.format === "jpg") {
      // Use the page parameter if provided, or default to page 1
      const pageNumber = pdf_page || 1;
      const pdfPublicID = public_id.endsWith(".pdf")
        ? public_id
        : `${public_id}.pdf`;
      url = `${baseUrl}/image/upload${versionSegment}/pg_${pageNumber},f_jpg,q_auto/${pdfPublicID}`;
    } else {
      switch (resourceType) {
        case "video":
          url = `${baseUrl}/video/upload${versionSegment}/f_auto,q_auto/${public_id}`;
          break;
        case "image":
          if (isPDFFile) {
            const pdfPublicID = public_id.endsWith(".pdf")
              ? public_id
              : `${public_id}.pdf`;
            url = `${baseUrl}/image/upload${versionSegment}/${pdfPublicID}`;
          } else {
            url = `${baseUrl}/image/upload${versionSegment}/f_auto,q_auto/${public_id}`;
          }
          break;
        case "raw":
          // For regular raw files
          url = `${baseUrl}/raw/upload${versionSegment}/${public_id}${
            public_id.endsWith(`.${format}`) ? "" : `.${format}`
          }`;
          break;
        default:
          url = `${baseUrl}/auto/upload${versionSegment}/${public_id}`;
      }
    }

    return {
      url,
      public_id,
    };
  };

  // Return a function that extracts just the URL to maintain compatibility
  return (params) => generateURL(params).url;
};
