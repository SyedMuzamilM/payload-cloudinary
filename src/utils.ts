import {
  IMAGE_EXTENSIONS,
  RAW_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from "./constants";

export const getResourceType = (ext: string) => {
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (RAW_EXTENSIONS.includes(ext)) return "raw";
  return "auto"; // Default to auto for unknown types
};
