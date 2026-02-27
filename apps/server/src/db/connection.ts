import mongoose from "mongoose";

export async function connectToDatabase(mongoUrl: string | undefined) {
  if (!mongoUrl) {
    throw new Error("MONGO_URL не задан");
  }

  try {
    await mongoose.connect(mongoUrl);
    console.log("Mongo подключена");
  } catch (error) {
    console.error("Ошибка подключения к Mongo:", error);
    throw error;
  }
}

