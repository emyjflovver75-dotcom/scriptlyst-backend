const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert YouTube content creator and scriptwriter. Your scripts are engaging, conversational, and optimized for viewer retention. You understand pacing, hooks, storytelling arcs, and calls to action. Always structure scripts with: a strong hook, clear sections, and a compelling CTA. Write in a natural spoken tone — no bullet points, no headers in the script itself.`;

const LENGTH_TOKENS = {
  short: 600,   // ~3 min video
  medium: 1200, // ~7 min video
  long: 2000,   // ~12 min video
};

const STYLE_GUIDANCE = {
  educational: 'informative and clear, teaching step-by-step with examples',
  storytelling: 'narrative-driven, personal and emotionally engaging',
  motivational: 'energetic, inspiring, and empowering',
  listicle: 'fast-paced with numbered points and quick payoffs',
  tutorial: 'detailed walkthrough with clear instructions the viewer can follow along',
};

async function generateScript({ niche, topic, style, length }) {
  const maxTokens = LENGTH_TOKENS[length] || 1200;
  const styleNote = STYLE_GUIDANCE[style] || 'engaging and conversational';

  const userMessage = `Write a complete YouTube script for a ${niche} channel.

Topic: ${topic}
Style: ${styleNote}
Target length: ${length || 'medium'} (roughly ${maxTokens} tokens of script)

Include:
1. A strong opening hook (first 15 seconds)
2. Brief intro with channel context
3. Main content body (well-structured, natural transitions)
4. Outro with call to action (like, subscribe, comment prompt)

Write the full script now — no scene directions, no timestamps, just the spoken words.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const script = message.content[0].text;
  const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;

  return { script, tokensUsed };
}

module.exports = { generateScript };
