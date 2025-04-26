// database.ts
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs/promises';

// Define types for our data
export interface Window {
    start: number;
    end: number;
    avgIntensity: number;
    length: number;
}

export interface DailyWindows {
    date: string;
    windows: Window[];
}

export interface ScalingEvent {
    id?: number;
    timestamp: string;
    hour: number;
    deploymentName: string;
    namespace: string;
    targetReplicas: number;
    reason: string;
}

// Make sure the DB directory exists
async function ensureDbDirExists(dbPath: string): Promise<void> {
    const dir = path.dirname(dbPath);
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (err) {
        // Directory already exists or can't be created
        console.error('Error creating DB directory:', err);
    }
}

// Initialize the database connection
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

    // Create tables if they don't exist
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

// Store optimal windows for a day
export async function storeOptimalWindows(date: string, windows: Window[]): Promise<void> {
    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        await db.run(
            'INSERT OR REPLACE INTO optimal_windows (date, windows_json) VALUES (?, ?)',
            [date, JSON.stringify(windows)]
        );
        console.log(`✅ Stored optimal windows for ${date}`);
    } catch (err) {
        console.error('❌ Error storing optimal windows:', err);
        throw err;
    }
}

// Get optimal windows for a day
export async function getOptimalWindows(date: string): Promise<Window[]> {
    if (!db) {
        throw new Error('Database not initialized');
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
        console.error('❌ Error retrieving optimal windows:', err);
        return [];
    }
}

// Log a scaling event
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
        console.error('❌ Error logging scaling event:', err);
    }
}

// Get recent scaling events
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
        console.error('❌ Error retrieving scaling events:', err);
        return [];
    }
}

// Close the database connection
export async function closeDatabase(): Promise<void> {
    if (db) {
        await db.close();
        db = null;
    }
}