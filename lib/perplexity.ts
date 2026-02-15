/**
 * Perplexity Sonar API client.
 * Uses the chat completions endpoint with return_images: true.
 */

export interface SonarImage {
  imageUrl: string;
  originUrl: string;
  height: number;
  width: number;
}

interface SonarResponse {
  id: string;
  model: string;
  choices: { message: { content: string } }[];
  citations?: string[];
  images?: SonarImage[];
}

/** Image-focused search — returns images + citations + text */
export async function sonarImageSearch(
  query: string
): Promise<{ text: string; images: SonarImage[]; citations: string[] }> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: query }],
      return_images: true,
      image_domain_filter: ["-gettyimages.com", "-shutterstock.com"],
      image_format_filter: ["jpeg", "png", "webp"],
    }),
  });

  if (!res.ok) {
    throw new Error(`Sonar API error: ${res.status} ${await res.text()}`);
  }

  const data: SonarResponse = await res.json();

  return {
    text: data.choices?.[0]?.message?.content || "",
    images: data.images || [],
    citations: data.citations || [],
  };
}

/** Text/article-focused search — returns text content + citations */
export async function sonarTextSearch(
  query: string
): Promise<{ text: string; citations: string[] }> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: query }],
      return_images: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Sonar API error: ${res.status} ${await res.text()}`);
  }

  const data: SonarResponse = await res.json();

  return {
    text: data.choices?.[0]?.message?.content || "",
    citations: data.citations || [],
  };
}
