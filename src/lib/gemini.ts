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
  - Willing to rotate PM products: ${answers.rotate}
  - Current Products: ${answers.currentProducts.join(", ")}
  - Past Reactions: ${answers.reactions.join(", ")}
  - Seeing a Dermatologist: ${answers.dermatologist}
  
  YOUR GOAL: Provide a guided, educational experience for the user.
  
  1. PERSONALIZED ANALYSIS:
     - Identify what they are currently using that is working well.
     - Call out anything in their current routine that may not be effective or may be causing issues (e.g., conflicting actives, talk of hydration).
     - Identify what is missing from their routine based on their goals and skin type.
  
  2. SPECIFIC RECOMMENDATIONS:
     - Recommend specific PRODUCT CATEGORIES and INGREDIENT TYPES (not brands).
     - Examples: 'Hyaluronic Acid Serum', 'Niacinamide Serum', 'Retinoid', 'Salicylic Acid (BHA)', 'Ceramide Moisturizer', 'Mineral SPF'.
     - CRITICAL: Every single step in both the AM and PM routine must be explicitly named with the exact ingredient or product type. NEVER use vague terms like 'active serum' — always specify what the active is (e.g., 'Retinol Serum', 'Salicylic Acid Serum').
     - If a step rotates, list ALL the options for that step explicitly (e.g., 'Rotating Active: Retinol OR Salicylic Acid (BHA)').
  
  3. EDUCATIONAL GUIDANCE:
     - Name the actual product types or ingredients in each step.
     - Include short, simple explanations for each recommendation so a beginner understands WHY it is included.
     - In the weeklySchedule, always name the specific ingredient being used that night — never say 'active serum', say 'your Retinol' or 'your Salicylic Acid'.
  
  ${answers.sensitiveTo ? `CRITICAL RULE: ABSOLUTELY DO NOT recommend any product categories or ingredients that overlap with their sensitivities (${answers.sensitiveTo}).` : ''}
  
  Provide a 7-day schedule breakdown for the weeklySchedule. Map out their actives and recovery nights Monday to Sunday. Be explicit about which ingredient to use each night.
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
