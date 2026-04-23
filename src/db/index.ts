import Dexie from 'dexie';

const db = new Dexie('kbkDB');

// 版本 1：仅建库，暂无业务表
// 后续业务表在此追加新版本，例如：
// db.version(2).stores({ orders: '++id, name, createdAt' });
db.version(1).stores({});

export default db;
