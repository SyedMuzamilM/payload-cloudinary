# Payload CMS Cloudinary Plugin

> **🚨 Version 2.0.0-alpha.1 Now Available**
>
> This alpha release introduces significant improvements to public_id handling and type safety. Key features:
> - Enhanced `public_id` access in upload responses (Beta)
> - Improved type definitions and compatibility
> - Better versioning support
>
> To try the alpha version:
> ```bash
> npm install payload-cloudinary@alpha
> # or specific version
> npm install payload-cloudinary@2.0.0-alpha.1
> ```
>
> [View full changelog and migration guide](#version-2-alpha)

A powerful plugin for [Payload CMS](https://payloadcms.com/) that integrates Cloudinary as a storage adapter for media files. This plugin allows you to seamlessly store and manage your media files on Cloudinary while using Payload CMS, with enhanced support for custom fields, public IDs, and versioning.

## Features

- 🚀 Seamless integration with Payload CMS
- 📦 Automatic file upload to Cloudinary
- 🔄 Advanced versioning support with history tracking
- 🆔 Customizable public ID generation (for better media management)
- 🏷️ Support for custom fields in media collections
- 🗑️ Automatic file deletion from Cloudinary
- 🔗 URL generation for stored files
- 📁 Customizable folder structure
- 🎛️ Static file handling
- 💾 Optional local storage disable
- 📄 PDF support with thumbnail generation

## Installation

```bash
npm install payload-cloudinary
# or 
yarn add payload-cloudinary
# or
pnpm add payload-cloudinary
# or
bun add payload-cloudinary
```

## Basic Configuration

Here's how to use the plugin in your Payload CMS configuration:

```typescript
import { buildConfig } from 'payload/config';
import { cloudinaryStorage } from 'payload-cloudinary';

export default buildConfig({
  // ... your payload config
  plugins: [
    cloudinaryStorage({
      config: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      },
      collections: {
        'media': true, // Enable for media collection
        // Add more collections as needed
      },
      folder: 'your-folder-name', // Optional, defaults to 'payload-media'
    })
  ]
});
```

## Advanced Configuration

### Custom Fields

You can add custom fields to your media collection by providing them in the plugin options:

```typescript
cloudinaryStorage({
  // ... other options
  customFields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Alt Text',
      admin: {
        description: 'Alternative text for accessibility',
      },
    },
    {
      name: 'caption',
      type: 'text',
      label: 'Caption',
    },
    {
      name: 'tags',
      type: 'array',
      label: 'Tags',
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
        },
      ],
    },
    // Add any other fields you need
  ],
})
```

#### Important: Using Custom Fields with Existing Collections

If you already have a Media collection defined in your Payload CMS project, the plugin will automatically add its fields to that collection. Make sure your collection slug exactly matches the one in your plugin configuration (`'media'` by default).

Example with an existing Media collection:

```typescript
// In your collection definition
export const Media: CollectionConfig = {
  slug: 'media', // This MUST match the slug in your plugin config
  access: {
    read: () => true,
  },
  fields: [
    // Your fields
  ],
  upload: true,
};

// In your payload.config.ts
export default buildConfig({
  // ...
  collections: [Media, Users, etc],
  plugins: [
    cloudinaryStorage({
      collections: {
        'media': true, // Matches the slug in your Media collection
      },
      customFields: [
        // Your custom fields here
      ]
    })
  ]
});
```

### Public ID Customization

Control how Cloudinary public IDs are generated to better organize your media:

```typescript
cloudinaryStorage({
  // ... other options
  publicID: {
    enabled: true, // Enable custom public ID generation
    useFilename: true, // Use the original filename in the public ID
    uniqueFilename: true, // Add a unique identifier to prevent collisions
    // Optional custom generator function
    generatePublicID: (filename, prefix, folder) => {
      // Create a sanitized slug from the filename
      const sanitizedName = filename
        .toLowerCase()
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Add timestamp for uniqueness
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const prefixPath = prefix ? `${prefix}/` : '';
      
      return `${folder}/${prefixPath}${sanitizedName}_${timestamp}`;
    },
  },
})
```

### Versioning Support

Enable versioning to keep track of file changes and history:

```typescript
cloudinaryStorage({
  // ... other options
  versioning: {
    enabled: true, // Enable versioning support
    autoInvalidate: true, // Automatically invalidate old versions in CDN
    storeHistory: true, // Store version history in PayloadCMS database
  },
})
```

### PDF Support

The plugin provides special handling for PDF files, including:

- Automatic page count detection
- Page selection for thumbnails
- Thumbnail URL generation for use in your frontend
- Support for viewing different pages of the PDF

When a PDF is uploaded, the plugin will:

1. Count the number of pages in the PDF
2. Store the page count in the `cloudinary.pages` field
3. Generate a default thumbnail of the first page
4. Allow you to select a different page to use as the thumbnail
5. Provide a `thumbnail_url` for easy use in your frontend

Example usage in a frontend component:

```jsx
const PDFViewer = ({ media }) => {
  if (!media?.cloudinary || media.cloudinary.format !== 'pdf') {
    return null;
  }
  
  const { public_id, pages, selected_page } = media.cloudinary;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const page = selected_page || 1;
  
  return (
    <div className="pdf-viewer">
      <h2>{media.filename}</h2>
      
      {/* Display the selected page as a thumbnail */}
      <a href={`https://res.cloudinary.com/${cloudName}/image/upload/${public_id}.pdf`} target="_blank">
        <img 
          src={`https://res.cloudinary.com/${cloudName}/image/upload/pg_${page},w_300,h_400,c_fill,q_auto,f_jpg/${public_id}.pdf`} 
          alt={`PDF Page ${page}`} 
        />
      </a>
      
      {/* Page navigation if there are multiple pages */}
      {pages > 1 && (
        <div className="pdf-pages">
          <p>Page {page} of {pages}</p>
          
          {/* Thumbnail grid of all pages */}
          <div className="page-thumbnails">
            {Array.from({ length: pages }).map((_, i) => (
              <img 
                key={i}
                src={`https://res.cloudinary.com/${cloudName}/image/upload/pg_${i + 1},w_100,h_130,c_fill,q_auto,f_jpg/${public_id}.pdf`} 
                alt={`Page ${i + 1}`} 
                className={i + 1 === page ? 'active' : ''}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

## Media Collection Structure

When using this plugin, your media documents will include the following metadata:

```typescript
{
  // Standard PayloadCMS fields
  id: string;
  filename: string;
  mimeType: string;
  filesize: number;
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt: string;

  // Cloudinary metadata
  cloudinary: {
    public_id: string;           // Cloudinary public ID (Beta in v2)
    resource_type: string;       // 'image', 'video', or 'raw'
    format: string;              // File extension
    secure_url: string;          // Full Cloudinary URL
    bytes: number;               // File size in bytes
    created_at: string;          // Cloudinary upload timestamp
    version: string;             // Current version number
    version_id: string;          // Current version ID
    width?: number;              // For images and videos
    height?: number;             // For images and videos
    duration?: number;           // For videos only
  };

  // Version history (if enabled)
  versions?: Array<{
    version: string;             // Version number
    version_id: string;          // Version ID
    created_at: string;          // Version creation timestamp
    secure_url: string;          // URL for this version
  }>;

  // PDF-specific fields (if applicable)
  cloudinary: {
    // ... other cloudinary fields
    pages?: number;              // Number of pages in PDF
    selected_page?: number;      // Currently selected page for thumbnail
  };

  // Your custom fields (if configured)
  alt?: string;
  caption?: string;
  tags?: Array<{ tag: string }>;
  // ... any other custom fields
}
```

### Accessing Public IDs (Beta in v2)

The `public_id` field is now directly accessible in both upload responses and document queries:

```typescript
// In upload response
const uploadResponse = await payload.create({
  collection: 'media',
  data: {
    filename: 'example.jpg',
    mimeType: 'image/jpeg',
  },
});
const publicId = uploadResponse.data.cloudinary.public_id;

// In document queries
const doc = await payload.findByID({
  collection: 'media',
  id: 'your-doc-id',
});
const publicId = doc.cloudinary.public_id;
```

### Version History

If versioning is enabled, you can access the complete version history:

```typescript
const doc = await payload.findByID({
  collection: 'media',
  id: 'your-doc-id',
});

// Access all versions
doc.versions?.forEach(version => {
  console.log(`Version ${version.version} created at ${version.created_at}`);
  console.log(`URL: ${version.secure_url}`);
});

// Access current version
console.log(`Current version: ${doc.cloudinary.version}`);
console.log(`Current version ID: ${doc.cloudinary.version_id}`);
```

## Custom Media Collection

If you want more control over your Media collection, you can use the `generateMediaCollection` utility:

```typescript
import { generateMediaCollection, cloudinaryStorage } from 'payload-cloudinary';

export default buildConfig({
  // ... your other config
  plugins: [
    // Register the plugin without a media collection
    cloudinaryStorage({
      // ... your plugin options
      collections: {}, // No collections here
    }),
  ],
  collections: [
    // Create a custom media collection
    generateMediaCollection(
      {
        config: {
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        },
        folder: 'my-payload-cms',
        publicID: {
          // Public ID options...
        },
        versioning: {
          // Versioning options...
        },
      },
      // Additional collection configuration
      {
        admin: {
          description: 'Media files stored in Cloudinary',
          group: 'Content',
        },
        hooks: {
          // Add your own hooks here
        },
      }
    ),
    // Your other collections
  ],
})
```

## Troubleshooting

### Custom Fields Not Appearing in Admin UI

If your custom fields aren't showing up in the Payload CMS admin panel:

1. **Check Collection Slug**: Ensure the collection slug in your plugin configuration matches exactly with your Media collection slug.

2. **Plugin Order**: Make sure the cloudinaryStorage plugin is registered before your collections are processed. In some cases, it might help to move the plugin earlier in your plugins array.

3. **Check for Field Conflicts**: If you already have fields with the same names in your collection, there might be conflicts. Try using different field names or debug by checking the complete list of fields after plugin initialization.

4. **Restart Your Dev Server**: Sometimes a full restart of your development server is needed after making plugin configuration changes.

5. **Debug Plugin Configuration**: You can add a temporary debug log to see what's happening:

```typescript
export default buildConfig({
  // ... your config
  onInit: async (payload) => {
    // Log the complete Media collection configuration
    console.log('Media collection fields:', 
      payload.collections['media'].config.fields.map(f => f.name)
    );
  }
});
```

## Using Cloudinary URLs in Frontend Components

Here's an example React component that uses the Cloudinary public ID for transformations:

```jsx
const CloudinaryImage = ({ media }) => {
  if (!media?.cloudinary) return null;
  
  const { public_id, format } = media.cloudinary;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  
  // You can use Cloudinary transformations in the URL
  return (
    <picture>
      <source
        media="(max-width: 640px)"
        srcSet={`https://res.cloudinary.com/${cloudName}/image/upload/w_400,c_limit,q_auto,f_auto/${public_id}.${format}`}
      />
      <source
        media="(max-width: 1024px)"
        srcSet={`https://res.cloudinary.com/${cloudName}/image/upload/w_800,c_limit,q_auto,f_auto/${public_id}.${format}`}
      />
      <img
        src={`https://res.cloudinary.com/${cloudName}/image/upload/q_auto,f_auto/${public_id}.${format}`}
        alt={media.alt || media.filename}
        loading="lazy"
      />
    </picture>
  );
};
```

## Complete Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `config` | `Object` | (required) | Cloudinary API credentials |
| `config.cloud_name` | `string` | (required) | Your Cloudinary cloud name |
| `config.api_key` | `string` | (required) | Your Cloudinary API key |
| `config.api_secret` | `string` | (required) | Your Cloudinary API secret |
| `collections` | `Object` | (required) | Collections that should use Cloudinary storage |
| `folder` | `string` | `'payload-media'` | Base folder path in Cloudinary |
| `disableLocalStorage` | `boolean` | `true` | Whether to disable local storage |
| `enabled` | `boolean` | `true` | Whether to enable the plugin |
| `customFields` | `Field[]` | `[]` | Custom fields to add to the media collection |
| `publicID` | `Object` | (see below) | Public ID configuration options |
| `publicID.enabled` | `boolean` | `true` | Whether to enable custom public ID generation |
| `publicID.useFilename` | `boolean` | `true` | Whether to use filename in public ID |
| `publicID.uniqueFilename` | `boolean` | `true` | Whether to ensure unique filenames |
| `publicID.generatePublicID` | `Function` | (built-in) | Custom function to generate public ID |
| `versioning` | `Object` | (see below) | Versioning configuration options |
| `versioning.enabled` | `boolean` | `false` | Whether to enable versioning support |
| `versioning.autoInvalidate` | `boolean` | `false` | Whether to invalidate old versions in CDN |
| `versioning.storeHistory` | `boolean` | `false` | Whether to store version history in database |

## Development

To run the project in development mode:

```bash
bun run src/index.ts
```

## Contributing

Contributions to improve the plugin are welcome. Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open-source. See the [LICENSE](LICENSE) file for more details.

## Contact

For any questions or support, please contact [Syed Muzamil](https://x.com/syedmuzamilm).