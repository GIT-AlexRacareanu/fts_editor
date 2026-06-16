"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileHandleStorageService = void 0;
const core_1 = require("@angular/core");
const DATABASE_NAME = 'fts-editor-file-handles';
const STORE_NAME = 'handles';
let FileHandleStorageService = class FileHandleStorageService {
    async getFileHandle(key) {
        if (!this.isSupported()) {
            return null;
        }
        const database = await this.openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error ?? new Error('Failed to read stored file handle.'));
        });
    }
    async saveFileHandle(key, fileHandle) {
        if (!this.isSupported()) {
            return;
        }
        const database = await this.openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error ?? new Error('Failed to save file handle.'));
            store.put(fileHandle, key);
        });
    }
    async deleteFileHandle(key) {
        if (!this.isSupported()) {
            return;
        }
        const database = await this.openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error ?? new Error('Failed to remove stored file handle.'));
            store.delete(key);
        });
    }
    isSupported() {
        return typeof indexedDB !== 'undefined';
    }
    openDatabase() {
        return new Promise((resolve, reject) => {
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
};
FileHandleStorageService = __decorate([
    (0, core_1.Injectable)({ providedIn: 'root' })
], FileHandleStorageService);
exports.FileHandleStorageService = FileHandleStorageService;
