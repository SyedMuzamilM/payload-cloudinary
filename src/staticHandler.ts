import type { StaticHandler } from "@payloadcms/plugin-cloud-storage/types";
import type { CollectionConfig } from "payload";
import type { v2 as cloudinaryType } from "cloudinary";

import { getFilePrefix } from "@payloadcms/plugin-cloud-storage/utilities";
import path from "path";
import { getResourceType } from "./utils";
import { CloudinaryResourceError, defaultLogger, handleError, type Logger } from "./errors";

interface Args {
  cloudinary: typeof cloudinaryType;
  collection: CollectionConfig;
  folder: string;
  logger?: Logger;
}

/**
 * Fetches resource from Cloudinary with fallback logic
 */
const fetchResource = async (
  cloudinary: typeof cloudinaryType,
  publicId: string,
  resourceType: string,
  logger: Logger
): Promise<any> => {
  const attempts = [publicId, publicId.replace(/\.[^/.]+$/, "")];
  
  for (const id of attempts) {
    try {
      logger.debug('Attempting to fetch Cloudinary resource', { publicId: id, resourceType });
      const result = await cloudinary.api.resource(id, { resource_type: resourceType });
      if (result && result.secure_url) {
        logger.debug('Successfully found Cloudinary resource', { publicId: id, url: result.secure_url });
        return result;
      }
    } catch (error) {
      logger.debug('Resource not found with this public ID', { publicId: id, error: error instanceof Error ? error.message : String(error) });
      // Continue to next attempt
    }
  }
  
  throw new CloudinaryResourceError(`Resource not found: ${publicId}`, undefined, publicId);
};

/**
 * Processes the resource URL for transformations (e.g., PDF thumbnails)
 */
const processResourceUrl = (url: string, isPdfThumbnail: boolean): string => {
  if (!isPdfThumbnail) {
    return url;
  }

  // Extract the base URL and add transformation for first page of PDF
  const urlParts = url.split('/upload/');
  if (urlParts.length === 2) {
    return urlParts[0] + '/upload/pg_1,f_jpg,q_auto/' + urlParts[1];
  }
  
  return url;
};

/**
 * Creates a response from the fetched blob with appropriate headers
 */
const createBlobResponse = (blob: Blob, etag?: string): Response => {
  const headers = new Headers({
    "Content-Type": blob.type,
    "Content-Length": String(blob.size),
    "Cache-Control": "public, max-age=31536000", // Cache for 1 year
  });

  if (etag) {
    headers.set("ETag", etag);
  }

  return new Response(blob, {
    headers,
    status: 200,
  });
};

export const getHandler =
  ({ cloudinary, collection, folder, logger = defaultLogger }: Args): StaticHandler =>
  async (req, { params: { filename } }) => {
    try {
      logger.debug('Processing static file request', { filename, collection: collection.slug });
      
      const prefix = await getFilePrefix({ collection, filename, req });
      const filePath = path.posix.join(folder, prefix, filename);

      // Determine resource type based on file extension
      const fileExt = path.extname(filename).toLowerCase();
      const resourceType = getResourceType(fileExt);
      
      // Check if this is a request for a PDF thumbnail
      const isPdfThumbnail = fileExt === '.pdf' && req.url?.includes('thumbnail=true');
      
      // Generate the public_id
      const publicId = filePath;

      const result = await fetchResource(cloudinary, publicId, resourceType, logger);
      
      // Process URL for any transformations
      const processedUrl = processResourceUrl(result.secure_url, isPdfThumbnail);
      
      logger.debug('Fetching processed resource', { processedUrl });
      
      const response = await fetch(processedUrl);
      
      if (!response.ok) {
        logger.warn('Failed to fetch resource from processed URL', { 
          processedUrl, 
          status: response.status,
          statusText: response.statusText 
        });
        return new Response(null, { status: 404, statusText: "Not Found" });
      }
      
      const blob = await response.blob();
      
      // Handle ETag for caching
      const clientEtag = req.headers.get("if-none-match");
      const responseEtag = response.headers.get("etag") || `"${Date.now()}"`;
      
      if (clientEtag === responseEtag) {
        logger.debug('Returning 304 Not Modified for cached resource', { filename, etag: responseEtag });
        return new Response(null, {
          headers: new Headers({
            "Content-Type": blob.type,
            "ETag": responseEtag,
          }),
          status: 304,
        });
      }
      
      logger.info('Successfully served static file', { 
        filename, 
        size: blob.size, 
        type: blob.type 
      });
      
      return createBlobResponse(blob, responseEtag);
      
    } catch (error) {
      if (error instanceof CloudinaryResourceError) {
        logger.warn('Resource not found', { filename, error: error.message });
        return new Response(null, { status: 404, statusText: "Not Found" });
      }

      const handledError = handleError(error, logger, 'staticHandler');
      logger.error('Error in static handler', { 
        filename, 
        error: handledError.toLogObject() 
      });
      
      return new Response("Internal Server Error", { status: 500 });
    }
  };
