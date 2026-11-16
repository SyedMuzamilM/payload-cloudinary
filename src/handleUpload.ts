import type { HandleUpload } from "@payloadcms/plugin-cloud-storage/types";
import type { CollectionConfig } from "payload";
import type { v2 as cloudinaryType } from "cloudinary";
import type { UploadApiOptions } from "cloudinary";
import type { CloudinaryVersioningOptions, PublicIDOptions } from "./types";

import path from "path";
import stream from "stream";
import { getResourceType } from "./utils";
import { sanitizeForPublicID, generatePublicID } from "./publicID";

interface Args {
  cloudinary: typeof cloudinaryType;
  collection: CollectionConfig;
  folder: string;
  prefix?: string;
  versioning?: CloudinaryVersioningOptions;
  publicID?: PublicIDOptions;
}

const getUploadOptions = (
  filename: string,
  versioning?: CloudinaryVersioningOptions,
): UploadApiOptions => {
  const ext = path.extname(filename).toLowerCase();
  const resourceType = getResourceType(ext);
  // Debug: Log PDF detection
  if (ext === ".pdf") {
    console.log(
      `[payload-cloudinary] PDF detected: ${filename}, resourceType: ${resourceType}`,
    );
  }
  const baseOptions: UploadApiOptions = {
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    // If versioning is enabled, add invalidate option
    ...(versioning?.autoInvalidate && { invalidate: true }),
  };

  switch (resourceType) {
    case "video":
      return {
        ...baseOptions,
        chunk_size: 6000000,
        eager: [{ format: ext.slice(1), quality: "auto" }],
        eager_async: true,
      };
    case "image":
      // For PDFs, add a pages parameter to count the pages and create a thumbnail
      if (ext === ".pdf") {
        const pdfOptions: UploadApiOptions = {
          ...baseOptions,
          resource_type: "image", // Force image type for PDFs
          use_filename: true,
          // When uploading PDFs, add a parameter to extract page count
          pages: true,
          // Set an eager transformation to create a thumbnail of first page
          // For PDFs uploaded as images, use page parameter (not pg_)
          eager: [{ format: "jpg", page: 1, quality: "auto" }],
          eager_async: true,
        };
        console.log(
          "[payload-cloudinary] PDF upload options:",
          JSON.stringify(pdfOptions, null, 2),
        );
        return pdfOptions;
      }
      return {
        ...baseOptions,
        eager: [{ quality: "auto" }],
        eager_async: true,
      };
    case "raw":
      return {
        ...baseOptions,
        resource_type: "raw",
        use_filename: true,
      };
    default:
      return baseOptions;
  }
};


/**
 * Check if a file is a PDF based on its file extension
 */
const isPDF = (filename: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".pdf";
};

/**
 * Get PDF page count from Cloudinary
 * This is a separate function to avoid async/await linter issues
 */
const getPDFPageCount = async (
  cloudinary: typeof cloudinaryType,
  publicId: string,
  defaultCount = 1,
): Promise<number> => {
  try {
    // PDFs are stored as images in Cloudinary, not raw
    const pdfInfo = await cloudinary.api.resource(publicId, {
      resource_type: "image",
      pages: true,
    });

    if (pdfInfo && pdfInfo.pages) {
      return pdfInfo.pages;
    }
  } catch (error) {
    console.error("Error getting PDF page count:", error);
  }

  return defaultCount;
};

export const getHandleUpload =
  ({
    cloudinary,
    folder,
    prefix = "",
    versioning,
    publicID,
  }: Args): HandleUpload =>
  async ({ data, file, clientUploadContext }) => {
    // Construct the folder path with proper handling of prefix
    const folderPath = data.prefix
      ? path.posix.join(folder, data.prefix)
      : path.posix.join(folder, prefix);

    // Generate the public ID based on options
    const publicIdValue = generatePublicID(file.filename, folderPath, publicID);

    // Basic upload options
    const uploadOptions: UploadApiOptions = {
      ...getUploadOptions(file.filename, versioning),
      public_id: publicIdValue,
      use_filename: publicID?.useFilename !== false,
      unique_filename: publicID?.uniqueFilename !== false,
      asset_folder: folderPath,
    };

    const processUploadResult = async (result: any) => {
      const isPDFFile = isPDF(file.filename);
      const baseMetadata = {
        public_id: result.public_id,
        resource_type: result.resource_type,
        format: isPDFFile ? result.format || "pdf" : result.format,
        secure_url: result.secure_url,
        bytes: result.bytes,
        created_at: result.created_at,
        version: result.version ? String(result.version) : result.version,
        version_id: result.version_id,
      };

      let typeSpecificMetadata = {};

      if (result.resource_type === "video") {
        typeSpecificMetadata = {
          duration: result.duration,
          width: result.width,
          height: result.height,
          eager: result.eager,
        };
      } else if (isPDFFile) {
        let pageCount = 1;
        if (result.pages) {
          pageCount = result.pages;
        } else {
          pageCount = await getPDFPageCount(cloudinary, result.public_id);
        }

        const publicId = result.public_id.endsWith(".pdf")
          ? result.public_id
          : `${result.public_id}.pdf`;

        typeSpecificMetadata = {
          pages: pageCount,
          selected_page: 1,
          width: result.width,
          height: result.height,
          format: result.format || "pdf",
          thumbnail_url: `https://res.cloudinary.com/${cloudinary.config().cloud_name}/image/upload/pg_1,f_jpg,q_auto/${publicId}`,
        };
      } else if (result.resource_type === "image") {
        typeSpecificMetadata = {
          width: result.width,
          height: result.height,
        };
      }

      const finalMetadata = {
        ...baseMetadata,
        ...typeSpecificMetadata,
      };
      if (isPDFFile) {
        finalMetadata.format = "pdf";
      }
      data.cloudinary = finalMetadata;

      if (versioning?.enabled && versioning?.storeHistory) {
        data.versions = data.versions || [];
        data.versions.push({
          version: result.version ? String(result.version) : "",
          version_id: result.version_id || "",
          created_at: result.created_at || new Date().toISOString(),
          secure_url: result.secure_url || "",
        });
      }
      return data;
    };

    // If file was uploaded on the client, skip upload and process result
    if (clientUploadContext && typeof clientUploadContext === 'object' && 'uploadResult' in clientUploadContext) {
      const { uploadResult } = clientUploadContext as { uploadResult: any };
      return await processUploadResult(uploadResult);
    }

    return new Promise((resolve, reject) => {
      try {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          async (error, result) => {
            if (error) {
              console.error("Error uploading to Cloudinary:", error);
              reject(error);
              return;
            }

            if (result) {
              try {
                const processedData = await processUploadResult(result);
                resolve(processedData);
              } catch (err) {
                reject(err);
              }
            } else {
              resolve(data);
            }
          },
        );

        // Create readable stream from buffer or file
        const readableStream = new stream.Readable();
        readableStream.push(file.buffer);
        readableStream.push(null);

        // Pipe the readable stream to the upload stream
        readableStream.pipe(uploadStream);
      } catch (error) {
        console.error("Error in upload process:", error);
        reject(error);
      }
    });
  };
