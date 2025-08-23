export class CloudinaryError extends Error {
  constructor(
    message: string,
    public cause?: Error,
    public code?: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'CloudinaryError';
    
    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CloudinaryError);
    }
  }

  /**
   * Creates a CloudinaryError from an unknown error
   */
  static fromError(error: unknown, defaultMessage = 'Unknown error occurred'): CloudinaryError {
    if (error instanceof CloudinaryError) {
      return error;
    }

    if (error instanceof Error) {
      return new CloudinaryError(error.message, error, 'UNKNOWN_ERROR');
    }

    if (typeof error === 'string') {
      return new CloudinaryError(error, undefined, 'STRING_ERROR');
    }

    return new CloudinaryError(defaultMessage, undefined, 'UNKNOWN_ERROR');
  }

  /**
   * Returns a safe error object for logging
   */
  toLogObject(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : undefined
    };
  }
}

export class CloudinaryUploadError extends CloudinaryError {
  constructor(message: string, cause?: Error, public filename?: string) {
    super(message, cause, 'UPLOAD_ERROR', 400);
    this.name = 'CloudinaryUploadError';
  }
}

export class CloudinaryDeleteError extends CloudinaryError {
  constructor(message: string, cause?: Error, public publicId?: string) {
    super(message, cause, 'DELETE_ERROR', 400);
    this.name = 'CloudinaryDeleteError';
  }
}

export class CloudinaryResourceError extends CloudinaryError {
  constructor(message: string, cause?: Error, public resourceId?: string) {
    super(message, cause, 'RESOURCE_ERROR', 404);
    this.name = 'CloudinaryResourceError';
  }
}

export class CloudinaryAPIError extends CloudinaryError {
  constructor(message: string, cause?: Error, public apiMethod?: string) {
    super(message, cause, 'API_ERROR', 500);
    this.name = 'CloudinaryAPIError';
  }
}

/**
 * Logger interface for the plugin
 */
export interface Logger {
  error(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
}

/**
 * Default console logger implementation
 */
export const defaultLogger: Logger = {
  error: (message: string, meta?: Record<string, any>) => {
    console.error(`[Cloudinary Plugin] ERROR: ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  warn: (message: string, meta?: Record<string, any>) => {
    console.warn(`[Cloudinary Plugin] WARN: ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  info: (message: string, meta?: Record<string, any>) => {
    console.info(`[Cloudinary Plugin] INFO: ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  debug: (message: string, meta?: Record<string, any>) => {
    if (process.env.DEBUG === 'true' || process.env.DEBUG === 'cloudinary') {
      console.debug(`[Cloudinary Plugin] DEBUG: ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    }
  }
};

/**
 * Error handler that logs errors appropriately and returns safe error responses
 */
export const handleError = (error: unknown, logger: Logger = defaultLogger, context?: string): CloudinaryError => {
  const cloudinaryError = CloudinaryError.fromError(error);
  
  const logContext = {
    context,
    error: cloudinaryError.toLogObject()
  };

  // Log based on severity
  if (cloudinaryError.statusCode >= 500) {
    logger.error(`${context ? `[${context}] ` : ''}${cloudinaryError.message}`, logContext);
  } else if (cloudinaryError.statusCode >= 400) {
    logger.warn(`${context ? `[${context}] ` : ''}${cloudinaryError.message}`, logContext);
  } else {
    logger.info(`${context ? `[${context}] ` : ''}${cloudinaryError.message}`, logContext);
  }

  return cloudinaryError;
};

/**
 * Wraps async functions with error handling
 */
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string,
  logger: Logger = defaultLogger
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleError(error, logger, context);
    }
  };
};