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
    indexes: {
      'by-noteId': string;
      'by-contentHash': string;
      'by-timestamp': number;
    };
  };
}

class AudioStorage {
  private db: IDBPDatabase<AudioDB> | null = null;
  private initPromise: Promise<IDBPDatabase<AudioDB>> | null = null;
  private static DB_NAME = 'audio-storage';
  private static DB_VERSION = 1;

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = openDB<AudioDB>(AudioStorage.DB_NAME, AudioStorage.DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Only create the store if it doesn't exist
        if (!db.objectStoreNames.contains('audio')) {
          const store = db.createObjectStore('audio');
          
          // Create indexes
          store.createIndex('by-noteId', 'metadata.noteId', { unique: false });
          store.createIndex('by-contentHash', 'metadata.contentHash', { unique: false });
          store.createIndex('by-timestamp', 'metadata.timestamp', { unique: false });
        }
      },
      blocked() {
        console.warn('Database is blocked');
      },
      blocking() {
        console.warn('Database is being blocked');
      },
      terminated() {
        console.warn('Database connection terminated');
      },
    });

    try {
      this.db = await this.initPromise;
      return this.db;
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }

  private async deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(AudioStorage.DB_NAME);
      
      request.onerror = () => {
        console.warn('Error deleting database');
        reject(new Error('Failed to delete database'));
      };
      
      request.onsuccess = () => {
        console.log('Database deleted successfully');
        resolve();
      };
      
      request.onblocked = () => {
        console.warn('Database deletion blocked');
        reject(new Error('Database deletion blocked'));
      };
    });
  }

  private generateKey(metadata: AudioDB['audio']['value']['metadata']): string {
    return `${metadata.noteId}_${metadata.contentHash}`;
  }

  async saveAudio(metadata: AudioDB['audio']['value']['metadata'], blob: Blob) {
    try {
      const db = await this.init();
      const key = this.generateKey(metadata);
      
      // Delete any existing audio for this note
      await this.deleteAudio(metadata.noteId);
      
      // Save the new audio
      await db.put('audio', { blob, metadata }, key);
      
      // Clean up old audio files
      await this.cleanupOldAudio();
    } catch (error) {
      console.error('Error saving audio:', error);
      throw error;
    }
  }

  async getAudio(metadata: AudioDB['audio']['value']['metadata']): Promise<Blob | null> {
    try {
      const db = await this.init();
      const key = this.generateKey(metadata);
      const data = await db.get('audio', key);
      
      if (!data) {
        return null;
      }
      
      // Update timestamp to mark as recently used
      data.metadata.timestamp = Date.now();
      await db.put('audio', data, key);
      
      return data.blob;
    } catch (error) {
      console.error('Error getting audio:', error);
      return null;
    }
  }

  async deleteAudio(noteId: string) {
    try {
      const db = await this.init();
      const tx = db.transaction('audio', 'readwrite');
      const store = tx.objectStore('audio');
      const index = store.index('by-noteId');
      
      let cursor = await index.openCursor(IDBKeyRange.only(noteId));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      
      await tx.done;
    } catch (error) {
      console.error('Error deleting audio:', error);
      throw error;
    }
  }

  async cleanupOldAudio(maxAge: number = 7 * 24 * 60 * 60 * 1000) {
    try {
      const db = await this.init();
      const tx = db.transaction('audio', 'readwrite');
      const store = tx.objectStore('audio');
      const index = store.index('by-timestamp');
      const now = Date.now();
      
      let cursor = await index.openCursor();
      while (cursor) {
        if (now - cursor.value.metadata.timestamp > maxAge) {
          await cursor.delete();
        }
        cursor = await cursor.continue();
      }
      
      await tx.done;
    } catch (error) {
      console.error('Error cleaning up old audio:', error);
    }
  }

  async getAudioSize(): Promise<number> {
    try {
      const db = await this.init();
      const tx = db.transaction('audio', 'readonly');
      const store = tx.objectStore('audio');
      const allData = await store.getAll();
      
      return allData.reduce((total, data) => total + data.blob.size, 0);
    } catch (error) {
      console.error('Error getting audio size:', error);
      return 0;
    }
  }

  async clearAll() {
    try {
      // Delete the entire database
      await this.deleteDatabase();
      // Reset the init promise to force reinitialization
      this.initPromise = null;
      this.db = null;
      // Reinitialize the database
      await this.init();
    } catch (error) {
      console.error('Error clearing audio storage:', error);
      throw error;
    }
  }
}

export const audioStorage = new AudioStorage(); 