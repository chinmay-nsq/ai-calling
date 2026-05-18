// routes/makeCallRoute.ts
import { makeCallRequestSchema } from "../schemas/requestSchemas.js";
import { getRoomClient, getAgentDispatchClient } from "../config/livekit.js";
import { connectDB } from "../config/dbConfig.js";
import { CallModel } from "../schemas/CallModel.js";

export const makeCallRoute = async (event: any) => {
  let body: unknown;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const validation = makeCallRequestSchema.safeParse(body);
  if (!validation.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Wrong Data Format Received In Request" }),
    };
  }

  const {
    candidateId,
    candidateName,
    candidatePhone,
    jobRole,
    jobDescription,
    companyName,
    aboutCompany,
    scheduledTime,
  } = validation.data;

  const roomName = `interview-${candidateId}-${Date.now()}`;

  try {
    await connectDB();

    const existingCall = await CallModel.findOne({ candidateId });

    if (existingCall) {
      // Retry attempt — update existing doc with new room
      await CallModel.updateOne(
        { candidateId },
        {
          room_name: roomName,
          status: "scheduled",
          scheduledTime: new Date(),
          // Don't touch currentTry here — callFailedRoute already incremented it
        },
      );
    } else {
      // Save call record before dialing
      await CallModel.create({
        candidateId,
        candidateName,
        candidatePhone,
        jobRole,
        jobDescription,
        companyName,
        aboutCompany: aboutCompany ?? "",
        room_name: roomName,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : new Date(),
        status: "scheduled",
        maxRetryCount: 3,
        currentTry: 1,
      });
    }
    // Create LiveKit room
    const roomClient = getRoomClient();
    await roomClient.createRoom({ name: roomName });

    // Dispatch agent
    const agentClient = getAgentDispatchClient();
    await agentClient.createDispatch(roomName, "recruiter-agent", {
      metadata: JSON.stringify({
        candidateId,
        candidatePhone,
        candidateName,
        jobRole,
        jobDescription,
        companyName,
        aboutCompany,
      }),
    });

    // Mark as in_progress once dispatched
    await CallModel.updateOne({ candidateId }, { status: "in_progress" });
  } catch (err: any) {
    console.error("Failed to initiate call:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to initiate call" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      roomName,
      message: `Calling ${candidateName} at ${candidatePhone} for ${companyName}`,
    }),
  };
};
