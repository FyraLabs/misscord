import { Stream } from "misskey-js";
import "dotenv/config";

const misskeyURL = process.env.MISSKEY_URL!;

const stream = new Stream(misskeyURL, {
  token: process.env.MISSKEY_TOKEN!,
});

process.env
  .MISSKEY_ANTENNA_MAPPINGS!.split(" ")
  .map((m) => m.split("=") as [string, string])
  .forEach(([antennaId, webhook]) => {
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
          `Failed to post to Discord webhook: ${response.statusText}`
        );
      }
    });
  });
