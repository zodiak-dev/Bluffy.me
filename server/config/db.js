import mongoose from 'mongoose';

let isConnected = false;

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bluffy';
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    console.log(`  ✓ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`  ⚠ MongoDB non disponible: ${error.message}`);
    console.warn(`  ⚠ Le serveur démarre sans base de données (jeu en mémoire OK)`);
  }
};

export { isConnected };
export default connectDB;
