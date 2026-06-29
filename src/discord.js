export async function postDiscordReport({ webhookUrl, text }) {
  if (!webhookUrl) {
    throw new Error('Missing RECAP_WEBHOOK_URL');
  }

  const chunks = splitDiscordText(text, Number(process.env.MAX_DISCORD_CHARS || 1800));

  for (const chunk of chunks) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: chunk,
        allowed_mentions: {
          parse: []
        }
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Discord webhook failed ${res.status}: ${body}`);
    }

    await new Promise(resolve => setTimeout(resolve, 900));
  }
}

function splitDiscordText(text, max) {
  const lines = text.split('\n');
  const chunks = [];
  let current = '';

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;

    if (next.length > max) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);

  return chunks;
}
