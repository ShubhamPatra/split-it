import redis from '../config/redis.js';

export const ddosProtection = async (req, res, next) => {
  const ip = req.ip;
  const key = `ddos:${ip}`;
  
  const requests = await redis.incr(key);
  
  if (requests === 1) {
    await redis.expire(key, 1); // 1 second window
  }
  
  if (requests > 50) { // 50 requests per second
    return res.status(429).json({ message: 'Too many requests' });
  }
  
  next();
};
