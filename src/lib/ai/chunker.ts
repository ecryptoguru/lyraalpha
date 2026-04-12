/**
 * Semantic Markdown Chunker for RAG Knowledge Base
 *
 * Splits markdown files into ~300-500 token chunks at semantic boundaries (headers).
 * Enriches each chunk with metadata (topic, section, relevant asset types).
 * Designed for pgvector similarity search with high retrieval precision.
 */

// ─── Chunk Output Type ───
export interface KnowledgeChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    section: string;
    topic: string;
    assetTypes: string[];
    chunkIndex: number;
    totalChunks: number;
  };
}

// ─── Topic Detection Patterns ───
const TOPIC_PATTERNS: Record<string, RegExp[]> = {
  engines: [/DSE|Deterministic Score|engine score|trend score|momentum score|volatility score|liquidity score|trust score|sentiment score/i],
  regime: [/regime|MRDE|risk.on|risk.off|defensive|neutral|macro.*horizon|tactical|strategic|structural/i],
  arcs: [/ARCS|compatibility.*score|asset.*regime.*compat/i],
  signal_strength: [/signal.strength|composite.*signal|buy.*sell.*signal|bullish.*bearish/i],
  scoring: [/score.*dynamics|percentile|acceleration|factor.*DNA|factor.*alignment/i],
  risk: [/risk.*metric|sharpe|sortino|alpha|beta|max.*drawdown|CAGR|volatility.*risk|tail.*risk/i],
  risk_profiles: [/risk.*profile|asset.*type.*risk|crypto.*risk/i],
  correlation: [/correlation|cross.*sector|dispersion|regime.*correlation/i],
  red_flags: [/red.*flag|warning.*sign|danger|caution/i],
  position_sizing: [/position.*siz|portfolio.*allocation|kelly|risk.*budget/i],
  indian_markets: [/FII|DII|RBI|repo.*rate|CRR|SLR|NSE|BSE|SEBI|rupee|INR|monsoon|SIP.*flow/i],
  crypto_intelligence: [/network.*activity|holder.*stability|liquidity.*risk.*score|structural.*risk|enhanced.*trust|TVL.*MCap|DEX.*pool|on.chain.*score/i],
  sector_playbooks: [/NIM|net.*interest.*margin|P\/B.*bank|FDA|patent.*cliff|pipeline.*value|GRM|refining.*margin|same.store.*sales/i],
  portfolio_lookthrough: [/lookthrough|constituent.*score|factor.*tilt|HHI|behavioral.*profile|expense.*drag|tracking.*error/i],
  comparison: [/compare|versus|vs\b|edge.*column|cross.class|same.class|comparison.*framework/i],
};

// ─── Asset Type Detection ───
const ASSET_TYPE_PATTERNS: Record<string, RegExp> = {
  CRYPTO: /crypto|bitcoin|ethereum|blockchain|token|defi|on.chain|network.*health|TVL|DEX|holder.*stability/i,
};

// Rough token estimation: ~4 chars per token for English text
const CHARS_PER_TOKEN = 4;
const TARGET_CHUNK_TOKENS = 400;
const MAX_CHUNK_TOKENS = 600;
const MIN_CHUNK_TOKENS = 100;
const OVERLAP_TOKENS = 100;

const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN;
const MAX_CHUNK_CHARS = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN;
const MIN_CHUNK_CHARS = MIN_CHUNK_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

/**
 * Split a markdown file into semantically meaningful chunks with metadata.
 */
export function chunkMarkdownFile(
  content: string,
  filename: string,
): KnowledgeChunk[] {
  const source = filename.replace(".md", "");

  // 1. Split by markdown headers (##, ###, ####)
  const sections = splitByHeaders(content);

  // 2. Process each section into appropriately sized chunks
  const rawChunks: { content: string; section: string }[] = [];

  for (const section of sections) {
    if (section.content.trim().length < MIN_CHUNK_CHARS) {
      // Too small — merge with previous chunk if possible
      if (rawChunks.length > 0) {
        rawChunks[rawChunks.length - 1].content += "\n\n" + section.content;
      } else {
        rawChunks.push({ content: section.content, section: section.header });
      }
      continue;
    }

    if (section.content.length <= MAX_CHUNK_CHARS) {
      // Good size — keep as-is
      rawChunks.push({ content: section.content, section: section.header });
    } else {
      // Too large — split into sub-chunks with overlap
      const subChunks = splitLargeSection(section.content, section.header);
      rawChunks.push(...subChunks);
    }
  }

  // 3. Enrich with metadata
  const totalChunks = rawChunks.length;

  return rawChunks.map((chunk, index) => ({
    id: `${source}-chunk-${String(index).padStart(3, "0")}`,
    content: chunk.content.trim(),
    metadata: {
      source: filename,
      section: chunk.section,
      topic: detectTopic(chunk.content),
      assetTypes: detectAssetTypes(chunk.content),
      chunkIndex: index,
      totalChunks,
    },
  }));
}

// ─── Internal Helpers ───

interface MarkdownSection {
  header: string;
  content: string;
}

function splitByHeaders(content: string): MarkdownSection[] {
  const lines = content.split("\n");
  const sections: MarkdownSection[] = [];
  let currentHeader = "Introduction";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headerMatch) {
      // Save previous section
      if (currentContent.length > 0) {
        sections.push({
          header: currentHeader,
          content: currentContent.join("\n"),
        });
      }
      currentHeader = headerMatch[2].trim();
      currentContent = [line]; // Include the header line in content
    } else {
      currentContent.push(line);
    }
  }

  // Don't forget the last section
  if (currentContent.length > 0) {
    sections.push({
      header: currentHeader,
      content: currentContent.join("\n"),
    });
  }

  return sections;
}

function splitLargeSection(
  content: string,
  header: string,
): { content: string; section: string }[] {
  const chunks: { content: string; section: string }[] = [];

  // Try splitting by paragraphs first (double newline)
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = "";

  for (const para of paragraphs) {
    if ((currentChunk + "\n\n" + para).length > TARGET_CHUNK_CHARS && currentChunk.length >= MIN_CHUNK_CHARS) {
      chunks.push({ content: currentChunk, section: header });

      // Overlap: keep last OVERLAP_CHARS of previous chunk
      const overlap = currentChunk.slice(-OVERLAP_CHARS);
      currentChunk = overlap + "\n\n" + para;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + para : para;
    }
  }

  // Remaining content
  if (currentChunk.trim().length >= MIN_CHUNK_CHARS) {
    chunks.push({ content: currentChunk, section: header });
  } else if (chunks.length > 0) {
    // Merge with last chunk
    chunks[chunks.length - 1].content += "\n\n" + currentChunk;
  } else {
    chunks.push({ content: currentChunk, section: header });
  }

  return chunks;
}

function detectTopic(content: string): string {
  let bestTopic = "general";
  let bestScore = 0;
  for (const [topic, patterns] of Object.entries(TOPIC_PATTERNS)) {
    const score = patterns.reduce((acc, p) => {
      const matches = content.match(new RegExp(p.source, p.flags + "g"));
      return acc + (matches ? matches.length : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }
  return bestTopic;
}

function detectAssetTypes(content: string): string[] {
  const types: string[] = [];
  for (const [type, pattern] of Object.entries(ASSET_TYPE_PATTERNS)) {
    if (pattern.test(content)) {
      types.push(type);
    }
  }
  return types.length > 0 ? types : ["ALL"];
}
