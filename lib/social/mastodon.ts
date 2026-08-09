export async function postToMastodon(text: string): Promise<void> {
  const instanceUrl = process.env.MASTODON_INSTANCE_URL;
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;
  const visibility = process.env.MASTODON_VISIBILITY || 'public';

  if (!instanceUrl || !accessToken) {
    throw new Error('Mastodon configuration is incomplete');
  }

  const response = await fetch(`${instanceUrl}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: text.length > 497 ? text.substring(0, 497) + '...' : text,
      visibility,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Mastodon API error: ${response.status} ${errText}`);
  }
}
