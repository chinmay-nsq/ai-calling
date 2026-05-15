// dbConfig.ts
import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState >= 1) {
      console.log("\x1b[33mMongoDB already connected\x1b[0m");
      return;
    }

    await mongoose.connect(process.env.MONGO_URI!);

    console.log("\x1b[32m✓ MongoDB Connected Successfully\x1b[0m");
  } catch (error) {
    console.error("\x1b[31m✗ MongoDB Connection Failed\x1b[0m");

    if (error instanceof Error) {
      console.error("Error Name   :", error.name);
      console.error("Error Message:", error.message);
      console.error("Stack Trace  :\n", error.stack);
    } else {
      console.error("Unknown Error:", error);
    }

    process.exit(1);
  }
};
