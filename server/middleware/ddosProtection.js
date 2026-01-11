import redis from '../config/redis.js';

// Check if request is from localhost (handles both IPv4 and IPv6)
const isLocalhost = (ip) => {
  return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip?.includes('localhost');
};

export const ddosProtection = async (req, res, next) => {
  // Skip DDoS protection in development for localhost
  if (process.env.NODE_ENV === 'development' && isLocalhost(req.ip)) {
    return next();
  }
  
  const ip = req.ip;
  const key = `ddos:${ip}`;
  
  const requests = await redis.incr(key);
  
  if (requests === 1) {
    await redis.expire(key, 1); // 1 second window
  }
  
  if (requests > 50) { // 50 requests per second
    res.setHeader('Retry-After', '1');
    return res.status(429).json({ 
      message: 'Too many requests. Please wait 1 second.',
      retryAfter: 1,
    });
  }
  
  next();
};
