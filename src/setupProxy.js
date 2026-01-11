const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Set COOP header to allow postMessage for dev server HMR
  // This fixes: "Cross-Origin-Opener-Policy policy would block the window.postMessage call"
  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    next();
  });

  // Proxy API requests to the backend server
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.REACT_APP_API_URL || 'http://localhost:5000',
      changeOrigin: true,
    })
  );

  // Proxy Socket.IO requests
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: process.env.REACT_APP_API_URL || 'http://localhost:5000',
      changeOrigin: true,
      ws: true,
    })
  );
};
