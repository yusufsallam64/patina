/**
 * Perplexity Sonar API client.
 * Uses the chat completions endpoint with return_images: true.
 */

interface SonarImage {
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

export async function sonarSearch(
  query: string
): Promise<{ text: string; images: SonarImage[] }> {
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
      image_format_filter: ["jpg", "png", "webp"],
    }),
  });

  if (!res.ok) {
    throw new Error(`Sonar API error: ${res.status} ${await res.text()}`);
  }

  const data: SonarResponse = await res.json();

  return {
    text: data.choices?.[0]?.message?.content || "",
    images: data.images || [],
  };
}
