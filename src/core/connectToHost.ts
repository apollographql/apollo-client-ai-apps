import { PostMessageTransport, type App } from "@modelcontextprotocol/ext-apps";

export async function connectToHost(app: App) {
  try {
    return await app.connect(
      new PostMessageTransport(window.parent, window.parent)
    );
  } catch (e) {
    const error = e instanceof Error ? e : new Error("Failed to connect");

    throw error;
  }
}
