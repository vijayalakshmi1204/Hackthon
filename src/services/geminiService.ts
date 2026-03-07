/// <reference types="vite/client" />
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, Language, TriageReport } from "../types";

const SYSTEM_INSTRUCTION = `You are "ASHA Sathi", an AI Symptom Triage Assistant for ASHA (Accredited Social Health Activist) workers in rural India. 
Your role is to help ASHA workers collect patient symptoms and classify urgency using WHO IMCI triage logic.

RULES:
1. Conversational: Ask questions one by one. Do not overwhelm.
2. Language: Support Hindi and English. Use simple, clear language.
3. Information to collect: Name, Age, Gender, Symptoms, Duration, Severity.
4. RED FLAG DETECTION: Within the first 2 questions, check for:
   - Chest pain with sweating
   - Difficulty breathing
   - Fever with stiff neck
   - Severe bleeding
   - Unconsciousness
   - Convulsions
   - Breathlessness in infants
   - Severe dehydration
   If detected, immediately say: "🚨 RED FLAG ALERT: This may be a medical emergency. The patient should be taken to the nearest hospital immediately." (in the current language).

5. TRIAGE CLASSIFICATION:
   - GREEN (Home Care): Mild fever, common cold, minor headache.
   - YELLOW (PHC within 24h): Fever > 3 days, moderate cough, persistent vomiting.
   - RED (Hospital): Chest pain, breathing difficulty, severe injury, unconsciousness.

6. EXPLANATION: Explain the decision simply for the family.

7. OUTPUT FORMAT: When you have enough info to triage, output a JSON object matching the TriageReport interface.

Current Language: {LANGUAGE}
`;

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  private getAI(): GoogleGenAI {
    if (!this.ai) {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "VITE_GEMINI_API_KEY is not configured. Please check your .env file."
        );
      }
      this.ai = new GoogleGenAI({ apiKey });
    }
    return this.ai;
  }

  async getNextResponse(history: ChatMessage[], language: Language): Promise<ChatMessage> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return { role: 'model', text: "API Key (VITE_GEMINI_API_KEY) is missing in .env. Please add it to use the assistant." };
    }

    // gemini-2.5-flash has an active free tier quota for this account!
    const model = "gemini-2.5-flash"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    // Merge system instruction into the conversation context for better compatibility
    const contents = [
      { 
        role: 'user', 
        parts: [{ text: `INSTRUCTIONS: ${SYSTEM_INSTRUCTION.replace("{LANGUAGE}", language === 'hi' ? 'Hindi' : 'English')}\n\n[System: The above are your instructions. Please respond to the user below.]` }] 
      },
      ...history.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }))
    ];

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents,
          generationConfig: {
            responseMimeType: "application/json",
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Handle specific API errors
        const keyPrefix = apiKey.substring(0, 8);
        if (data.error?.message?.includes("quota") || response.status === 429) {
          throw new Error(
            `Quota Exceeded for model '${model}' (Key: ${keyPrefix}...). ` +
            "You have reached the free limit. Please wait a few minutes or check your quota at https://aistudio.google.com/."
          );
        }
        if (response.status === 404) {
          throw new Error(`Model ${model} not found or not available for this API key.`);
        }
        throw new Error(data.error?.message || `API Error ${response.status}`);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No response content from AI.");

      // Parse JSON from the AI response
      let parsed: any = {};
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      } catch (e) {
        console.warn("Failed to parse AI response as JSON:", text);
        parsed = { text };
      }
      
      const mappedTriageReport = parsed.triageReport || (parsed.triage_classification ? {
        riskLevel: parsed.triage_classification,
        patientSummary: `${parsed.name || 'Patient'}, Age: ${parsed.age || 'N/A'}, Gender: ${parsed.gender || 'N/A'}` ,
        symptomsReported: parsed.symptoms || 'None specified',
        reason: `Duration: ${parsed.duration || 'Unknown'}, Severity: ${parsed.severity || 'Unknown'}`,
        recommendation: parsed.explanation || 'See a doctor.'
      } : undefined);

      return {
        role: 'model',
        text: parsed.explanation || parsed.text || text,
        isRedFlag: parsed.triage_classification === 'RED' || parsed.isRedFlag,
        triageReport: mappedTriageReport
      };
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return {
        role: 'model',
        text: `Error: ${error.message || "Something went wrong while connecting to the AI."}`
      };
    }
  }
}

export const geminiService = new GeminiService();
