import type { Field } from "payload";

export const versionFields: Field[] = [
  {
    name: "versions",
    type: "array",
    label: "Version History",
    admin: {
      description: "History of previous versions of this media file",
      readOnly: true,
    },
    fields: [
      {
        name: "version",
        type: "text",
        label: "Version Number",
        required: true,
        admin: {
          readOnly: true,
        },
      },
      {
        name: "version_id",
        type: "text",
        label: "Version ID",
        required: true,
        admin: {
          readOnly: true,
        },
      },
      {
        name: "created_at",
        type: "text",
        label: "Created At",
        required: true,
        admin: {
          readOnly: true,
        },
      },
      {
        name: "secure_url",
        type: "text",
        label: "URL",
        required: true,
        admin: {
          readOnly: true,
          description: "URL to access this version of the media",
        },
      },
    ],
  },
];
