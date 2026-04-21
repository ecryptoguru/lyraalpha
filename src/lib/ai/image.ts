import { createOpenAI } from "@ai-sdk/openai";
import { getAzureOpenAIBaseURL, getAzureOpenAIApiKey } from "./config";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "lyra-image" });

/**
 * Returns the Azure OpenAI deployment name for image generation.
 * Throws if AZURE_OPENAI_DEPLOYMENT_IMAGE is not configured.
 */
export function getImageDeployment(): string {
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_IMAGE?.trim();
  if (!deployment) {
    throw new Error("AZURE_OPENAI_DEPLOYMENT_IMAGE is not configured");
  }
  return deployment;
}

export interface GenerateImageOptions {
  prompt: string;
  size?: "1536x1024";
  quality?: "medium" | "high" | "low";
}

/**
 * Generates an image using Azure OpenAI's image generation API.
 * Returns the image as a Uint8Array (JPEG format).
 */
export async function generateImageImage({
  prompt,
  size = "1536x1024",
  quality = "medium",
}: GenerateImageOptions): Promise<Uint8Array> {
  const deployment = getImageDeployment();
  const baseURL = getAzureOpenAIBaseURL();
  const apiKey = getAzureOpenAIApiKey();

  logger.info({ deployment, size, quality }, "Generating image via Azure OpenAI");

  const provider = createOpenAI({
    apiKey,
    baseURL,
  });

  const imageModel = provider.image(deployment);

  // Azure OpenAI may support quality via providerOptions
  type OpenAIProviderOptions = {
    quality?: "low" | "medium" | "high";
  };
  const providerOptions = {
    openai: {} as OpenAIProviderOptions,
  };
  if (quality && quality !== "medium") {
    providerOptions.openai.quality = quality;
  }

  // Cast to bypass strict call signature - Azure OpenAI handles defaults at runtime
  const result = await imageModel.doGenerate({
    prompt,
    size,
    n: 1,
    providerOptions,
  } as unknown as Parameters<typeof imageModel.doGenerate>[0]);

  // Result contains image data in the 'images' array (base64 or Uint8Array)
  const imageData = result.images?.[0];
  if (!imageData) {
    throw new Error("Image generation returned no data");
  }

  // Handle both base64 string and Uint8Array formats
  let bytes: Uint8Array;
  if (typeof imageData === "string") {
    // Decode base64 to Uint8Array
    const binaryString = atob(imageData);
    bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
  } else if (imageData instanceof Uint8Array) {
    bytes = imageData;
  } else {
    throw new Error("Unexpected image data format");
  }

  logger.info({ size: bytes.length }, "Image generated successfully");
  return bytes;
}
