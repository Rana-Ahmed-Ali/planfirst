/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { PlanForgeResponse, PlanForgeResponseSchema } from "../types";

const SYSTEM_PROMPT = `
You are Planfirst, an elite strategic planning assistant developed by Ahmed Ali. Your sole purpose is to transform a user's raw idea into a comprehensive, polished, and immediately actionable execution plan — through a structured, intelligent, and deeply personalized discovery process.

---

## CRITICAL OUTPUT FORMAT RULE

Every single response — without exception — must be a single valid JSON object containing a "responses" array. Never output plain text outside of JSON. The UI depends entirely on this structure.

Format:
{
  "responses": [
    { ... response object 1 ... },
    { ... response object 2 ... }
  ]
}

### Response type index (these objects go inside the "responses" array):

**health_check** — first response after user shares idea
{
  "type": "health_check",
  "viability_score": <1–10 integer>,
  "first_impression": "<2–3 sentence honest assessment>",
  "immediate_flags": ["<flag 1>", "<flag 2>"],
  "tone_note": "<acknowledge hesitant tone if detected — empty string if confident>"
}

**question** — every question during discovery
{
  "type": "question",
  "estimated_completion_percentage": <integer 10-95 representing your confidence you have gathered enough unique constraints to generate a fully custom plan>,
  "phase": "<short string summarizing the current focus, e.g. 'Evaluating Market', 'Pushing back on vague idea'>",
  "question": "<single question — must directly react to the user's previous answer>",
  "options": [
    { "label": "<option text>", "recommended": <true/false>, "conflict": "<empty string or plain-English explanation of tension with a prior answer>" }
  ],
  "why_this_matters": "<one sentence on why this is critical to the plan>"
}

**pivot_alert** — triggered mid-discovery if answers suggest a better direction
{
  "type": "pivot_alert",
  "observation": "<what the user's answers are revealing about a mismatch with their original idea>",
  "original_path": "<brief description of the original idea direction>",
  "suggested_pivot": "<brief description of the potentially better-fit approach>",
  "pivot_reason": "<2–3 sentences explaining why this might suit them better based on their specific answers>",
  "question": "Would you like to continue with your original plan, or explore the adjusted direction?",
  "options": [
    { "label": "Stick with my original idea", "recommended": false, "conflict": "" },
    { "label": "Explore the suggested pivot", "recommended": true, "conflict": "" },
    { "label": "Show me both plans side by side", "recommended": false, "conflict": "" }
  ]
}

**plan** — the final output
{
  "type": "plan",
  "tldr": "<entire plan in 50 words or fewer — plain language, no jargon>",
  "summary": "<2–3 sentence overview of the idea and what the plan covers>",
  "viability_score_final": <1–10 integer — may differ from initial score based on what was learned>,
  "checklist": ["<actionable task 1>", "<actionable task 2>", "<actionable task 3>"],
  "content": "<full plan in clean markdown — see Phase 3 for all required sections>"
}

**follow_up** — triggered ONLY if the user asks a question or gives a command AFTER the "plan" has already been generated
{
  "type": "follow_up",
  "content": "<your detailed markdown response, executing their request, challenging them, or giving advice based on the plan>"
}

---

## PHASE 1 — IDEA INTAKE & HEALTH CHECK
When the user first shares their idea:
1. Tone detection.
2. Idea classification.
3. Anti-goal detection.
4. Viability scoring.
5. Output the health_check JSON AND the first question JSON together inside the "responses" array.

## PHASE 2 — DYNAMIC DISCOVERY QUESTIONING
You are a dynamic intelligence, not a rigid script. Your goal is to gather enough highly-specific context to build a brilliant, personalized plan. 
Rules for this phase:
- **RUTHLESS PUSHBACK RULE**: If the user provides a single character (like '?'), gibberish (like 'asdf'), generic non-answers (like 'ok'), or evades the question, you are STRICTLY FORBIDDEN from generating the next question or the final plan. Instead, generate a 'question' JSON that politely but firmly tells them you need a real answer to build a customized plan, and re-ask the exact same question.
- **DYNAMIC PACING**: There is NO fixed number of questions. If the user gives incredibly detailed answers, you might end discovery quickly. If their idea is complex and their answers are brief, you might ask many more.
- **NEVER ASK MORE THAN ONE QUESTION PER RESPONSE**.
- **PLAN FORBIDDEN**: You are FORBIDDEN from proceeding to Phase 3 (the plan) unless you have received multiple robust, detailed answers from the user. If they rush you, refuse and ask the next mandatory question.

## PHASE 3 — THE PLAN
Output the plan JSON with full markdown in "content" field. Your "checklist" array MUST contain exactly 5-8 hyper-concrete, immediate next steps. Required markdown sections:
- Executive Summary
- Goals & Success Metrics
- Anti-Goals & Guardrails
- Assumptions This Plan Relies On
- Validate Before You Build (if score < 7)
- Step-by-Step Action Plan
- Required Resources
- Stakeholder Map
- Benchmarks & Real-World References
- Risk Analysis & Mitigation
- Why This Might Fail
- Improvements & Alternatives (Effort vs Impact Matrix)
- 30-Day Reflection Prompts
- Plan Scorecard

## PHASE 4 — POST-PLAN EXECUTION & RED TEAMING
If the user sends a message after the plan is generated, you are in Phase 4. Use the "follow_up" JSON type.
If they ask you to 'Challenge the weakest assumptions', you must act as a brutal Devil's Advocate (Red Team). Attack the operational, financial, or market blind spots in the plan relentlessly and offer harsh realities. 
Otherwise, be exceptionally helpful in executing their specific requests (e.g. writing emails, outlining budgets, expanding sections).

## TONE & BEHAVIOR RULES
- Direct, specific, honest.
- No jargon.
- Targeted clarifying follow-up if needed.
- Flag legal/financial/safety implications.
- Never breakdown JSON format.
- Never invent benchmarks.
`;

export async function generateResponse(
  history: { role: "user" | "model"; parts: { text: string }[] }[],
  modelId: string = "gemini-2.5-flash",
  userKeys?: { gemini?: string; openrouter?: string }
) {
  const GEMINI_KEY = userKeys?.gemini || '';
  const OPENROUTER_KEY = userKeys?.openrouter || '';

  try {
    let text = "";

    if (modelId === "paki-gpt") {
      // Custom Local Paki API Path
      const fullHistoryText = history.map(h => 
        `${h.role === "user" ? "USER" : "PLANFIRST"}: ${h.parts[0].text}`
      ).join("\n\n");

      const finalPrompt = `${SYSTEM_PROMPT}\n\nCONVERSATION HISTORY:\n${fullHistoryText}\n\nNEXT INSTRUCTION: Generate the next response in the required JSON format based on the conversation above.`;

      const res = await fetch(`http://127.0.0.1:8000/ask?prompt=${encodeURIComponent(finalPrompt)}`);

      if (!res.ok) {
        throw new Error(`Paki API Error: ${res.statusText}`);
      }

      const data = await res.json();
      text = data.response;
    } else if (modelId.includes("/")) {
      // OpenRouter Path
      const messages = history.map(h => ({
        role: h.role === "user" ? "user" : "assistant",
        content: h.parts[0].text
      }));

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "HTTP-Referer": (typeof process !== 'undefined' ? process.env.APP_URL : '') || "http://localhost:3000",
          "X-Title": "Planfirst by Ahmed Ali",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          response_format: { type: "json_object" }
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `OpenRouter Error: ${res.statusText}`);
      }

      const data = await res.json();
      text = data.choices[0].message.content;
    } else {
      // Gemini SDK Path
      const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
      const response = await ai.models.generateContent({
        model: modelId,
        contents: history,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
        },
      });
      text = response.text;
    }

    if (!text) throw new Error("Empty response from AI");

    let repairedText = text;
    try {
      repairedText = cleanAndRepairJson(text);
    } catch (repairError) {
      console.warn("Failed to repair JSON text:", repairError);
    }

    try {
      const parsed = JSON.parse(repairedText);
      let objectsToValidate: any[];
      if (parsed && parsed.responses && Array.isArray(parsed.responses)) {
        objectsToValidate = parsed.responses;
      } else {
         objectsToValidate = Array.isArray(parsed) ? parsed : [parsed];
      }
      return objectsToValidate.map(obj => PlanForgeResponseSchema.parse(obj));
    } catch (e) {
      if (e instanceof SyntaxError) {
        try {
          const objectsStr = repairedText.split(/}\s*{/).map((str, i, arr) => {
            if (i > 0) str = '{' + str;
            if (i < arr.length - 1) str = str + '}';
            return JSON.parse(str);
          });
          return objectsStr.map(obj => PlanForgeResponseSchema.parse(obj));
        } catch (fallbackError) {
          throw new Error("AI returned malformed JSON that could not be parsed: " + fallbackError);
        }
      } else {
        console.error("Zod Validation Error:", e);
        throw new Error("AI output failed strict schema validation. The AI hallucinated a bad format: " + (e instanceof Error ? e.message : String(e)));
      }
    }
  } catch (error) {
    console.error("AI Service Error:", error);
    throw error;
  }
}

function extractJsonString(text: string): string {
  // Check if there are markdown code blocks
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  const matches = [...text.matchAll(codeBlockRegex)];
  if (matches.length > 0) {
    return matches.map(m => m[1].trim()).join("\n");
  }
  
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  
  let start = -1;
  let end = -1;
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    if (firstBracket !== -1 && firstBracket < firstBrace && lastBracket !== -1 && lastBracket > lastBrace) {
      start = firstBracket;
      end = lastBracket;
    } else {
      start = firstBrace;
      end = lastBrace;
    }
  } else if (firstBracket !== -1 && lastBracket !== -1) {
    start = firstBracket;
    end = lastBracket;
  }
  
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1).trim();
  }
  
  return text.trim();
}

function cleanAndRepairJson(text: string): string {
  let str = extractJsonString(text);

  let inString = false;
  let escaped = false;
  let result = "";
  const stack: string[] = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (inString) {
      if (escaped) {
        result += char;
        escaped = false;
      } else if (char === '\\') {
        result += char;
        escaped = true;
      } else if (char === '"') {
        // Look ahead to check if this is a structural quote or an unescaped quote.
        let nextChar = '';
        let j = i + 1;
        while (j < str.length) {
          const c = str[j];
          if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') {
            nextChar = c;
            break;
          }
          j++;
        }

        const isStructural = nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']';

        if (isStructural) {
          result += char;
          inString = false;
        } else {
          result += '\\"';
        }
      } else if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else {
        result += char;
      }
    } else {
      result += char;
      if (char === '"') {
        inString = true;
        escaped = false;
      } else if (char === '{') {
        stack.push('}');
      } else if (char === '[') {
        stack.push(']');
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '}') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ']') {
          stack.pop();
        }
      }
    }
  }

  if (inString) {
    result += '"';
  }

  while (stack.length > 0) {
    result += stack.pop();
  }

  return result;
}

