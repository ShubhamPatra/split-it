import webpush from 'web-push';

// Generate VAPID keys once: webpush.generateVAPIDKeys()
// Store in .env file

export const initializeVapid = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || 'mailto:admin@split-it.app';

  if (!publicKey || !privateKey) {
    console.error('VAPID keys not configured');
    return false;
  }

  webpush.setVapidDetails(email, publicKey, privateKey);
  return true;
};
