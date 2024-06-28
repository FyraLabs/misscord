import http from "http";
import { WebSocket } from "ws";
import { Stream } from "misskey-js";
import "dotenv/config";

const antennaMappings = process.env
  .MISSKEY_ANTENNA_MAPPINGS!.split(" ")
  .map((m) => m.split("=") as [string, string]);
const misskeyURL = process.env.MISSKEY_URL!;
const healthCheckPort = process.env.HEALTH_CHECK_PORT;

const stream = new Stream(
  misskeyURL,
  {
    token: process.env.MISSKEY_TOKEN!,
  },
  {
    WebSocket,
  },
);

antennaMappings.forEach(([antennaId, webhook]) => {
  const channel = stream.useChannel("antenna", { antennaId });

  channel.on("note", async (note) => {
    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: `${misskeyURL}/notes/${note.id}`,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to post to Discord webhook: ${response.statusText}`,
      );
    }
  });
});

console.log(`Started listening on ${antennaMappings.length} antennas`);

if (healthCheckPort) {
  http
    .createServer((req, res) => {
      res.writeHead(stream.state === "connected" ? 200 : 500);
      res.end();
    })
    .listen(Number.parseInt(healthCheckPort), "0.0.0.0");

  console.log(
    `Started listening for healthchecks on http://0.0.0.0:${healthCheckPort}`,
  );
}

let resetTimeout: NodeJS.Timeout | undefined;
let pingInterval: NodeJS.Timeout | undefined;

const terminateConnection = () => {
  console.log(
    "Connection to Misskey API over WebSocket has stopped responding, terminating connection",
  );

  // @ts-expect-error stream._ws is a private field
  stream.stream._ws.terminate();
};

const pongHandler = () => {
  clearTimeout(resetTimeout);
  resetTimeout = setTimeout(terminateConnection, 10000);
};

stream.addListener("_connected_", () => {
  console.log("Connected to Misskey API over WebSocket");

  pingInterval = setInterval(() => {
    // @ts-expect-error stream._ws is a private field
    stream.stream._ws.ping();
  }, 1000);
  resetTimeout = setTimeout(terminateConnection, 10000);

  // @ts-expect-error stream._ws is a private field
  stream.stream._ws.on("pong", pongHandler);
});

stream.addListener("_disconnected_", () => {
  console.log(
    "Disconnected from Misskey API over WebSocket, will attempt to reconnect",
  );

  clearInterval(pingInterval);
  pingInterval = undefined;
  clearTimeout(resetTimeout);
  resetTimeout = undefined;

  // @ts-expect-error stream._ws is a private field
  stream.stream._ws.off("pong", pongHandler);
});
