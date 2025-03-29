# Payload CMS Cloudinary Plugin

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

## Media Collection Structure

When using this plugin, your media documents will include the following metadata:

```typescript
{
  // Standard PayloadCMS fields
  id: '12345',
  filename: 'example.jpg',
  // ...
  
  // Custom fields (if added)
  alt: 'Example image',
  caption: 'This is an example image',
  tags: [{ tag: 'example' }],
  
  // Cloudinary metadata
  cloudinary: {
    public_id: 'your-folder/example_20230101120000',
    resource_type: 'image',
    format: 'jpg',
    secure_url: 'https://res.cloudinary.com/your-cloud/image/upload/your-folder/example_20230101120000.jpg',
    bytes: 12345,
    created_at: '2023-01-01T12:00:00Z',
    width: 800,
    height: 600,
    version: '1234567890',
    version_id: 'a1b2c3d4'
  },
  
  // Version history (if versioning.storeHistory is true)
  versions: [
    {
      version: '1234567890',
      version_id: 'a1b2c3d4',
      created_at: '2023-01-01T12:00:00Z',
      secure_url: 'https://res.cloudinary.com/your-cloud/image/upload/v1234567890/your-folder/example_20230101120000.jpg'
    }
  ]
}
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