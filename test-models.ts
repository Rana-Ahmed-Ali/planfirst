import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

const models = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Google)", provider: "google" },
  { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash Exp (Google)", provider: "google" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Google)", provider: "google" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Google)", provider: "google" },
  { id: "minimax/minimax-m2.5:free", name: "Minimax M2.5 (OpenRouter)", provider: "openrouter" },
  { id: "google/gemma-4-31b-it:free", name: "Gemma 4-31B (OpenRouter)", provider: "openrouter" },
  { id: "inclusionai/ling-2.6-1t:free", name: "Ling 2.6-1T (OpenRouter)", provider: "openrouter" },
];

async function testGoogleModel(modelId: string) {
  if (!GEMINI_API_KEY) return { success: false, error: "GEMINI_API_KEY missing" };
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [{ role: "user", parts: [{ text: "Say 'OK'" }] }],
    });
    return { success: true, response: response.text || "No text returned" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function testOpenRouterModel(modelId: string) {
  if (!OPENROUTER_API_KEY) return { success: false, error: "OPENROUTER_API_KEY missing" };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Say 'OK'" }],
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data?.error?.message || `Status: ${res.status}` };
    }

    const data = await res.json();
    return { success: true, response: data.choices[0].message.content };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function runTests() {
  console.log("Starting Model Connectivity Test...\n");
  const results = [];

  for (const model of models) {
    process.stdout.write(`Testing ${model.name}... `);
    let result;
    if (model.provider === "google") {
      result = await testGoogleModel(model.id);
    } else {
      result = await testOpenRouterModel(model.id);
    }
    
    if (result.success) {
      console.log("✅ WORKING");
      results.push({ ...model, status: "WORKING", error: null });
    } else {
      console.log(`❌ FAILED (${result.error})`);
      results.push({ ...model, status: "FAILED", error: result.error });
    }
  }

  console.log("\n--- TEST SUMMARY ---");
  console.table(results.map(r => ({ Model: r.name, Status: r.status, Error: r.error || "-" })));
}

runTests();
