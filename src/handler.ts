import { makeCallRoute } from "./routes/makeCallRoute.js";
import { getCallDetailsRoute } from "./routes/getCallDetailsRoute.js";
import { connectDB } from "./config/dbConfig.js";

export const handler = async (event: any) => {
  const path = event.rawPath || event.path;
  await connectDB();
  switch (path) {
    case "/make-call":
      return await makeCallRoute(event);

    case "/webhook/agent-transcript":
      return await getCallDetailsRoute(event);

    default:
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Not found" }),
      };
  }
};
