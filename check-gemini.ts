import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

async function listModels() {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY missing");
    return;
  }
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    // Attempt to list models if supported by this specific SDK
    // Based on @google/genai structure, it might be ai.models.list()
    if (typeof (ai as any).models?.list === 'function') {
        const models = await (ai as any).models.list();
        console.log("Available Gemini Models:");
        console.log(JSON.stringify(models, null, 2));
    } else {
        console.log("ai.models.list is not a function. Trying a test call with gemini-1.5-flash...");
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [{ role: "user", parts: [{ text: "Hello" }] }],
        });
        console.log("gemini-1.5-flash response:", response);
    }
  } catch (err: any) {
    console.error("Error listing/testing models:", err.message);
    if (err.stack) console.error(err.stack);
  }
}

listModels();
