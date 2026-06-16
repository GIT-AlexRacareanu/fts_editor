import { Injectable } from '@angular/core';

const DATABASE_NAME = 'fts-editor-file-handles';
const STORE_NAME = 'handles';

@Injectable({ providedIn: 'root' })
export class FileHandleStorageService {
  async getFileHandle<T>(key: string): Promise<T | null> {
    return this.getStoredValue<T>(key);
  }

  async getStoredValue<T>(key: string): Promise<T | null> {
    if (!this.isSupported()) {
      return null;
    }

    const database = await this.openDatabase();

    return new Promise<T | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Failed to read stored file handle.'));
    });
  }

  async saveFileHandle(key: string, fileHandle: unknown): Promise<void> {
    await this.saveStoredValue(key, fileHandle);
  }

  async saveStoredValue(key: string, value: unknown): Promise<void> {
    if (!this.isSupported()) {
      return;
    }

    const database = await this.openDatabase();

    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to save file handle.'));

      store.put(value, key);
    });
  }

  async deleteFileHandle(key: string): Promise<void> {
    await this.deleteStoredValue(key);
  }

  async deleteStoredValue(key: string): Promise<void> {
    if (!this.isSupported()) {
      return;
    }

    const database = await this.openDatabase();

    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to remove stored file handle.'));

      store.delete(key);
    });
  }

  private isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open file handle database.'));
    });
  }
}