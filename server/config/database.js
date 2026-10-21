import mongoose from 'mongoose';

export async function connectDatabase() {
  let uri = process.env.MONGODB_URI;
  let memoryServer = null;
  if (!uri && process.env.NODE_ENV !== 'production') {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('gavel_grain');
    console.info('Using an in-memory MongoDB for local development. Data resets when the server stops.');
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
