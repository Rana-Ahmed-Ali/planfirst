import dotenv from "dotenv";
dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "inclusionai/ling-2.6-1t:free";

async function testOpenRouter() {
  console.log(`Testing OpenRouter with model: ${MODEL}...`);
  
  if (!OPENROUTER_API_KEY) {
    console.error("Error: OPENROUTER_API_KEY is not set in .env file.");
    return;
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000", // Optional
        "X-Title": "Planfirst Test Script", // Optional
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "user", content: "Say 'Hello, OpenRouter is working!' if you can read this." }
        ],
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("OpenRouter API Error:", response.status, response.statusText);
      console.error(JSON.stringify(error, null, 2));
      return;
    }

    const data = await response.json();
    console.log("Success! Response from OpenRouter:");
    console.log("-----------------------------------");
    console.log(data.choices[0].message.content);
    console.log("-----------------------------------");
    console.log("Usage:", data.usage);
  } catch (err) {
    console.error("Network or Runtime Error:", err);
  }
}

testOpenRouter();
