// @ts-nocheck
import Database from "better-sqlite3";
import path from "path";

const dbFile = path.resolve(process.cwd(), "prisma/social_inbox.db");

function getDb() {
  const db = new Database(dbFile);
  db.pragma('encoding = "UTF-8"');
  db.pragma('journal_mode = WAL');
  return db;
}

// Lightweight Prisma-compatible client using direct SQLite
function createPrismaLike() {
  return {
    user: {
      findUnique: ({ where }: any) => {
        const db = getDb();
        const keys = Object.keys(where);
        const key = keys[0];
        const val = where[key];
        const row = db.prepare(`SELECT * FROM "User" WHERE "${key}" = ? LIMIT 1`).get(val);
        db.close();
        return Promise.resolve(row || null);
      },
      count: () => {
        const db = getDb();
        const row: any = db.prepare(`SELECT COUNT(*) as c FROM "User"`).get();
        db.close();
        return Promise.resolve(row.c as number);
      },
      create: ({ data, select }: any) => {
        const db = getDb();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO "User" (id, name, email, password, role, "isActive", "createdAt", "updatedAt")
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `).run(id, data.name, data.email, data.password, data.role || "AGENT", now, now);
        const row: any = db.prepare(`SELECT * FROM "User" WHERE id = ?`).get(id);
        db.close();
        const result: any = {};
        if (select) {
          for (const k of Object.keys(select)) { if (select[k]) result[k] = row[k]; }
        }
        return Promise.resolve(result);
      },
      findFirst: ({ where }: any) => {
        const db = getDb();
        const keys = Object.keys(where);
        const key = keys[0];
        const val = where[key];
        const row = db.prepare(`SELECT * FROM "User" WHERE "${key}" = ? LIMIT 1`).get(val);
        db.close();
        return Promise.resolve(row || null);
      },
    },
    conversation: {
      findFirst: ({ where }: any = {}) => {
        const db = getDb();
        let sql = `SELECT * FROM "Conversation" WHERE 1=1`;
        const params: any[] = [];
        if (where?.contactId) { sql += ` AND contactId=?`; params.push(where.contactId); }
        if (where?.accountId) { sql += ` AND accountId=?`; params.push(where.accountId); }
        if (where?.id) { sql += ` AND id=?`; params.push(where.id); }
        sql += ` LIMIT 1`;
        const row: any = db.prepare(sql).get(...params);
        db.close();
        return Promise.resolve(row || null);
      },
      upsert: ({ where, create, update }: any) => {
        const db = getDb();
        const existing: any = where?.id ? db.prepare(`SELECT * FROM "Conversation" WHERE id=? LIMIT 1`).get(where.id) : null;
        if (existing) {
          const now = new Date().toISOString();
          const sets = Object.keys(update).map((k: string) => `"${k}"=?`).join(',');
          const vals: any[] = Object.values(update).map((v: any) =>
            v instanceof Date ? v.toISOString() : typeof v === 'boolean' ? (v ? 1 : 0) : v
          );
          db.prepare(`UPDATE "Conversation" SET ${sets}, "updatedAt"=? WHERE id=?`).run(...vals, now, existing.id);
          const updated: any = db.prepare(`SELECT * FROM "Conversation" WHERE id=?`).get(existing.id);
          db.close();
          return Promise.resolve({ ...updated, isRead: updated.isRead === 1 });
        } else {
          const id = where?.id || crypto.randomUUID();
          const now = new Date().toISOString();
          const lma = create.lastMessageAt instanceof Date ? create.lastMessageAt.toISOString() : (create.lastMessageAt || now);
          db.prepare(`INSERT OR IGNORE INTO "Conversation" (id, status, "lastMessageAt", "isRead", "createdAt", "updatedAt", "contactId", "accountId") VALUES (?,?,?,?,?,?,?,?)`).run(id, create.status || 'OPEN', lma, 0, now, now, create.contactId, create.accountId);
          db.close();
          return Promise.resolve({ id, status: create.status || 'OPEN', isRead: false, lastMessageAt: lma, contactId: create.contactId, accountId: create.accountId });
        }
      },
      findMany: ({ where, include, orderBy, skip, take }: any = {}) => {
        const db = getDb();
        let sql = `SELECT c.*, 
          ct.id as ct_id, ct.name as ct_name, ct.avatar as ct_avatar, ct.platformUserId as ct_puid, ct.platform as ct_platform,
          ca.platform as ca_platform, ca.pageName as ca_pageName,
          u.id as ag_id, u.name as ag_name
          FROM "Conversation" c
          LEFT JOIN "Contact" ct ON ct.id = c.contactId
          LEFT JOIN "ConnectedAccount" ca ON ca.id = c.accountId
          LEFT JOIN "User" u ON u.id = c.assignedAgentId
          WHERE 1=1`;
        const params: any[] = [];
        if (where?.status) { sql += ` AND c.status = ?`; params.push(where.status); }
        if (where?.account?.platform) { sql += ` AND ca.platform = ?`; params.push(where.account.platform); }
        if (where?.id) { sql += ` AND c.id = ?`; params.push(where.id); }
        sql += ` ORDER BY c.lastMessageAt DESC`;
        if (take) { sql += ` LIMIT ${take}`; }
        if (skip) { sql += ` OFFSET ${skip}`; }
        const rows: any[] = db.prepare(sql).all(...params);
        const result = rows.map((r: any) => {
          // Get last message
          const msgs: any[] = db.prepare(`SELECT content, createdAt, senderType FROM "Message" WHERE conversationId=? ORDER BY createdAt DESC LIMIT 1`).all(r.id);
          return {
            id: r.id, status: r.status, isRead: r.isRead === 1,
            lastMessageAt: r.lastMessageAt, platform: r.ca_platform,
            contact: { id: r.ct_id, name: r.ct_name, avatar: r.ct_avatar, platformUserId: r.ct_puid, platform: r.ct_platform },
            account: { platform: r.ca_platform, pageName: r.ca_pageName },
            assignedAgent: r.ag_id ? { id: r.ag_id, name: r.ag_name } : null,
            messages: msgs,
          };
        });
        db.close();
        return Promise.resolve(result);
      },
      count: ({ where }: any = {}) => {
        const db = getDb();
        const row: any = db.prepare(`SELECT COUNT(*) as c FROM "Conversation"`).get();
        db.close();
        return Promise.resolve(row.c as number);
      },
      findUnique: ({ where, include }: any = {}) => {
        const db = getDb();
        const row: any = where?.id ? db.prepare(`SELECT * FROM "Conversation" WHERE id=? LIMIT 1`).get(where.id) : null;
        if (!row) { db.close(); return Promise.resolve(null); }
        let contact = null;
        let account = null;
        if (include?.contact && row.contactId) {
          contact = db.prepare(`SELECT * FROM "Contact" WHERE id=? LIMIT 1`).get(row.contactId);
        }
        if (include?.account && row.accountId) {
          account = db.prepare(`SELECT * FROM "ConnectedAccount" WHERE id=? LIMIT 1`).get(row.accountId);
        }
        db.close();
        return Promise.resolve({ ...row, contact, account });
      },
      create: ({ data }: any) => {
        const db = getDb();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        db.prepare(`INSERT INTO "Conversation" (id, status, "lastMessageAt", "isRead", "createdAt", "updatedAt", "contactId", "accountId")
          VALUES (?,?,?,0,?,?,?,?)`).run(id, data.status || 'OPEN', now, now, now, data.contactId, data.accountId);
        db.close();
        return Promise.resolve({ id, status: data.status || 'OPEN', isRead: false, lastMessageAt: now, contactId: data.contactId, accountId: data.accountId });
      },
      update: ({ where, data }: any) => {
        const db = getDb();
        const sets = Object.keys(data).map((k: string) => `"${k}"=?`).join(',');
        const vals = Object.values(data);
        vals.push(where.id);
        db.prepare(`UPDATE "Conversation" SET ${sets}, "updatedAt"=? WHERE id=?`).run(...vals, new Date().toISOString(), where.id);
        db.close();
        return Promise.resolve({ id: where.id, ...data });
      },
    },
    message: {
      findMany: ({ where, orderBy, take }: any = {}) => {
        const db = getDb();
        let sql = `SELECT m.*, u.name as userName FROM "Message" m LEFT JOIN "User" u ON u.id = m.sentByUserId WHERE 1=1`;
        const params: any[] = [];
        if (where?.conversationId) { sql += ` AND m.conversationId=?`; params.push(where.conversationId); }
        sql += ` ORDER BY m.createdAt ASC`;
        if (take) sql += ` LIMIT ${take}`;
        const rows: any[] = db.prepare(sql).all(...params);
        db.close();
        return Promise.resolve(rows.map((r: any) => ({ ...r, isRead: r.isRead === 1, sentByUser: r.userName ? { name: r.userName } : null })));
      },
      create: ({ data }: any) => {
        const db = getDb();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        db.prepare(`INSERT INTO "Message" (id, content, "messageType", "senderType", "platformMsgId", "mediaUrl", "isRead", "createdAt", "conversationId", "sentByUserId")
          VALUES (?,?,?,?,?,?,0,?,?,?)`).run(id, data.content, data.messageType || 'TEXT', data.senderType, data.platformMsgId || null, data.mediaUrl || null, now, data.conversationId, data.sentByUserId || null);
        db.close();
        return Promise.resolve({ id, ...data, createdAt: now });
      },
      update: ({ where, data }: any) => {
        const db = getDb(); const now = new Date().toISOString();
        const sets = Object.keys(data).map((k: string) => `"${k}"=?`).join(',');
        db.prepare(`UPDATE "Message" SET ${sets} WHERE id=?`).run(...Object.values(data), where.id);
        db.close(); return Promise.resolve({ id: where.id });
      },
      updateMany: ({ where, data }: any) => {
        const db = getDb();
        if (where?.conversationId && data?.isRead !== undefined) {
          db.prepare(`UPDATE "Message" SET "isRead"=? WHERE conversationId=?`).run(data.isRead ? 1 : 0, where.conversationId);
        }
        db.close(); return Promise.resolve({});
      },
    },
    contact: {
      upsert: ({ where, create, update }: any) => {
        const db = getDb();
        let existing: any = null;
        if (where?.platformUserId_platform) {
          existing = db.prepare(`SELECT * FROM "Contact" WHERE platformUserId=? AND platform=? LIMIT 1`).get(where.platformUserId_platform.platformUserId, where.platformUserId_platform.platform);
        }
        if (existing) {
          if (update?.name && update.name !== existing.name || update?.avatar && update.avatar !== existing.avatar) {
            db.prepare(`UPDATE "Contact" SET "name" = coalesce(?, "name"), "avatar" = coalesce(?, "avatar"), "updatedAt" = ? WHERE id = ?`)
              .run(update.name || null, update.avatar || null, new Date().toISOString(), existing.id);
            existing.name = update.name || existing.name;
            existing.avatar = update.avatar || existing.avatar;
          }
          db.close();
          return Promise.resolve(existing);
        }
        const id = crypto.randomUUID(); const now = new Date().toISOString();
        db.prepare(`INSERT OR IGNORE INTO "Contact" (id, platformUserId, platform, name, avatar, email, phone, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, create.platformUserId, create.platform, create.name, create.avatar || null, create.email || null, create.phone || null, now, now);
        const row: any = db.prepare(`SELECT * FROM "Contact" WHERE platformUserId=? AND platform=?`).get(create.platformUserId, create.platform);
        db.close();
        return Promise.resolve(row || { id, ...create });
      },
      findUnique: ({ where }: any) => {
        const db = getDb();
        let row: any = null;
        if (where?.platformUserId_platform) {
          row = db.prepare(`SELECT * FROM "Contact" WHERE platformUserId=? AND platform=? LIMIT 1`).get(where.platformUserId_platform.platformUserId, where.platformUserId_platform.platform);
        } else if (where?.id) {
          row = db.prepare(`SELECT * FROM "Contact" WHERE id=? LIMIT 1`).get(where.id);
        }
        db.close(); return Promise.resolve(row || null);
      },
      create: ({ data }: any) => {
        const db = getDb();
        const id = crypto.randomUUID(); const now = new Date().toISOString();
        db.prepare(`INSERT OR IGNORE INTO "Contact" (id, platformUserId, platform, name, avatar, email, phone, createdAt, updatedAt)
          VALUES (?,?,?,?,?,?,?,?,?)`).run(id, data.platformUserId, data.platform, data.name, data.avatar || null, data.email || null, data.phone || null, now, now);
        const row: any = db.prepare(`SELECT * FROM "Contact" WHERE platformUserId=? AND platform=?`).get(data.platformUserId, data.platform);
        db.close(); return Promise.resolve(row || { id, ...data });
      },
    },
    connectedAccount: {
      findFirst: ({ where }: any = {}) => {
        const db = getDb();
        let sql = `SELECT * FROM "ConnectedAccount" WHERE 1=1`;
        const params: any[] = [];
        if (where?.pageId) { sql += ` AND pageId=?`; params.push(where.pageId); }
        if (where?.isActive !== undefined) { sql += ` AND isActive=?`; params.push(where.isActive ? 1 : 0); }
        if (where?.platform?.in) { sql += ` AND platform IN (${where.platform.in.map(() => '?').join(',')})`; params.push(...where.platform.in); }
        else if (where?.platform) { sql += ` AND platform=?`; params.push(where.platform); }
        sql += ` LIMIT 1`;
        const row: any = db.prepare(sql).get(...params);
        db.close();
        return Promise.resolve(row ? { ...row, isActive: row.isActive === 1, aiAutoReply: row.aiAutoReply === 1 } : null);
      },
      findMany: ({ where }: any = {}) => {
        const db = getDb();
        let sql = `SELECT * FROM "ConnectedAccount" WHERE 1=1`;
        const params: any[] = [];
        if (where?.userId) { sql += ` AND userId=?`; params.push(where.userId); }
        if (where?.isActive !== undefined) { sql += ` AND isActive=?`; params.push(where.isActive ? 1 : 0); }
        const rows: any[] = db.prepare(sql).all(...params);
        db.close();
        return Promise.resolve(rows.map((r: any) => ({ ...r, isActive: r.isActive === 1, aiAutoReply: r.aiAutoReply === 1 })));
      },
      findUnique: ({ where }: any) => {
        const db = getDb();
        let row: any = null;
        if (where?.id) row = db.prepare(`SELECT * FROM "ConnectedAccount" WHERE id=? LIMIT 1`).get(where.id);
        else if (where?.platform_pageId_userId) row = db.prepare(`SELECT * FROM "ConnectedAccount" WHERE platform=? AND pageId=? AND userId=? LIMIT 1`).get(where.platform_pageId_userId.platform, where.platform_pageId_userId.pageId, where.platform_pageId_userId.userId);
        db.close();
        return Promise.resolve(row ? { ...row, isActive: row.isActive === 1, aiAutoReply: row.aiAutoReply === 1 } : null);
      },
      create: ({ data }: any) => {
        const db = getDb(); const id = crypto.randomUUID(); const now = new Date().toISOString();
        db.prepare(`INSERT INTO "ConnectedAccount" (id, platform, pageId, pageName, avatar, accessToken, isActive, aiAutoReply, aiTone, businessDetails, userId, createdAt, updatedAt)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, data.platform, data.pageId, data.pageName, data.avatar || null, data.accessToken, data.isActive ? 1 : 1, data.aiAutoReply ? 1 : 1, data.aiTone || 'friendly', data.businessDetails || null, data.userId, now, now);
        db.close(); return Promise.resolve({ id, ...data });
      },
      update: ({ where, data }: any) => {
        const db = getDb(); const now = new Date().toISOString();
        const sets = Object.keys(data).map((k: string) => `"${k}"=?`).join(',');
        db.prepare(`UPDATE "ConnectedAccount" SET ${sets}, updatedAt=? WHERE id=?`).run(...Object.values(data), now, where.id);
        db.close(); return Promise.resolve({ id: where.id });
      },
      delete: ({ where }: any) => {
        const db = getDb();
        db.prepare(`DELETE FROM "ConnectedAccount" WHERE id=?`).run(where.id);
        db.close(); return Promise.resolve({});
      },
    },
    comment: {
      upsert: ({ where, create, update }: any) => {
        const db = getDb();
        const existing: any = where?.platformCommentId ? db.prepare(`SELECT * FROM "Comment" WHERE platformCommentId=? LIMIT 1`).get(where.platformCommentId) : null;
        if (existing) { db.close(); return Promise.resolve(existing); }
        const id = crypto.randomUUID(); const now = new Date().toISOString();
        const commentedAt = create.commentedAt instanceof Date ? create.commentedAt.toISOString() : (create.commentedAt || now);
        db.prepare(`INSERT OR IGNORE INTO "Comment" (id, postId, postText, postThumbnail, platformCommentId, userName, userAvatar, text, status, commentedAt, createdAt, accountId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, create.postId, create.postText || null, create.postThumbnail || null, create.platformCommentId, create.userName, create.userAvatar || null, create.text, create.status || 'PENDING', commentedAt, now, create.accountId);
        db.close();
        return Promise.resolve({ id, ...create });
      },
      findMany: ({ where, orderBy, take, skip }: any = {}) => {
        const db = getDb();
        let sql = `SELECT cm.*, ca.platform as ca_platform, ca.pageName as ca_pageName FROM "Comment" cm LEFT JOIN "ConnectedAccount" ca ON ca.id=cm.accountId WHERE 1=1`;
        const params: any[] = [];
        if (where?.accountId) { sql += ` AND cm.accountId=?`; params.push(where.accountId); }
        if (where?.status) { sql += ` AND cm.status=?`; params.push(where.status); }
        sql += ` ORDER BY cm.commentedAt DESC`;
        if (take) sql += ` LIMIT ${take}`;
        if (skip) sql += ` OFFSET ${skip}`;
        const rows: any[] = db.prepare(sql).all(...params);
        db.close(); return Promise.resolve(rows);
      },
      create: ({ data }: any) => {
        const db = getDb(); const id = crypto.randomUUID(); const now = new Date().toISOString();
        db.prepare(`INSERT OR IGNORE INTO "Comment" (id, postId, postText, postThumbnail, platformCommentId, userName, userAvatar, text, status, commentedAt, createdAt, accountId)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, data.postId, data.postText || null, data.postThumbnail || null, data.platformCommentId, data.userName, data.userAvatar || null, data.text, data.status || 'PENDING', data.commentedAt || now, now, data.accountId);
        db.close(); return Promise.resolve({ id, ...data });
      },
      update: ({ where, data }: any) => {
        const db = getDb();
        const sets = Object.keys(data).map((k: string) => `"${k}"=?`).join(',');
        db.prepare(`UPDATE "Comment" SET ${sets} WHERE id=?`).run(...Object.values(data), where.id);
        db.close(); return Promise.resolve({ id: where.id });
      },
    },
    autoReplyRule: {
      findMany: () => Promise.resolve([]),
      create: () => Promise.resolve({}),
      update: () => Promise.resolve({}),
      delete: () => Promise.resolve({}),
    },
    team: { findMany: () => Promise.resolve([]) },
  };
}

const globalForPrisma = globalThis as any;
export const prisma = globalForPrisma._prismaLike ?? (globalForPrisma._prismaLike = createPrismaLike());
