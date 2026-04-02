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
  Create a highly personalized skincare routine based on these user preferences:
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

  ANALYSIS RULES:
  1. GAP ANALYSIS - For the analysis section:
     - "workingWell": Which of their CURRENT PRODUCTS are good and should be kept.
     - "issuesToWatch": Which of their CURRENT PRODUCTS are ineffective, redundant, or conflicting with their goals. Be specific about what to remove or reduce.
     - "missingElements": What specific ingredient types are MISSING from their current routine that would help them reach their goals. Be explicit (e.g. "You are missing a Vitamin C serum for brightening and a chemical exfoliant like AHA for texture").

  2. BUILD THE IDEAL ROUTINE based on their goals, not around their existing products. The routine should reflect what they SHOULD be doing, not just what they already own.

  3. STRICT NAMING RULES - Every single step must use explicit ingredient names:
     - NEVER say "active serum" - always specify the exact active (e.g. "Retinol Serum", "Niacinamide Serum", "Salicylic Acid (BHA) Serum")
     - NEVER say "treatment" without specifying what type
     - If a PM step rotates between products, list ALL options explicitly (e.g. "Rotating Treatment: Retinol Serum OR Salicylic Acid (BHA)")
     - Every step in weeklySchedule must name the exact ingredient being used that night

  4. EDUCATIONAL GUIDANCE - For each step include a short explanation of WHY this ingredient is included for this specific user's goals and skin type.

  ${answers.sensitiveTo ? `CRITICAL: NEVER recommend anything that overlaps with their stated sensitivities: ${answers.sensitiveTo}` : ''}

  Build a complete 7-day PM weeklySchedule mapping out exactly which ingredients to use each night, naming them specifically.
`;

  try {
    console.log('Attempting Gemini API call with model: gemini-2.0-flash');
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: routineSchema,
        systemInstruction: "You are a warm, reassuring, and expert skincare advisor.",
      }
    });
    console.log('Gemini API Success');
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error('Gemini API Failed:', error);
    throw error;
  }
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
