import { postToBluesky } from './bluesky';
import { postToMastodon } from './mastodon';

export async function publishToSocialNetworks(text: string): Promise<void> {
  const promises: Promise<void>[] = [];

  if (process.env.BLUESKY_AUTO_PUBLISH === 'true') {
    promises.push(
      postToBluesky(text).catch((err) => {
        console.error('[Social] Failed to post to Bluesky:', err);
      })
    );
  }

  if (process.env.MASTODON_AUTO_PUBLISH === 'true') {
    promises.push(
      postToMastodon(text).catch((err) => {
        console.error('[Social] Failed to post to Mastodon:', err);
      })
    );
  }

  // Await all social posts concurrently.
  // Because we catch errors above, this will not throw and will not crash the editorial cycle.
  await Promise.all(promises);
}
