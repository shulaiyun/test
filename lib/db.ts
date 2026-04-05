import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DreamMediaDB extends DBSchema {
  media: {
    key: string; // Format: `${dreamId}_${mediaType}` (e.g., '123_image', '123_audio', '123_music')
    value: {
      key: string;
      dreamId: string;
      mediaType: 'image' | 'audio' | 'music' | 'video';
      data: string; // Base64 string or Blob URL
      mimeType: string;
    };
    indexes: { 'by-dreamId': string };
  };
}

let dbPromise: Promise<IDBPDatabase<DreamMediaDB>> | null = null;

if (typeof window !== 'undefined') {
  dbPromise = openDB<DreamMediaDB>('dream-weaver-media', 1, {
    upgrade(db) {
      const store = db.createObjectStore('media', { keyPath: 'key' });
      store.createIndex('by-dreamId', 'dreamId');
    },
  });
}

export async function saveMedia(dreamId: string, mediaType: 'image' | 'audio' | 'music' | 'video', data: string, mimeType: string) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('media', {
    key: `${dreamId}_${mediaType}`,
    dreamId,
    mediaType,
    data,
    mimeType
  });
}

export async function getMedia(dreamId: string, mediaType: 'image' | 'audio' | 'music' | 'video') {
  if (!dbPromise) return null;
  const db = await dbPromise;
  return db.get('media', `${dreamId}_${mediaType}`);
}

export async function getAllMediaForDream(dreamId: string) {
  if (!dbPromise) return [];
  const db = await dbPromise;
  return db.getAllFromIndex('media', 'by-dreamId', dreamId);
}
