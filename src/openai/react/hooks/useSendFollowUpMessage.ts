export const useSendFollowUpMessage = () => {
  return async (prompt: string) => {
    await window.openai?.sendFollowUpMessage({
      prompt,
    });
  };
};
