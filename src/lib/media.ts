import { supabase } from './supabase';

export const RECIPE_PHOTO_BUCKET = 'recipe-photos';
export const AVATAR_BUCKET = 'avatars';

export function isDataUrl(value?: string | null): boolean {
  return !!value && value.startsWith('data:');
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime.startsWith('image/') ? mime : 'image/jpeg' });
}

export function compressImageFile(file: File, maxPx: number, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('image load failed'));
    };
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height * maxPx) / width);
          width = maxPx;
        } else {
          width = Math.round((width * maxPx) / height);
          height = maxPx;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = objectUrl;
  });
}

async function uploadPublic(
  bucket: string,
  path: string,
  source: string | Blob,
): Promise<string> {
  const blob = typeof source === 'string' ? dataUrlToBlob(source) : source;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function uploadRecipePhoto(
  userId: string,
  recipeId: string,
  source: string | Blob,
): Promise<string> {
  return uploadPublic(RECIPE_PHOTO_BUCKET, `${userId}/${recipeId}.jpg`, source);
}

export async function removeRecipePhoto(userId: string, recipeId: string): Promise<void> {
  await supabase.storage.from(RECIPE_PHOTO_BUCKET).remove([`${userId}/${recipeId}.jpg`]);
}

export async function uploadAvatar(userId: string, source: string | Blob): Promise<string> {
  return uploadPublic(AVATAR_BUCKET, `${userId}/avatar.jpg`, source);
}

export async function resolveRecipeImageForDb(
  userId: string,
  recipeId: string,
  imageUrl?: string,
): Promise<string | null> {
  if (!imageUrl) return null;
  if (isDataUrl(imageUrl)) {
    return uploadRecipePhoto(userId, recipeId, imageUrl);
  }
  return imageUrl;
}
