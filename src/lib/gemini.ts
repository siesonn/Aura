import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const routineSchema = {
  type: Type.OBJECT,
  properties: {
    analysis: {
      type: Type.OBJECT,
      properties: {
        workingWell: { type: Type.STRING, description: "What in their current routine is effective." },
        issuesToWatch: { type: Type.STRING, description: "Potential issues or ineffective products in their current routine." },
        missingElements: { type: Type.STRING, description: "What is missing from their routine to reach their goals." }
      },
      required: ["workingWell", "issuesToWatch", "missingElements"]
    },
    am: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step: { type: Type.NUMBER },
          name: { type: Type.STRING, description: "Product category and key ingredient (e.g., 'Gentle Ceramide Cleanser')" },
          desc: { type: Type.STRING, description: "Short, simple explanation of why this is included and what it does." }
        },
        required: ["step", "name", "desc"]
      }
    },
    pm: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step: { type: Type.NUMBER },
          name: { type: Type.STRING, description: "Product category and key ingredient (e.g., 'Retinoid Serum')" },
          desc: { type: Type.STRING, description: "Short, simple explanation of why this is included and what it does." }
        },
        required: ["step", "name", "desc"]
      }
    },
    weeklySchedule: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          focus: { type: Type.STRING },
          details: { type: Type.STRING, description: "Explicit instructions, naming specific ingredient types to use (e.g., 'Apply your Salicylic Acid serum')." }
        },
        required: ["day", "focus", "details"]
      }
    },
    notes: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ["analysis", "am", "pm", "weeklySchedule", "notes"]
};

export const generateSkincareRoutine = async (answers: any) => {
  const prompt = `
  Act as an expert skincare advisor and formulator.
  Create a highly personalized and educational skincare routine based on these user preferences:
  - Skin Type: ${answers.skinType}
  - Goals: ${answers.goals.join(", ")}
  - Sensitivities: ${answers.sensitivities}
  ${answers.sensitiveTo ? `- SPECIFIC INGREDIENTS/PRODUCTS TO AVOID: ${answers.sensitiveTo}` : ''}
  - Fragrance Free: ${answers.fragranceFree}
  - Routine Preference: ${answers.advanced} (${answers.commitment})
  - Budget: ${answers.budget || 'Any'}
  - Current Products the user already owns: ${answers.currentProducts.join(", ")}
  - Past Reactions: ${answers.reactions.join(", ")}
  - Seeing a Dermatologist: ${answers.dermatologist}

  YOUR GOAL: Provide a gap analysis and build a complete routine from scratch based on their goals — not just around what they already own.

  1. ANALYSIS (required):
     - workingWell: Which of their CURRENT PRODUCTS are actually effective and appropriate for their skin type and goals. If none, say so.
     - issuesToWatch: Which of their CURRENT PRODUCTS should be removed or used with caution — and WHY (e.g. conflicts with goals, potential irritants, redundant steps).
     - missingElements: What specific ingredient types are MISSING from their current routine that would help them reach their stated goals. Be explicit (e.g. "No SPF", "No Vitamin C for brightening", "No retinoid for anti-aging").

  2. BUILD THE ROUTINE based on their GOALS, not just their current products:
     - Recommend the IDEAL full routine for their skin type and goals.
     - If one of their current products fits, include it. If it does not fit, do NOT include it.
     - NEVER reference a product or ingredient in the routine steps or weekly schedule that is not explicitly listed as a step in either the AM or PM routine.
     - NEVER use vague terms like "active serum" — always name the exact ingredient (e.g. "Retinol Serum", "Salicylic Acid (BHA) Toner", "Vitamin C Serum").
     - Every step must have a specific ingredient type as its name.

  3. WEEKLY SCHEDULE:
     - Only reference ingredients that exist as named steps in the PM routine above.
     - Never say "active serum" — always say "your Retinol" or "your Salicylic Acid (BHA)" etc.

  ${answers.sensitiveTo ? `CRITICAL RULE: NEVER recommend any ingredient that overlaps with their sensitivities: ${answers.sensitiveTo}.` : ''}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: routineSchema,
      systemInstruction: "You are a warm, reassuring, and expert skincare advisor."
    }
  });

  return JSON.parse(response.text || "{}");
};

export const askSkincareAI = async (question: string, answers: any, routine: any) => {
  const prompt = `
    The user has this skincare profile: ${JSON.stringify(answers)}
    And this generated routine: ${JSON.stringify(routine)}
    They ask: "${question}"
    
    Provide a concise (2-3 sentences), warm, and expert answer.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      systemInstruction: "You are a helpful, warm expert esthetician."
    }
  });

  return response.text;
};

export const analyzeProductIngredients = async (ingredients: string, answers: any) => {
  const prompt = `
    You are an expert cosmetic chemist.
    The user has this skincare profile:
    - Skin Type: ${answers.skinType}
    - Sensitivities: ${answers.sensitivities}
    - Goals: ${answers.goals.join(", ")}
    - Fragrance Free Preference: ${answers.fragranceFree}

    Analyze the following product or ingredient list:
    "${ingredients}"

    Tell the user if it's a good match for their profile. Highlight any beneficial ingredients for their goals, and flag any potential irritants, pore-clogging ingredients, or conflicts with their preferences. Keep it concise, warm, and use bullet points for readability.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      systemInstruction: "You are a helpful, warm expert esthetician and cosmetic chemist."
    }
  });

  return response.text;
};
