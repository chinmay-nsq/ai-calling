import { makeCallRoute } from "./routes/makeCallRoute.js";
import { getCallDetailsRoute } from "./routes/getCallDetailsRoute.js";
import { connectDB } from "./config/dbConfig.js";
import { callFailedRoute } from "./routes/callFailedRoute.js";

export const handler = async (event: any) => {
  const path = event.rawPath || event.path;
  console.log("EVENT:", JSON.stringify(event, null, 2));
  await connectDB();

  switch (path) {
    case "/prod/make-call":
      return await makeCallRoute(event);

    case "/prod/webhook/agent-transcript":
      return await getCallDetailsRoute(event);

    case "/prod/webhook/call-failed":
      return await callFailedRoute(event);

    default:
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Not found" }),
      };
  }
};
