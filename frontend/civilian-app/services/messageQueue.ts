/**
 * Message queue — persists supply requests to SQLite and retries
 * sending over BLE when connectivity is restored.
 */

import * as SQLite from 'expo-sqlite';
import { SupplyRequest, RequestStatus } from '@/types';
import { useRequestStore } from '@/store/requestStore';
import { bleService } from './ble';

const DB_NAME = 'meshsos.db';
let db: SQLite.SQLiteDatabase | null = null;

async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS draft (
        id TEXT PRIMARY KEY DEFAULT 'singleton',
        data TEXT NOT NULL
      );
    `);
  }
  return db;
}

// ─── Request persistence ──────────────────────────────────────────────────────

export async function persistRequest(request: SupplyRequest): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    'INSERT OR REPLACE INTO requests (id, data, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    [request.id, JSON.stringify(request), request.status, request.createdAt, request.updatedAt]
  );
}

export async function updateRequestStatusInDB(id: string, status: RequestStatus): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    'UPDATE requests SET status = ?, updatedAt = ? WHERE id = ?',
    [status, Date.now(), id]
  );
}

export async function loadAllRequests(): Promise<SupplyRequest[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<{ data: string }>(
    'SELECT data FROM requests ORDER BY createdAt DESC'
  );
  return rows.map((r) => JSON.parse(r.data) as SupplyRequest);
}

// ─── Draft persistence ────────────────────────────────────────────────────────

export async function saveDraft(draft: Partial<SupplyRequest>): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    'INSERT OR REPLACE INTO draft (id, data) VALUES (?, ?)',
    ['singleton', JSON.stringify(draft)]
  );
}

export async function loadDraft(): Promise<Partial<SupplyRequest> | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<{ data: string }>(
    'SELECT data FROM draft WHERE id = ?',
    ['singleton']
  );
  return row ? JSON.parse(row.data) : null;
}

export async function clearDraft(): Promise<void> {
  const database = await getDB();
  await database.runAsync('DELETE FROM draft WHERE id = ?', ['singleton']);
}

// ─── Queue and flush ──────────────────────────────────────────────────────────

export async function enqueue(request: SupplyRequest): Promise<void> {
  await persistRequest(request);
  useRequestStore.getState().addRequest(request);
  await flush();
}

export async function flush(): Promise<void> {
  if (!bleService.isConnected) return;

  const database = await getDB();
  const pending = await database.getAllAsync<{ data: string }>(
    'SELECT data FROM requests WHERE status IN (?, ?) ORDER BY createdAt ASC',
    ['pending', 'failed']
  );

  for (const row of pending) {
    const request: SupplyRequest = JSON.parse(row.data);
    useRequestStore.getState().updateRequestStatus(request.id, 'sent');
    await updateRequestStatusInDB(request.id, 'sent');

    const sent = await bleService.sendRequest(request);
    if (!sent) {
      useRequestStore.getState().updateRequestStatus(request.id, 'failed', {
        retryCount: request.retryCount + 1,
      });
      await updateRequestStatusInDB(request.id, 'failed');
    }
  }
}

export async function initQueue(): Promise<void> {
  // Load persisted requests into store on app start
  const requests = await loadAllRequests();
  const store = useRequestStore.getState();
  for (const req of requests) {
    store.addRequest(req);
  }

  // Load draft
  const draft = await loadDraft();
  if (draft) {
    store.setDraft(draft);
  }
}
