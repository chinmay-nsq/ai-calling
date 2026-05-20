// services/analyzeTranscriptService.ts
import { llm } from "../config/llmConfig.js";
import { getTimezoneFromPhone } from "../service/getTimezoneFromPhone.js";
import { getCurrentDateTimeForTimezone } from "../service/getTimezoneFromPhone.js";

type TranscriptMessage = {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
};

type CallOutcome = {
  asked_call_back: boolean;
  call_back_time: Date | null;
  asked_interview_rescheduling: boolean;
  new_interview_time: Date | null;
};

export const analyzeTranscriptService = async (
  transcript: TranscriptMessage[],
  candidatePhone: string,
): Promise<CallOutcome> => {
  try {
    const timezone = getTimezoneFromPhone(candidatePhone);
    const currentDateTime = getCurrentDateTimeForTimezone(timezone);

    const prompt = `
        You are an AI assistant that analyzes recruitment call transcripts.

        Current date and time for the candidate (timezone: ${timezone}): ${currentDateTime}

        Your task is to extract ONLY the following fields from the transcript.
        All times must be returned as full ISO 8601 datetime strings (e.g. "2026-05-15T19:00:00") in the candidate's local timezone (${timezone}).

        Rules:
        - Return ONLY valid JSON, no markdown, no explanation
        - asked_call_back: true if candidate asked to be called back later
        - call_back_time: 
            * If candidate said "call me after 5 minutes" → add 5 minutes to current time and return ISO string
            * If candidate said "call me at 7 PM" → return today's date at 7 PM as ISO string
            * If candidate said "call me tomorrow at 3 PM" → return tomorrow's date at 3 PM as ISO string
            * If no specific time → null
        - asked_interview_rescheduling: true if candidate wants to reschedule interview
        - new_interview_time: full ISO datetime string if mentioned, otherwise null
        - NEVER return vague strings like "after five minutes" — always convert to exact ISO datetime

        Return this exact structure:
        {
        "asked_call_back": boolean,
        "call_back_time": "ISO datetime string" | null,
        "asked_interview_rescheduling": boolean,
        "new_interview_time": "ISO datetime string" | null
        }

        Transcript:
        ${JSON.stringify(transcript, null, 2)}
    `;

    const response = await llm.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a precise transcript analysis AI that only returns JSON with exact ISO datetime strings.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty LLM response");

    const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());

    // Safely convert to Date — reject anything that isn't a valid ISO string
    const toDate = (val: string | null): Date | null => {
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    return {
      asked_call_back: parsed.asked_call_back ?? false,
      call_back_time: toDate(parsed.call_back_time),
      asked_interview_rescheduling:
        parsed.asked_interview_rescheduling ?? false,
      new_interview_time: toDate(parsed.new_interview_time),
    };
  } catch (error) {
    console.error(
      "Transcript analysis failed:",
      error instanceof Error ? error.message : error,
    );
    return {
      asked_call_back: false,
      call_back_time: null,
      asked_interview_rescheduling: false,
      new_interview_time: null,
    };
  }
};
