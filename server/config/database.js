import mongoose from 'mongoose';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function connectDatabase() {
  let uri = process.env.MONGODB_URI;
  let memoryServer = null;
  if (!uri && process.env.NODE_ENV !== 'production') {
    // The sandboxed Windows temp directory can block WiredTiger's file renames.
    const localTempDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.tmp');
    await mkdir(localTempDir, { recursive: true });
    process.env.TMPDIR = localTempDir;
    process.env.TMP = localTempDir;
    process.env.TEMP = localTempDir;
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const databasePath = path.resolve(localTempDir, 'mongo-data');
    await mkdir(databasePath, { recursive: true });
    memoryServer = await MongoMemoryServer.create({ instance: { dbPath: databasePath } });
    uri = memoryServer.getUri('gavel_grain');
    console.info('Using local development MongoDB stored in .tmp/mongo-data.');
  }
  if (!uri) throw new Error('MONGODB_URI is required in production.');
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    return memoryServer;
  } catch (error) {
    await memoryServer?.stop();
    throw error;
  }
}
