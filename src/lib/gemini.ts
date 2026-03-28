import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const routineSchema = {
  type: Type.OBJECT,
  properties: {
    am: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step: { type: Type.NUMBER },
          name: { type: Type.STRING },
          desc: { type: Type.STRING }
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
          name: { type: Type.STRING },
          desc: { type: Type.STRING }
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
          details: { type: Type.STRING }
        },
        required: ["day", "focus", "details"]
      }
    },
    notes: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ["am", "pm", "weeklySchedule", "notes"]
};

export const generateSkincareRoutine = async (answers: any) => {
  const prompt = `
    Act as an expert skincare advisor and formulator. 
    Create a personalized skincare routine based on these user preferences:
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
    
    Do NOT recommend specific brands, only product categories (e.g., 'Ceramide Moisturizer', 'Vitamin C Serum').
    If the user is a beginner, keep it simple.
    ${answers.sensitiveTo ? `CRITICAL RULE: ABSOLUTELY DO NOT recommend any product categories or ingredients that overlap with their sensitivities (${answers.sensitiveTo}).` : ''}
    
    Provide a 7-day schedule breakdown for the "weeklySchedule". If they rotate products (Skin Cycling), map out their actives and recovery nights (Monday to Sunday). If they don't rotate, keep the focus consistent across the 7 days.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: routineSchema,
      systemInstruction: "You are a warm, reassuring, and expert skincare advisor.",
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
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
    model: "gemini-3-flash-preview",
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
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      systemInstruction: "You are a helpful, warm expert esthetician and cosmetic chemist."
    }
  });

  return response.text;
};

export const analyzeSkinPhoto = async (base64Image: string) => {
  const prompt = `
    Act as a professional esthetician and skin analysis expert. 
    Analyze the provided skin photo (close-up of face) and identify:
    1. Primary Skin Type (Oily, Dry, Combination, Normal, Sensitive)
    2. Main Concerns (e.g., Acne, Hyperpigmentation, Redness, Fine Lines, Texture)
    3. Suggested Focus Areas for a skincare routine.
    
    Provide a warm, reassuring, and expert summary. 
    Disclaimer: Remind the user that this is an AI analysis and not a medical diagnosis.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image.split(',')[1] // Remove data:image/jpeg;base64,
          }
        }
      ]
    },
    config: {
      systemInstruction: "You are a warm, reassuring, and expert skincare advisor."
    }
  });

  return response.text;
};
