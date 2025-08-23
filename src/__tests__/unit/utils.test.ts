import { describe, it, expect } from '@jest/globals';
import { getResourceType } from '../../utils';

describe('Utils', () => {
  describe('getResourceType', () => {
    it('should return "image" for image extensions', () => {
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
      
      imageExtensions.forEach(ext => {
        expect(getResourceType(ext)).toBe('image');
        expect(getResourceType(ext.toUpperCase())).toBe('image'); // Test case insensitivity
      });
    });

    it('should return "video" for video extensions', () => {
      const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv', '.mkv', '.m4v'];
      
      videoExtensions.forEach(ext => {
        expect(getResourceType(ext)).toBe('video');
        expect(getResourceType(ext.toUpperCase())).toBe('video'); // Test case insensitivity
      });
    });

    it('should return "raw" for raw file extensions', () => {
      const rawExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', 
                            '.zip', '.rar', '.7z', '.tar', '.gz', '.csv', '.json', '.xml', '.md'];
      
      rawExtensions.forEach(ext => {
        expect(getResourceType(ext)).toBe('raw');
        expect(getResourceType(ext.toUpperCase())).toBe('raw'); // Test case insensitivity
      });
    });

    it('should return "auto" for unknown extensions', () => {
      const unknownExtensions = ['.unknown', '.xyz', '.custom', ''];
      
      unknownExtensions.forEach(ext => {
        expect(getResourceType(ext)).toBe('auto');
      });
    });

    it('should handle extensions without dots', () => {
      expect(getResourceType('jpg')).toBe('auto'); // Should not match without dot
      expect(getResourceType('mp4')).toBe('auto'); // Should not match without dot
      expect(getResourceType('pdf')).toBe('auto'); // Should not match without dot
    });

    it('should handle edge cases', () => {
      expect(getResourceType('')).toBe('auto');
      expect(getResourceType('.')).toBe('auto');
      expect(getResourceType('..')).toBe('auto');
    });
  });
});