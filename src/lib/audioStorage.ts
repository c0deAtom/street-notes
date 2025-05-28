import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AudioDB extends DBSchema {
  audio: {
    key: string;
    value: {
      blob: Blob;
      timestamp: number;
    };
  };
}

class AudioStorage {
  private db: IDBPDatabase<AudioDB> | null = null;
  private readonly DB_NAME = 'audioStorage';
  private readonly STORE_NAME = 'audio';
  private readonly VERSION = 1;

  async init() {
    if (!this.db) {
      this.db = await openDB<AudioDB>(this.DB_NAME, this.VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('audio')) {
            db.createObjectStore('audio');
          }
        },
      });
    }
    return this.db;
  }

  async saveAudio(noteId: string, contentHash: string, audioBlob: Blob) {
    const db = await this.init();
    const key = `${noteId}_${contentHash}`;
    await db.put(this.STORE_NAME, {
      blob: audioBlob,
      timestamp: Date.now()
    }, key);
  }

  async getAudio(noteId: string, contentHash: string): Promise<Blob | null> {
    const db = await this.init();
    const key = `${noteId}_${contentHash}`;
    const data = await db.get(this.STORE_NAME, key);
    return data?.blob || null;
  }

  async deleteAudio(noteId: string) {
    const db = await this.init();
    const keys = await db.getAllKeys(this.STORE_NAME);
    const noteKeys = keys.filter(key => key.startsWith(`${noteId}_`));
    await Promise.all(noteKeys.map(key => db.delete(this.STORE_NAME, key)));
  }

  async clearOldAudio(maxAge: number = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    const db = await this.init();
    const now = Date.now();
    const keys = await db.getAllKeys(this.STORE_NAME);
    
    for (const key of keys) {
      const data = await db.get(this.STORE_NAME, key);
      if (data && (now - data.timestamp) > maxAge) {
        await db.delete(this.STORE_NAME, key);
      }
    }
  }
}

export const audioStorage = new AudioStorage(); 