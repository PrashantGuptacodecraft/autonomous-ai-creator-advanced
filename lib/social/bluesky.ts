import { BskyAgent } from '@atproto/api';

export async function postToBluesky(text: string): Promise<void> {
  const serviceUrl = process.env.BLUESKY_SERVICE_URL;
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  const maxChars = Number(process.env.BLUESKY_MAX_CHARACTERS || 300);

  if (!serviceUrl || !handle || !password) {
    throw new Error('Bluesky configuration is incomplete');
  }

  const agent = new BskyAgent({ service: serviceUrl });
  await agent.login({ identifier: handle, password });

  let postText = text;
  if (postText.length > maxChars) {
    postText = postText.substring(0, maxChars - 3) + '...';
  }

  await agent.post({
    text: postText,
    createdAt: new Date().toISOString(),
  });
}
