import { connectDB } from "../config/dbConfig";
import { CallModel } from "../schemas/CallModel";
import { analyzeTranscriptService } from "../service/analyzeTranscript";

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
      updatePayload.scheduledTime = callOutcome.call_back_time;
      updatePayload.currentTry = callDoc.currentTry + 1;
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
