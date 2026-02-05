/**
 * Global Error Handler Middleware
 * Handles all errors in the application
 */
const errorHandler = (err, req, res, next) => {
  // Log error details
  console.error('❌ Error:', {
    message: err.message,
    code: err.code,
    path: req.path,
    method: req.method,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });

  // Determine status code
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  if (err.code === 11000) {
    statusCode = 400;
    message = 'Duplicate entry';
  }

  // Handle Strava API errors
  if (err.name === 'StravaError') {
    statusCode = err.statusCode || 500;
    message = err.message;
  }

  // Send response
  res.status(statusCode).json({
    success: false,
    message: message,
    code: err.code || 'UNKNOWN_ERROR',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details
    })
  });
};

module.exports = errorHandler;