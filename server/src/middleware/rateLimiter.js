const ipRequests = new Map();

// Tiny, zero-dependency, in-memory sliding window rate limiter
export function rateLimit({ windowMs, max, message }) {
  // Periodically clean up memory leak of idle IPs
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipRequests.entries()) {
      const active = timestamps.filter(t => now - t < windowMs);
      if (active.length === 0) {
        ipRequests.delete(ip);
      } else {
        ipRequests.set(ip, active);
      }
    }
  }, 5 * 60 * 1000); // every 5 minutes

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    if (!ipRequests.has(ip)) {
      ipRequests.set(ip, []);
    }

    const timestamps = ipRequests.get(ip);
    const activeTimestamps = timestamps.filter(t => now - t < windowMs);
    
    if (activeTimestamps.length >= max) {
      return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
    }

    activeTimestamps.push(now);
    ipRequests.set(ip, activeTimestamps);
    next();
  };
}
