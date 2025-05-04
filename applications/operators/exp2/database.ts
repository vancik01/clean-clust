import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs/promises';
import { ScalingEvent, Window } from './types';

async function ensureDbDirExists(dbPath: string): Promise<void> {
    const dir = path.dirname(dbPath);
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (err) {
        console.error('❌ Error creating DB directory:', err);
    }
}

let db: Database | null = null;

export async function initDatabase(dbPath: string): Promise<Database> {
    if (db) {
        return db;
    }

    await ensureDbDirExists(dbPath);

    db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
    });

    // Create tables 
    await db.exec(`
    CREATE TABLE IF NOT EXISTS optimal_windows (
      date TEXT PRIMARY KEY,
      windows_json TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS scaling_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      hour INTEGER NOT NULL,
      deployment_name TEXT NOT NULL,
      namespace TEXT NOT NULL,
      target_replicas INTEGER NOT NULL,
      reason TEXT NOT NULL
    );
  `);

    return db;
}

export async function storeOptimalWindows(date: string, windows: Window[]): Promise<void> {
    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        await db.run(
            'INSERT OR REPLACE INTO optimal_windows (date, windows_json) VALUES (?, ?)',
            [date, JSON.stringify(windows)]
        );
    } catch (err) {
        console.error('❌ Error:', err);
        throw err;
    }
}

export async function getOptimalWindows(date: string): Promise<Window[]> {
    if (!db) {
        throw new Error('Database failed to initialize');
    }

    try {
        const row = await db.get(
            'SELECT windows_json FROM optimal_windows WHERE date = ?',
            [date]
        );

        if (row && row.windows_json) {
            return JSON.parse(row.windows_json) as Window[];
        }
        return [];
    } catch (err) {
        console.error('❌ Error:', err);
        return [];
    }
}

export async function logScalingEvent(event: ScalingEvent): Promise<void> {
    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        await db.run(
            `INSERT INTO scaling_events 
       (timestamp, hour, deployment_name, namespace, target_replicas, reason) 
       VALUES (?, ?, ?, ?, ?, ?)`,
            [
                event.timestamp,
                event.hour,
                event.deploymentName,
                event.namespace,
                event.targetReplicas,
                event.reason
            ]
        );
    } catch (err) {
        console.error('❌ Error:', err);
    }
}

export async function getRecentScalingEvents(limit = 10): Promise<ScalingEvent[]> {
    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        const rows = await db.all(
            'SELECT * FROM scaling_events ORDER BY timestamp DESC LIMIT ?',
            [limit]
        );
        return rows as ScalingEvent[];
    } catch (err) {
        console.error('❌ Error:', err);
        return [];
    }
}

export async function closeDatabase(): Promise<void> {
    if (db) {
        await db.close();
        db = null;
    }
}