import crypto from 'crypto';

const CLOUDINARY_API_ROOT = 'https://api.cloudinary.com/v1_1';

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
};

const detectResourceType = (mimeType = '') => {
  if (mimeType.startsWith('video/')) {
    return 'video';
  }

  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  return 'raw';
};

export const uploadBufferToCloudinary = async ({
  buffer,
  filename,
  mimeType,
  folder = 'split-it/receipts',
}) => {
  const cloudName = getRequiredEnv('CLOUDINARY_CLOUD_NAME');
  const uploadPreset = getRequiredEnv('CLOUDINARY_UPLOAD_PRESET');

  const formData = new FormData();
  const fileBlob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
  formData.append('file', fileBlob, filename || `upload-${crypto.randomUUID()}`);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);
  formData.append('resource_type', detectResourceType(mimeType));

  const response = await fetch(`${CLOUDINARY_API_ROOT}/${cloudName}/auto/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  return {
    url: data.secure_url || data.url,
    storageId: data.public_id,
    filename: filename || data.original_filename || 'receipt',
    mimeType: mimeType || data.resource_type || 'image/jpeg',
  };
};

export const deleteCloudinaryAsset = async (storageId, resourceType = 'image') => {
  if (!storageId) {
    return false;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('[Cloudinary] Delete skipped because API credentials are not configured');
    return false;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signatureBase = `public_id=${storageId}&resource_type=${resourceType}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(signatureBase).digest('hex');

  const body = new URLSearchParams({
    public_id: storageId,
    resource_type: resourceType,
    api_key: apiKey,
    timestamp: String(timestamp),
    signature,
  });

  const response = await fetch(`${CLOUDINARY_API_ROOT}/${cloudName}/${resourceType}/destroy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary delete failed: ${response.status} ${errorText}`);
  }

  return true;
};