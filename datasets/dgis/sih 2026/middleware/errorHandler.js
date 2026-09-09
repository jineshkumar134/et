/**
 * Centralized Global Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  // Handle Body Parser Syntax Errors (e.g. malformed JSON)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload provided'
      }
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || (statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR');
  const message = err.message || 'An unexpected error occurred';

  // Log detailed error stack in development/non-test environment
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message
    }
  });
}

module.exports = errorHandler;
