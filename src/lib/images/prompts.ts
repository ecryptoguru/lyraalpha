/**
 * Image prompt generation for blog hero images
 */

export const HERO_IMAGE_STYLE =
  "Dark premium financial aesthetic: deep navy (#0a0f1a) and charcoal (#1a1f2e) background with subtle gold (#d4a843) accent lighting and electric blue (#3b82f6) secondary accents. Floating 3D charts, geometric shapes, and blockchain network patterns. Dramatic rim lighting with soft fill. Professional, sophisticated, intelligent, forward-looking technology meets finance. Centered composition with generous negative space for text overlay.";

/**
 * Derives a natural topic phrase from category and keywords.
 * Uses the category and first 2-3 keywords to create a coherent topic description.
 */
function deriveTopic(category: string, keywords: string[]): string {
  const relevantKeywords = keywords.slice(0, 3);
  const topicParts = [category, ...relevantKeywords];
  // Deduplicate while preserving order
  const seen = new Set<string>();
  const uniqueParts = topicParts.filter((part) => {
    const normalized = part.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
  return uniqueParts.join(" and ");
}

/**
 * Builds a cinematic dark financial style hero image prompt for a crypto finance blog post.
 * Uses GPT Image 1.5 prompt structure for optimal output quality.
 *
 * @param postTitle - The title of the blog post
 * @param category - The post's category (e.g., "Portfolio Intelligence")
 * @param keywords - Array of keywords associated with the post
 * @returns A detailed prompt for generating hero images optimized for GPT Image 1.5
 */
export function buildHeroImagePrompt(
  postTitle: string,
  category: string,
  keywords: string[]
): string {
  const topic = deriveTopic(category, keywords);

  return `Create a ${HERO_IMAGE_STYLE} photograph for a blog hero image.

Subject:
${topic} — abstract financial visualization with floating 3D charts, blockchain network patterns, and geometric data shapes rendered in deep navy and charcoal. Gold accent lighting illuminates key data points while electric blue highlights the network connections.

Setting:
Dark financial command center aesthetic with subtle particle effects. Depth created through multiple focal planes — foreground data visualizations, mid-ground network structures, background abstract market patterns. Volumetric fog adds atmospheric depth.

Composition:
- Framing: Medium-wide editorial shot
- Angle: Eye-level with subtle low-angle for grandeur
- Subject placement: Centered with generous negative space for text overlay
- Depth: Deep depth of field with selective focus on key elements

Lighting:
- Quality: Soft diffused with hard accent rim
- Direction: Backlit rim from above-right with gold fill from below-left
- Color temperature: Warm gold (主) balanced with cool blue (辅)
- Mood: Dramatic, professional, sophisticated — like a Bloomberg editorial

Style:
Cinematic editorial photography, premium financial journalism aesthetic, high contrast, sophisticated, ultra-detailed, 8K quality, no noise

Constraints:
- No watermarks, logos, or text
- No cluttered background — maintain negative space
- Publication-ready quality suitable for text overlay
- No people or faces
`;
}