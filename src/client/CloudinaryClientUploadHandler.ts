'use client'

import { createClientUploadHandler } from '@payloadcms/plugin-cloud-storage/client'

export type CloudinaryClientUploadHandlerExtra = {
  useCompositePrefixes: boolean
}

export const CloudinaryClientUploadHandler =
  createClientUploadHandler<CloudinaryClientUploadHandlerExtra>({
    handler: async ({
      apiRoute,
      collectionSlug,
      docPrefix,
      extra: { useCompositePrefixes = false },
      file,
      prefix,
      serverHandlerPath,
      serverURL,
      updateFilename,
    }) => {
      // Remove trailing slash from serverURL and apiRoute
      const safeServerURL = serverURL.replace(/\/$/, '')
      const safeApiRoute = apiRoute.replace(/^\/|\/$/g, '')
      const safeHandlerPath = serverHandlerPath.replace(/^\//, '')
      
      const endpointRoute = `${safeServerURL}/${safeApiRoute}/${safeHandlerPath}`

      // Step 1: Get signed upload parameters from our server
      const signatureResponse = await fetch(endpointRoute, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          collectionSlug,
          docPrefix,
          filename: file.name,
          filesize: file.size,
          mimeType: file.type,
        }),
      })

      if (!signatureResponse.ok) {
        const { errors } = (await signatureResponse.json()) as {
          errors: { message: string }[]
        }
        throw new Error(errors.reduce((acc, err) => `${acc ? `${acc}, ` : ''}${err.message}`, ''))
      }

      const {
        signature,
        timestamp,
        apiKey,
        cloudName,
        publicId,
        resourceType,
        uploadUrl,
        uploadParams,
      } = (await signatureResponse.json()) as {
        signature: string
        timestamp: number
        apiKey: string
        cloudName: string
        publicId: string
        resourceType: string
        uploadUrl: string
        uploadParams: Record<string, any>
      }

      // Step 2: Upload directly to Cloudinary using the signed params
      const formData = new FormData()
      formData.append('file', file)

      // Use apiKey from server response — no need for NEXT_PUBLIC_CLOUDINARY_API_KEY env var
      formData.append('api_key', apiKey)
      formData.append('signature', signature)

      // Append all signed params to the upload (Cloudinary validates them against the signature)
      for (const [key, value] of Object.entries(uploadParams)) {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value))
        }
      }

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorBody = await uploadResponse.text()
        throw new Error(`Cloudinary upload failed: ${errorBody}`)
      }

      const uploadResult = (await uploadResponse.json()) as any

      // Step 3: Compute sanitized filename if it changed
      // The public_id from server may have sanitized the original filename
      const resultFilename = uploadResult.original_filename
        ? `${uploadResult.original_filename}.${uploadResult.format}`
        : file.name

      if (resultFilename !== file.name) {
        updateFilename(resultFilename)
      }

      // Step 4: Return the upload result as clientUploadContext
      // The afterChange hook on the server will extract this and persist Cloudinary metadata
      return { 
        prefix: docPrefix || '', 
        publicId: uploadResult.public_id,
        uploadResult,
      }
    },
  })
