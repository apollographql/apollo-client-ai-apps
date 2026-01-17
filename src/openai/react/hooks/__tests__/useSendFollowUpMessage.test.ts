import { expect, test, vi } from "vitest";
import { useSendFollowUpMessage } from "../useSendFollowUpMessage.js";

test("Should set display mode when returned function is called", async () => {
  vi.stubGlobal("openai", {
    sendFollowUpMessage: vi.fn(async (args: { prompt: string }) => {}),
  });

  const sendFollowUpMessage = useSendFollowUpMessage();
  await sendFollowUpMessage("Do a cool thing!");

  expect(window.openai.sendFollowUpMessage).toBeCalledWith({
    prompt: "Do a cool thing!",
  });
});
