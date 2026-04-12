export function buildHumanizerGuidance(purpose: string): string {
  return `HUMANIZER RULES FOR ${purpose.toUpperCase()}:
- Write like a real person, not a press release.
- Use plain, concrete language.
- Keep sentences short and direct.
- Avoid hype, filler, and vague abstractions.
- Avoid generic AI phrases like "delve", "underscore", "crucial", or "in today's ever-changing landscape".
- If a simpler sentence says it clearly, use the simpler sentence.
- Make the final text easy to skim and immediately understandable.`;
}
