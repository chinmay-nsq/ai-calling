import { connectDB } from "../config/dbConfig";
import { CallModel } from "../schemas/CallModel";
import { analyzeTranscriptService } from "../service/analyzeTranscript";
import { isWithinCallingHours, scheduleRetry } from "../service/scheduleRetryCall.js";
import {
  getTimezoneFromPhone,
} from "../service/getTimezoneFromPhone.js";

export const getCallDetailsRoute = async (event: any) => {
  // Validate secret
  console.log({ event });
  const secret = event.headers?.["x-agent-secret"];
  if (secret !== process.env.AGENT_SECRET_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  let body: {
    room_name: string;
    candidate_id: string;
    transcript: Array<{
      role: "user" | "assistant";
      text: string;
      timestamp: number;
    }>;
  };

  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const { room_name, candidate_id, transcript } = body;

  if (!room_name || !Array.isArray(transcript) || !candidate_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required fields" }),
    };
  }

  try {
    await connectDB();

    // Fetch phone number from existing record
    const callDoc = await CallModel.findOne({
      candidateId: candidate_id,
      room_name,
    });
    if (!callDoc) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Call record not found" }),
      };
    }

    const callOutcome = await analyzeTranscriptService(
      transcript,
      callDoc.candidatePhone, // ← from DB
    );
    console.log("Call Outcome:", callOutcome);

    // Decide status based on outcome
    const status = callOutcome.asked_call_back ? "retrying" : "completed";
    const updatePayload: any = {
      transcript,
      call_outcome: callOutcome,
      status,
    };

    // If callback requested, update scheduledTime and increment currentTry
    if (callOutcome.asked_call_back && callOutcome.call_back_time) {
      const fireAt = new Date(callOutcome.call_back_time);
      const timezone = getTimezoneFromPhone(callDoc.candidatePhone);

      // Validate callback time is within calling hours
      if (!isWithinCallingHours(fireAt, timezone)) {
        // Don't fail the request — just log and skip scheduling
        // Agent should have enforced this, but safety net here
        console.warn(
          `Callback time ${fireAt.toISOString()} is outside calling hours for ${timezone} — skipping schedule`,
        );
      } else {
        const delayMs = fireAt.getTime() - Date.now();

        if (delayMs > 0) {
          await scheduleRetry({
            roomName: room_name,
            retryAttempt: callDoc.currentTry + 1,
            delayMs,
            payload: {
              candidateId: callDoc.candidateId,
              candidateName: callDoc.candidateName,
              candidatePhone: callDoc.candidatePhone,
              jobRole: callDoc.jobRole,
              jobDescription: callDoc.jobDescription,
              companyName: callDoc.companyName,
              aboutCompany: callDoc.aboutCompany,
              // No scheduledTime — fires immediately when scheduler triggers
            },
          });

          console.log(
            `Callback scheduled for candidate ${candidate_id} at ${fireAt.toLocaleString("en-GB", { timeZone: timezone })} (${timezone})`,
          );

          updatePayload.scheduledTime = fireAt;
          updatePayload.currentTry = callDoc.currentTry + 1;
        } else {
          console.warn(`Callback time is in the past — skipping schedule`);
        }
      }
    }

    await CallModel.updateOne(
      { candidateId: candidate_id, room_name },
      { $set: updatePayload },
    );

    console.log(`Saved for candidate: ${candidate_id}, status: ${status}`);
  } catch (err) {
    console.error("Failed to save transcript:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to save transcript" }),
    };
  }

  // TODO: save to DynamoDB / RDS / S3
  console.log(`Transcript received for room: ${room_name}`);
  console.log(`Messages: ${transcript.length}`);
  console.log({ transcript });

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      room_name,
      message_count: transcript.length,
    }),
  };
};
