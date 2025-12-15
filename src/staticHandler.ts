import type { StaticHandler } from "@payloadcms/plugin-cloud-storage/types";
import type { CollectionConfig } from "payload";
import type { v2 as cloudinaryType } from "cloudinary";

import { getFilePrefix } from "@payloadcms/plugin-cloud-storage/utilities";
import path from "path";
import { getResourceType } from "./utils";

interface Args {
  cloudinary: typeof cloudinaryType;
  collection: CollectionConfig;
  folder: string;
}

export const getHandler =
  ({ cloudinary, collection, folder }: Args): StaticHandler =>
  async (req, { params: { filename } }) => {
    try {
      const prefix = await getFilePrefix({ collection, filename, req });
      const filePath = path.posix.join(folder, prefix, filename);

      // Determine resource type based on file extension
      const fileExt = path.extname(filename).toLowerCase();
      const resourceType = getResourceType(fileExt);

      // Check if this is a request for a PDF thumbnail
      const isPdfThumbnail =
        fileExt === ".pdf" && req.url?.includes("thumbnail=true");

      // Generate the public_id - keep the extension for better identification
      // This is different from the upload behavior which removes extensions
      const publicId = filePath;

      try {
        // First, try to get the resource with the extension included
        const result = await cloudinary.api.resource(publicId, {
          resource_type: resourceType,
        });

        if (result && result.secure_url) {
          let url = result.secure_url;

          // If this is a PDF thumbnail request, add Cloudinary transformation
          if (isPdfThumbnail) {
            // Extract the base URL and add transformation for first page of PDF
            const urlParts = url.split("/upload/");
            if (urlParts.length === 2) {
              // Add transformation to extract first page as image
              url = urlParts[0] + "/upload/pg_1,f_jpg,q_auto/" + urlParts[1];
            }
          }

          const response = await fetch(url);

          if (!response.ok) {
            return new Response(null, { status: 404, statusText: "Not Found" });
          }

          const blob = await response.blob();

          const etagFromHeaders =
            req.headers.get("etag") || req.headers.get("if-none-match");
          const objectEtag = req.headers.get("etag") as string;

          if (etagFromHeaders && etagFromHeaders === objectEtag) {
            return new Response(null, {
              headers: new Headers({
                "Content-Type": blob.type,
                "Content-Length": String(blob.size),
                ETag: objectEtag,
              }),
              status: 304,
            });
          }

          // Return the blob with appropriate headers
          return new Response(blob, {
            headers: new Headers({
              "Content-Type": blob.type,
              "Content-Length": String(blob.size),
              ETag: objectEtag,
            }),
            status: 200,
          });
        }
      } catch (resourceError) {
        // If the first attempt fails, try without the extension
        try {
          const publicIdWithoutExt = filePath.replace(/\.[^/.]+$/, "");

          const fallbackResult = await cloudinary.api.resource(
            publicIdWithoutExt,
            {
              resource_type: resourceType,
            },
          );

          if (fallbackResult && fallbackResult.secure_url) {
            let url = fallbackResult.secure_url;

            // If this is a PDF thumbnail request, add Cloudinary transformation
            if (isPdfThumbnail) {
              // Extract the base URL and add transformation for first page of PDF
              const urlParts = url.split("/upload/");
              if (urlParts.length === 2) {
                // Add transformation to extract first page as image
                url = urlParts[0] + "/upload/pg_1,f_jpg,q_auto/" + urlParts[1];
              }
            }

            const response = await fetch(url);

            if (!response.ok) {
              return new Response(null, {
                status: 404,
                statusText: "Not Found",
              });
            }

            const blob = await response.blob();

            const etagFromHeaders =
              req.headers.get("etag") || req.headers.get("if-none-match");
            const objectEtag = req.headers.get("etag") as string;

            if (etagFromHeaders && etagFromHeaders === objectEtag) {
              return new Response(null, {
                headers: new Headers({
                  "Content-Type": blob.type,
                  "Content-Length": String(blob.size),
                  ETag: objectEtag,
                }),
                status: 304,
              });
            }

            // Return the blob with appropriate headers
            return new Response(blob, {
              headers: new Headers({
                "Content-Type": blob.type,
                "Content-Length": String(blob.size),
                ETag: objectEtag,
              }),
              status: 200,
            });
          }
        } catch (fallbackError) {
          // If both attempts fail, return 404
          req.payload.logger.error({
            error: fallbackError,
            message: "Resource not found in Cloudinary",
            path: filePath,
          });
          return new Response(null, { status: 404, statusText: "Not Found" });
        }
      }

      // If we get here, the resource wasn't found
      return new Response(null, { status: 404, statusText: "Not Found" });
    } catch (error) {
      req.payload.logger.error({
        error,
        message: "Error in statichandler",
        filename,
      });
      return new Response("Internal Server Error", { status: 500 });
    }
  };
