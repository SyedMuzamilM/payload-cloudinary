import type { StaticHandler } from "@payloadcms/plugin-cloud-storage/types";
import type { CollectionConfig, PayloadRequest } from "payload";
import type { v2 as cloudinaryType } from "cloudinary";

import path from "path";
import { getResourceType } from "./utils";

type CloudinaryMetadata = {
  format?: string;
  public_id?: string;
  resource_type?: string;
};

type MatchedDoc = {
  cloudinary?: CloudinaryMetadata;
  prefix?: string;
};

interface Args {
  cloudinary: typeof cloudinaryType;
  collection: CollectionConfig;
  folder: string;
}

const resolveDocByFilename = async ({
  collection,
  filename,
  req,
}: {
  collection: CollectionConfig;
  filename: string;
  req: PayloadRequest;
}): Promise<MatchedDoc | undefined> => {
  const imageSizes =
    typeof collection.upload === "object"
      ? collection.upload.imageSizes || []
      : [];

  const result = await req.payload.find({
    collection: collection.slug,
    depth: 0,
    limit: 1,
    pagination: false,
    where: {
      or: [
        {
          filename: {
            equals: filename,
          },
        },
        ...imageSizes.map((imageSize) => ({
          [`sizes.${imageSize.name}.filename`]: {
            equals: filename,
          },
        })),
      ],
    },
  });

  return result?.docs?.[0] as MatchedDoc | undefined;
};

const applyPDFThumbnailTransformation = ({
  isPDFThumbnail,
  url,
}: {
  isPDFThumbnail: boolean;
  url: string;
}): string => {
  if (!isPDFThumbnail) return url;

  const urlParts = url.split("/upload/");
  if (urlParts.length !== 2) return url;

  return `${urlParts[0]}/upload/pg_1,f_jpg,q_auto/${urlParts[1]}`;
};

const createProxyResponse = async ({
  req,
  url,
}: {
  req: PayloadRequest;
  url: string;
}): Promise<Response | null> => {
  const response = await fetch(url);

  if (!response.ok) return null;

  const blob = await response.blob();
  const objectEtag = response.headers.get("etag") || "";
  const etagFromHeaders =
    req.headers.get("if-none-match") || req.headers.get("etag");

  if (etagFromHeaders && objectEtag && etagFromHeaders === objectEtag) {
    return new Response(null, {
      headers: new Headers({
        "Content-Length": String(blob.size),
        "Content-Type": blob.type,
        ETag: objectEtag,
      }),
      status: 304,
    });
  }

  return new Response(blob, {
    headers: new Headers({
      "Content-Length": String(blob.size),
      "Content-Type": blob.type,
      ...(objectEtag ? { ETag: objectEtag } : {}),
    }),
    status: 200,
  });
};

export const getHandler =
  ({ cloudinary, collection, folder }: Args): StaticHandler =>
  async (req, { params: { filename } }) => {
    try {
      const fileExt = path.extname(filename).toLowerCase();
      const inferredResourceType = getResourceType(fileExt);
      const isPDFThumbnail =
        fileExt === ".pdf" && !!req.url?.includes("thumbnail=true");

      const matchedDoc = await resolveDocByFilename({
        collection,
        filename,
        req,
      });

      const fallbackPath = path.posix.join(
        folder,
        matchedDoc?.prefix || "",
        filename,
      );
      const publicIDCandidates = new Set<string>([
        fallbackPath,
        fallbackPath.replace(/\.[^/.]+$/, ""),
      ]);

      const docPublicID = matchedDoc?.cloudinary?.public_id;
      if (docPublicID) {
        publicIDCandidates.add(docPublicID);

        if (fileExt && !docPublicID.toLowerCase().endsWith(fileExt)) {
          publicIDCandidates.add(`${docPublicID}${fileExt}`);
        }

        if (fileExt && docPublicID.toLowerCase().endsWith(fileExt)) {
          publicIDCandidates.add(docPublicID.slice(0, -fileExt.length));
        }
      }

      const resourceTypeCandidates = Array.from(
        new Set<string>([
          matchedDoc?.cloudinary?.resource_type || "",
          inferredResourceType,
        ]).values(),
      ).filter(Boolean);

      for (const publicID of publicIDCandidates) {
        for (const resourceType of resourceTypeCandidates) {
          try {
            const result = await cloudinary.api.resource(publicID, {
              resource_type: resourceType,
            });

            if (!result?.secure_url) continue;

            const transformedURL = applyPDFThumbnailTransformation({
              isPDFThumbnail,
              url: result.secure_url,
            });

            const proxiedResponse = await createProxyResponse({
              req,
              url: transformedURL,
            });

            if (proxiedResponse) {
              return proxiedResponse;
            }
          } catch {
            // Try next candidate.
          }
        }
      }

      req.payload.logger.error({
        filename,
        message: "Resource not found in Cloudinary",
        triedPublicIDs: Array.from(publicIDCandidates),
      });

      return new Response(null, { status: 404, statusText: "Not Found" });
    } catch (error) {
      req.payload.logger.error({
        error,
        filename,
        message: "Error in statichandler",
      });
      return new Response("Internal Server Error", { status: 500 });
    }
  };
