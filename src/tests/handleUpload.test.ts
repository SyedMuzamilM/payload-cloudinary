import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { sanitizeForPublicID, generatePublicID } from "../handleUpload"; // Adjust path if necessary
import type { PublicIDOptions } from "../types";

describe("sanitizeForPublicID", () => {
  test("should replace spaces with hyphens and convert to lowercase", () => {
    expect(sanitizeForPublicID("hello world")).toBe("hello-world");
  });

  test("should keep dots and underscores, convert to lowercase", () => {
    expect(sanitizeForPublicID("file_name.with-dots.TXT")).toBe("file_name.with-dots.txt");
  });

  test("should remove leading and trailing spaces and hyphens", () => {
    expect(sanitizeForPublicID("  leading-trailing-spaces  ")).toBe("leading-trailing-spaces");
    expect(sanitizeForPublicID("-leading-hyphen")).toBe("leading-hyphen");
    expect(sanitizeForPublicID("trailing-hyphen-")).toBe("trailing-hyphen");
  });

  test("should handle special characters, replacing them with hyphens", () => {
    // Based on current sanitizeForPublicID: /[^a-z0-9_.-]/g, '-'
    expect(sanitizeForPublicID("!@#$%^&*()_+={}[]|\\:\";'<>,?/")).toBe("-_.-"); // _ . - are allowed
  });
  
  test("should convert uppercase to lowercase", () => {
    expect(sanitizeForPublicID("UPPERCASE.JPEG")).toBe("uppercase.jpeg");
  });

  test("should handle multiple consecutive special characters", () => {
    expect(sanitizeForPublicID("file!!!name&&&test.jpg")).toBe("file-name-test.jpg");
  });

  test("should return empty string if all characters are special and not allowed", () => {
    expect(sanitizeForPublicID("!@#$%^&*()")).toBe(""); 
  });
});

describe("generatePublicID", () => {
  let originalDateNow: () => number;
  const mockTimestamp = 1234567890123;
  const folderPath = "my/folder";

  beforeEach(() => {
    originalDateNow = Date.now;
    Date.now = () => mockTimestamp;
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe("publicIDOptions: enabled: false", () => {
    const publicIDOptions: PublicIDOptions = { enabled: false };

    test("filename: 'test.jpg', resourceType: 'image', keepRawExtension: false -> folder/test", () => {
      expect(generatePublicID("test.jpg", folderPath, "image", { ...publicIDOptions, keepRawExtension: false })).toBe(
        "my/folder/test"
      );
    });

    test("filename: 'test.txt', resourceType: 'raw', keepRawExtension: true -> folder/test.txt", () => {
      expect(generatePublicID("test.txt", folderPath, "raw", { ...publicIDOptions, keepRawExtension: true })).toBe(
        "my/folder/test.txt"
      );
    });
    
    test("filename: 'Test File.pdf', resourceType: 'raw', keepRawExtension: true -> folder/test-file.pdf", () => {
      expect(generatePublicID("Test File.pdf", folderPath, "raw", { ...publicIDOptions, keepRawExtension: true })).toBe(
        "my/folder/test-file.pdf"
      );
    });

    test("filename: 'test.jpg', resourceType: 'image', keepRawExtension: true (ignored) -> folder/test", () => {
      expect(generatePublicID("test.jpg", folderPath, "image", { ...publicIDOptions, keepRawExtension: true })).toBe(
        "my/folder/test"
      );
    });
  });

  describe("publicIDOptions: enabled: true (default), useFilename: true (default), uniqueFilename: true (default)", () => {
    const publicIDOptions: PublicIDOptions = { enabled: true, useFilename: true, uniqueFilename: true }; // Or simply {}

    test("filename: 'test.jpg', resourceType: 'image', keepRawExtension: false -> folder/test_timestamp", () => {
      expect(generatePublicID("test.jpg", folderPath, "image", { ...publicIDOptions, keepRawExtension: false })).toBe(
        `my/folder/test_${mockTimestamp}`
      );
    });
    
    test("filename: 'test space.jpg', resourceType: 'image', keepRawExtension: false -> folder/test-space_timestamp", () => {
      expect(generatePublicID("test space.jpg", folderPath, "image", { ...publicIDOptions, keepRawExtension: false })).toBe(
        `my/folder/test-space_${mockTimestamp}`
      );
    });

    test("filename: 'test.raw', resourceType: 'raw', keepRawExtension: true -> folder/test_timestamp.raw", () => {
      expect(generatePublicID("test.raw", folderPath, "raw", { ...publicIDOptions, keepRawExtension: true })).toBe(
        `my/folder/test_${mockTimestamp}.raw`
      );
    });
    
    test("filename: 'UPPER.RAW', resourceType: 'raw', keepRawExtension: true -> folder/upper_timestamp.RAW", () => {
      // Note: sanitizeForPublicID converts the name part to lowercase, but extension is preserved as is.
      expect(generatePublicID("UPPER.RAW", folderPath, "raw", { ...publicIDOptions, keepRawExtension: true })).toBe(
        `my/folder/upper_${mockTimestamp}.RAW` 
      );
    });

    test("filename: 'another image.png', resourceType: 'image', keepRawExtension: false -> folder/another-image_timestamp", () => {
      expect(generatePublicID("another image.png", folderPath, "image", { ...publicIDOptions, keepRawExtension: false })).toBe(
        `my/folder/another-image_${mockTimestamp}`
      );
    });
  });

  describe("publicIDOptions: enabled: true, useFilename: true, uniqueFilename: false", () => {
    const publicIDOptions: PublicIDOptions = { useFilename: true, uniqueFilename: false };

    test("filename: 'test.jpg', resourceType: 'image', keepRawExtension: false -> folder/test", () => {
      expect(generatePublicID("test.jpg", folderPath, "image", { ...publicIDOptions, keepRawExtension: false })).toBe(
        "my/folder/test"
      );
    });

    test("filename: 'test.raw', resourceType: 'raw', keepRawExtension: true -> folder/test.raw", () => {
      expect(generatePublicID("test.raw", folderPath, "raw", { ...publicIDOptions, keepRawExtension: true })).toBe(
        "my/folder/test.raw"
      );
    });
  });

  describe("publicIDOptions: enabled: true, useFilename: false", () => {
    // When useFilename is false, uniqueFilename is true by default if not specified
    const publicIDOptionsDefaultUnique: PublicIDOptions = { useFilename: false };
    const publicIDOptionsNoUnique: PublicIDOptions = { useFilename: false, uniqueFilename: false };


    test("filename: 'test.jpg', resourceType: 'image' (unique by default) -> folder/media_timestamp", () => {
      expect(generatePublicID("test.jpg", folderPath, "image", publicIDOptionsDefaultUnique)).toBe(
        `my/folder/media_${mockTimestamp}`
      );
    });
    
    test("filename: 'test.jpg', resourceType: 'image', uniqueFilename: false -> folder/media", () => {
      expect(generatePublicID("test.jpg", folderPath, "image", publicIDOptionsNoUnique)).toBe(
        `my/folder/media`
      );
    });

    test("filename: 'test.raw', resourceType: 'raw', keepRawExtension: true (ignored) -> folder/media_timestamp", () => {
      expect(generatePublicID("test.raw", folderPath, "raw", { ...publicIDOptionsDefaultUnique, keepRawExtension: true })).toBe(
        `my/folder/media_${mockTimestamp}`
      );
    });
  });
  
  describe("publicIDOptions: Custom generatePublicID function", () => {
    const customFunc = (filename: string, prefix?: string, folder?: string ) => `custom/${folder}/${prefix}/${filename}-custom`;
    const publicIDOptions: PublicIDOptions = { 
      generatePublicID: customFunc
    };

    test("should use custom function when provided", () => {
      expect(generatePublicID("my-file.zip", "base/folder/path", "raw", publicIDOptions)).toBe(
        "custom/path/base/folder/my-file.zip-custom"
      );
    });
  });
});
