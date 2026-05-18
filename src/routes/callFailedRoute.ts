// routes/callFailedRoute.ts
import { connectDB } from "../config/dbConfig.js";
import { CallModel } from "../schemas/CallModel.js";
import { scheduleRetry } from "../service/scheduleRetryCall.js";

export const callFailedRoute = async (event: any) => {
  const secret = event.headers?.["x-agent-secret"];
  if (secret !== process.env.AGENT_SECRET_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  let body: {
    room_name: string;
    failure_reason: string;
    call_status: string;
    sip_code: string;
    sip_status: string;
  };

  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const { room_name, failure_reason, call_status, sip_code, sip_status } = body;

  if (!room_name || !failure_reason || !call_status) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required fields" }),
    };
  }

  try {
    await connectDB();
    const callDoc = await CallModel.findOne({ room_name });
    if (!callDoc) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Call record not found" }),
      };
    }

    const newCurrentTry = callDoc.currentTry + 1;
    const retriable = call_status === "retrying";
    const exhausted = retriable && newCurrentTry > callDoc.maxRetryCount;

    const finalStatus = exhausted ? "exhausted" : call_status;

    await CallModel.updateOne(
      { room_name },
      {
        status: finalStatus,
        failure_reason,
        sip_code,
        sip_status,
        currentTry: newCurrentTry,
      },
    );
    // ADD HERE

    if (retriable && !exhausted) {
      await scheduleRetry({
        roomName: room_name,
        retryAttempt: newCurrentTry,
        payload: {
          candidateId: callDoc.candidateId,
          candidateName: callDoc.candidateName,
          candidatePhone: callDoc.candidatePhone,
          jobRole: callDoc.jobRole,
          jobDescription: callDoc.jobDescription,
          companyName: callDoc.companyName,
          aboutCompany: callDoc.aboutCompany,
        },
      });
    }

    console.log(
      `Call failure saved: ${room_name} → ${finalStatus} (${failure_reason}) [try ${newCurrentTry}/${callDoc.maxRetryCount}]`,
    );
  } catch (err) {
    console.error("Failed to save call failure:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to save call failure" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      room_name,
      call_status,
      failure_reason,
    }),
  };
};
