import type { GenerateURL } from "@payloadcms/plugin-cloud-storage/types";
import type { CloudinaryStorageOptions } from "./index";
import type { GenerateURLParams, CloudinaryGenerateURL } from "./types";

import path from "path";
import { IMAGE_EXTENSIONS, RAW_EXTENSIONS, VIDEO_EXTENSIONS } from "./constants";
import { validateCloudinaryConfig, validateFolderPath } from "./validation";
import { CloudinaryError, defaultLogger, handleError, type Logger } from "./errors";

interface Args {
  config: CloudinaryStorageOptions["config"];
  folder: string;
  versioning?: CloudinaryStorageOptions["versioning"];
  logger?: Logger;
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
  ({ config, folder, versioning, logger = defaultLogger }: Args): GenerateURL => {
    // Validate configuration once when the function is created
    try {
      validateCloudinaryConfig(config);
      validateFolderPath(folder);
    } catch (error) {
      throw handleError(error, logger, 'getGenerateURL');
    }

    const generateURL: CloudinaryGenerateURL = (params: GenerateURLParams) => {
      try {
        const { filename, prefix = "", version, pdf_page, format } = params;
        
        if (!filename || typeof filename !== 'string') {
          throw new CloudinaryError('Filename is required and must be a string', undefined, 'INVALID_FILENAME');
        }

        logger.debug('Generating Cloudinary URL', { filename, prefix, version, pdf_page, format });

        // Construct the folder path with proper handling of prefix
        const folderPath = prefix ? path.posix.join(folder, prefix) : folder;
        const filePath = path.posix.join(folderPath, filename);
        const public_id = filePath.replace(/\.[^/.]+$/, ""); // Remove file extension
        const ext = path.extname(filename).toLowerCase();
        const resourceType = getResourceType(ext);
        const baseUrl = `https://res.cloudinary.com/${config.cloud_name}`;

        // Add version to URL if versioning is enabled and version is provided
        const versionSegment = (versioning?.enabled && version) ? `/v${version}` : '';

        // Check if this is a PDF and we're requesting it as an image
        const isPDFFile = isPDF(filename);
        
        let url: string;
        
        // Special handling for PDFs when requested as images (thumbnails)
        if (isPDFFile && format === 'jpg') {
          // Use the page parameter if provided, or default to page 1
          const pageNumber = pdf_page || 1;
          url = `${baseUrl}/image/upload${versionSegment}/pg_${pageNumber},f_jpg,q_auto/${public_id}.pdf`;
        } else {
          switch (resourceType) {
            case "video":
              url = `${baseUrl}/video/upload${versionSegment}/f_auto,q_auto/${filePath}`;
              break;
            case "image":
              url = `${baseUrl}/image/upload${versionSegment}/f_auto,q_auto/${filePath}`;
              break;
            case "raw":
              // For regular raw files
              url = `${baseUrl}/raw/upload${versionSegment}/${filePath}`;
              break;
            default:
              url = `${baseUrl}/auto/upload${versionSegment}/${filePath}`;
          }
        }

        logger.debug('Generated Cloudinary URL successfully', { filename, url, public_id });

        return {
          url,
          public_id
        };
      } catch (error) {
        throw handleError(error, logger, 'generateURL');
      }
    };

    // Return a function that extracts just the URL to maintain compatibility
    return (params) => {
      try {
        return generateURL(params).url;
      } catch (error) {
        logger.error('Failed to generate URL', { params, error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    };
  };


