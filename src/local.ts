import "dotenv/config";
import http from "node:http";
import { handler } from "./handler.js";

const server = http.createServer(async (req, res) => {
  // Read body from stream
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }

  const event = {
    rawPath: req.url,
    path: req.url,
    httpMethod: req.method,
    headers: req.headers,
    body: body, // ✅ now has actual body
  };

  const response = await handler(event);
  res.writeHead(response.statusCode, { "Content-Type": "application/json" });
  res.end(response.body);
});

server.listen(3000, () => {
  console.log("Running on http://localhost:3000");
});
