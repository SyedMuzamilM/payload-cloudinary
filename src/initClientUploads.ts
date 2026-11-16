import type { Config, PayloadHandler } from 'payload'

/**
 * Local copy of `@payloadcms/plugin-cloud-storage`'s `initClientUploads`.
 *
 * Vendored so client uploads work even when the installed
 * `@payloadcms/plugin-cloud-storage` version does not re-export this utility
 * (older 3.x builds, or Payload 4 canaries that moved to uploadInstructions).
 */
export const initClientUploads = <
  ExtraProps extends Record<string, unknown>,
  T,
>({
  clientHandler,
  collections,
  config,
  enabled,
  extraClientHandlerProps,
  serverHandler,
  serverHandlerPath,
}: {
  /** Path to clientHandler component */
  clientHandler: string
  collections: Record<string, T>
  config: Config
  enabled: boolean
  /** Extra props to pass to the client handler */
  extraClientHandlerProps?: (collection: T) => ExtraProps
  serverHandler: PayloadHandler
  serverHandlerPath: string
}): void => {
  if (enabled) {
    if (!config.endpoints) {
      config.endpoints = []
    }

    /**
     * Tracks how many times the same handler was already applied.
     * This allows applying the same plugin multiple times (e.g. different folders).
     */
    let handlerCount = 0

    for (const endpoint of config.endpoints) {
      // Match on 'path', 'path-1', 'path-2', etc.
      if (endpoint.path?.startsWith(serverHandlerPath)) {
        handlerCount++
      }
    }

    if (handlerCount) {
      serverHandlerPath = `${serverHandlerPath}-${handlerCount}`
    }

    config.endpoints.push({
      handler: serverHandler,
      method: 'post',
      path: serverHandlerPath,
    })
  }

  if (!config.admin) {
    config.admin = {}
  }

  if (!config.admin.dependencies) {
    config.admin.dependencies = {}
  }

  // Keep the client handler in the import map even when disabled, to avoid
  // import map discrepancies between environments.
  config.admin.dependencies[clientHandler] = {
    type: 'function',
    path: clientHandler,
  }

  if (!config.admin.components) {
    config.admin.components = {}
  }

  if (!config.admin.components.providers) {
    config.admin.components.providers = []
  }

  for (const collectionSlug in collections) {
    const collection = collections[collectionSlug]

    let collectionPrefix: string | undefined

    if (
      collection &&
      typeof collection === 'object' &&
      'prefix' in collection &&
      typeof collection.prefix === 'string'
    ) {
      collectionPrefix = collection.prefix
    }

    config.admin.components.providers.push({
      clientProps: {
        collectionSlug,
        enabled,
        extra: extraClientHandlerProps
          ? extraClientHandlerProps(collection!)
          : undefined,
        prefix: collectionPrefix,
        serverHandlerPath,
      },
      path: clientHandler,
    })
  }
}
