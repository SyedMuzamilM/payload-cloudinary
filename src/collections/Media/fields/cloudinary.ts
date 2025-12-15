import type { Field } from "payload";

export const cloudinaryFields: Field[] = [
  {
    name: "cloudinary",
    type: "group",
    admin: {
      description: "Cloudinary Media Information",
      condition: (data) => !!data?.cloudinary,
    },
    fields: [
      {
        name: "public_id",
        type: "text",
        label: "Public ID",
        admin: {
          description: "Cloudinary Public ID (used for transformations)",
          readOnly: true,
        },
      },
      {
        name: "resource_type",
        type: "text",
        label: "Resource Type",
        admin: {
          description: "Type of the resource (image, video, raw)",
          readOnly: true,
        },
      },
      {
        name: "format",
        type: "text",
        label: "Format",
        admin: {
          description: "File format",
          readOnly: true,
        },
      },
      {
        name: "secure_url",
        type: "text",
        label: "Secure URL",
        admin: {
          description: "Secure delivery URL",
          readOnly: true,
        },
      },
      {
        name: "bytes",
        type: "number",
        label: "Size (bytes)",
        admin: {
          description: "File size in bytes",
          readOnly: true,
        },
      },
      {
        name: "created_at",
        type: "text",
        label: "Created At",
        admin: {
          description: "Creation timestamp",
          readOnly: true,
        },
      },
      {
        name: "version",
        type: "text",
        label: "Version",
        admin: {
          description: "Current version number",
          readOnly: true,
        },
      },
      {
        name: "version_id",
        type: "text",
        label: "Version ID",
        admin: {
          description: "Unique version identifier",
          readOnly: true,
        },
      },
      {
        name: "width",
        type: "number",
        label: "Width",
        admin: {
          description: "Width in pixels",
          readOnly: true,
          condition: (data) =>
            data?.resource_type === "image" || data?.resource_type === "video",
        },
      },
      {
        name: "height",
        type: "number",
        label: "Height",
        admin: {
          description: "Height in pixels",
          readOnly: true,
          condition: (data) =>
            data?.resource_type === "image" || data?.resource_type === "video",
        },
      },
      {
        name: "duration",
        type: "number",
        label: "Duration",
        admin: {
          description: "Duration in seconds (for videos)",
          readOnly: true,
          condition: (data) => data?.resource_type === "video",
        },
      },
      {
        name: "pages",
        type: "number",
        label: "Pages",
        admin: {
          description: "Number of pages (for PDFs)",
          readOnly: true,
          condition: (data) => data?.format === "pdf",
        },
      },
      {
        name: "selected_page",
        type: "number",
        label: "Page to Display",
        admin: {
          description:
            "Which page of the PDF to use for thumbnails (changes will apply after saving)",
          condition: (data) => data?.format === "pdf",
        },
        defaultValue: 1,
        min: 1,
      },
      {
        name: "thumbnail_url",
        type: "text",
        label: "Thumbnail URL",
        admin: {
          description:
            "URL for the thumbnail image (automatically generated for PDFs)",
          readOnly: true,
          condition: (data) => data?.format === "pdf",
        },
      },
    ],
  },
];
