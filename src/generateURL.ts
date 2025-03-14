import type { GenerateURL } from "@payloadcms/plugin-cloud-storage/types";
import type { CloudinaryStorageOptions } from "./index";
import type { GenerateURLParams, CloudinaryGenerateURL } from "./types";

import path from "path";
import { IMAGE_EXTENSIONS, RAW_EXTENSIONS, VIDEO_EXTENSIONS } from "./constants";

interface Args {
  config: CloudinaryStorageOptions["config"];
  folder: string;
  versioning?: CloudinaryStorageOptions["versioning"];
}

const getResourceType = (ext: string): string => {
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (RAW_EXTENSIONS.includes(ext)) return "raw";
  return "auto"; // Default to auto for unknown types
};

export const getGenerateURL =
  ({ config, folder, versioning }: Args): GenerateURL => {
    const generateURL: CloudinaryGenerateURL = (params: GenerateURLParams) => {
      const { filename, prefix = "", version } = params;
      // Construct the folder path with proper handling of prefix
      const folderPath = prefix ? path.posix.join(folder, prefix) : folder;
      const filePath = path.posix.join(folderPath, filename);
      const public_id = filePath.replace(/\.[^/.]+$/, ""); // Remove file extension
      const ext = path.extname(filename).toLowerCase();
      const resourceType = getResourceType(ext);
      const baseUrl = `https://res.cloudinary.com/${config.cloud_name}`;

      // Add version to URL if versioning is enabled and version is provided
      const versionSegment = (versioning?.enabled && version) ? `/v${version}` : '';

      let url: string;
      switch (resourceType) {
        case "video":
          url = `${baseUrl}/video/upload${versionSegment}/f_auto,q_auto/${filePath}`;
          break;
        case "image":
          url = `${baseUrl}/image/upload${versionSegment}/f_auto,q_auto/${filePath}`;
          break;
        case "raw":
          url = `${baseUrl}/raw/upload${versionSegment}/${filePath}`;
          break;
        default:
          url = `${baseUrl}/auto/upload${versionSegment}/${filePath}`;
      }

      return {
        url,
        public_id
      };
    };

    // Return a function that extracts just the URL to maintain compatibility
    return (params) => generateURL(params).url;
  };


