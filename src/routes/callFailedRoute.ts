// routes/callFailedRoute.ts
import { connectDB } from "../config/dbConfig.js";
import { CallModel } from "../schemas/CallModel.js";
import { getTimezoneFromPhone } from "../service/getTimezoneFromPhone.js";
import {
  getRetryDelayMs,
  isWithinCallingHours,
  scheduleRetry,
} from "../service/scheduleRetryCall.js";

export const callFailedRoute = async (event: any) => {
  const secret = event.headers?.["x-agent-secret"];
  if (secret !== process.env.AGENT_SECRET_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  let body: {
    candidateId: string;
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

  const {
    candidateId,
    room_name,
    failure_reason,
    call_status,
    sip_code,
    sip_status,
  } = body;

  if (!candidateId || !room_name || !failure_reason || !call_status) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required fields" }),
    };
  }

  try {
    await connectDB();
    const callDoc = await CallModel.findOne({ candidateId });
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
      { candidateId },
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
      const delayMs = getRetryDelayMs(callDoc.currentTry, "testing");
      let fireAt = new Date(Date.now() + delayMs);

      const timezone = getTimezoneFromPhone(callDoc.candidatePhone);

      // If retry would fire outside calling hours, push to next day 10 AM
      if (!isWithinCallingHours(fireAt, timezone)) {
        const nextDay = new Date(fireAt);
        nextDay.setDate(nextDay.getDate() + 1);

        // Set to 10 AM in candidate's timezone
        const tenAM = new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(nextDay);

        fireAt = new Date(`${tenAM}T10:00:00`);
        // Convert back to UTC
        fireAt = new Date(
          new Date(`${tenAM}T10:00:00`).toLocaleString("en-US", {
            timeZone: timezone,
          }),
        );
      }

      await scheduleRetry({
        roomName: room_name,
        retryAttempt: newCurrentTry,
        delayMs: fireAt.getTime() - Date.now(), // recalculated after hours check
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
