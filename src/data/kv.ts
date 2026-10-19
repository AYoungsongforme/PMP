/**
 * 极简键值存储。优先用 IndexedDB，不可用时退回 localStorage。
 * 将来换成"云盘目录里的文件"时，只需要替换这一层。
 */
export interface KvStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  readonly backend: string;
}

const DB_NAME = "pmp";
const STORE = "kv";

/**
 * 打开数据库并确保存储桶存在。
 * 注意：如果之前有人以同样的版本号打开过这个库却没有建存储桶，
 * onupgradeneeded 不会再触发，这里会主动升一个版本号补救。
 */
function openDb(version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = version === undefined ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains(STORE)) {
        resolve(db);
        return;
      }
      const nextVersion = db.version + 1;
      db.close();
      openDb(nextVersion).then(resolve, reject);
    };
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

class IndexedDbStore implements KvStore {
  readonly backend = "IndexedDB";
  private db: Promise<IDBDatabase> | null = null;

  private handle(): Promise<IDBDatabase> {
    if (!this.db) this.db = openDb();
    return this.db;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const db = await this.handle();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async set(key: string, value: unknown): Promise<void> {
    const db = await this.handle();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

class LocalStorageStore implements KvStore {
  readonly backend = "localStorage";

  async get<T>(key: string): Promise<T | undefined> {
    const raw = localStorage.getItem(`pmp:${key}`);
    return raw ? (JSON.parse(raw) as T) : undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    localStorage.setItem(`pmp:${key}`, JSON.stringify(value));
  }
}

class MemoryStore implements KvStore {
  readonly backend = "memory";
  private map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }
}

export function createKv(): KvStore {
  try {
    if (typeof indexedDB !== "undefined") {
      return new IndexedDbStore();
    }
  } catch {
    // 某些浏览器在 file:// 下会禁用 IndexedDB
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("pmp:probe", "1");
      localStorage.removeItem("pmp:probe");
      return new LocalStorageStore();
    }
  } catch {
    // 隐私模式下 localStorage 也可能不可用
  }
  return new MemoryStore();
}
