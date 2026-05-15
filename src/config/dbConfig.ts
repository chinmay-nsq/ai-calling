// dbConfig.ts
import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState >= 1) {
    console.log("\x1b[31mMongoose Connection Failed\x1b[0m");
    return;
  }
  await mongoose.connect(process.env.MONGO_URI!);
  console.log("\x1b[32m✓ MongoDB Connected Successfully\x1b[0m");
};
