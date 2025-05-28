import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AudioDB extends DBSchema {
  audio: {
    key: string;
    value: {
      blob: Blob;
      metadata: {
        noteId: string;
        contentHash: string;
        timestamp: number;
        title: string;
      };
    };
  };
}

class AudioStorage {
  private db: IDBPDatabase<AudioDB> | null = null;

  async init() {
    if (!this.db) {
      this.db = await openDB<AudioDB>('audio-storage', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('audio')) {
            db.createObjectStore('audio');
          }
        },
      });
    }
    return this.db;
  }

  private generateKey(metadata: AudioDB['audio']['value']['metadata']): string {
    return `${metadata.noteId}_${metadata.contentHash}`;
  }

  async saveAudio(metadata: AudioDB['audio']['value']['metadata'], blob: Blob) {
    const db = await this.init();
    const key = this.generateKey(metadata);
    await db.put('audio', { blob, metadata }, key);
  }

  async getAudio(metadata: AudioDB['audio']['value']['metadata']): Promise<Blob | null> {
    const db = await this.init();
    const key = this.generateKey(metadata);
    const data = await db.get('audio', key);
    return data?.blob || null;
  }

  async deleteAudio(noteId: string) {
    const db = await this.init();
    const tx = db.transaction('audio', 'readwrite');
    const store = tx.objectStore('audio');
    const keys = await store.getAllKeys();
    
    for (const key of keys) {
      if (key.startsWith(noteId)) {
        await store.delete(key);
      }
    }
    
    await tx.done;
  }

  async clearOldAudio(maxAge: number = 7 * 24 * 60 * 60 * 1000) {
    const db = await this.init();
    const tx = db.transaction('audio', 'readwrite');
    const store = tx.objectStore('audio');
    const now = Date.now();
    
    const keys = await store.getAllKeys();
    for (const key of keys) {
      const data = await store.get(key);
      if (data && now - data.metadata.timestamp > maxAge) {
        await store.delete(key);
      }
    }
    
    await tx.done;
  }
}

export const audioStorage = new AudioStorage(); 