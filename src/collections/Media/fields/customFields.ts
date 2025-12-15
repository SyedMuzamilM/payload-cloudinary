import type { Field } from "payload";

/**
 * Default custom fields that can be added to media items
 * These will be available in the admin UI and can be populated manually or via hooks
 */
export const defaultMediaCustomFields: Field[] = [];

/**
 * Generate custom fields for media collection
 * @param customFields Additional custom fields to add
 * @returns Array of fields
 */
export const generateCustomFields = (customFields?: Field[]): Field[] => {
  return [...defaultMediaCustomFields, ...(customFields || [])];
};
