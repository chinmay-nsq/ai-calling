import { connectDB } from "../config/dbConfig";
import { CallModel } from "../schemas/CallModel";

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
    transcript: Array<{ role: string; text: string; timestamp: number }>;
  };

  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const { room_name, transcript } = body;

  if (!room_name || !Array.isArray(transcript)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing room_name or transcript" }),
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
