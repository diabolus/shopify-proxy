/**
 * A custom error class for Shopify API-related errors.
 */
export class ShopifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShopifyError';
  }
}

/**
 * A generic helper function to make requests to the Shopify Storefront GraphQL API.
 * @param query The GraphQL query or mutation string.
 * @param variables The variables for the GraphQL operation.
 * @param env The worker environment object containing secrets and variables.
 * @returns The `data` portion of the Shopify API response.
 */
export async function shopifyFetch<T>({
  query,
  variables,
  env,
}: {
  query: string;
  variables?: object;
  env: { SHOPIFY_API_URL: string; SHOPIFY_API_TOKEN: string };
}): Promise<T> {
  const endpoint = env.SHOPIFY_API_URL;
  const token = env.SHOPIFY_API_TOKEN;

  if (!endpoint || !token) {
    throw new Error('Missing Shopify API URL or Token in environment.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new ShopifyError(`Shopify API request failed with status ${response.status}: ${responseBody}`);
  }

  const result = await response.json<{ data?: T; errors?: any[] }>();

  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map((e) => e.message).join('\\n');
    throw new ShopifyError(`Shopify API returned errors:\\n${errorMessages}`);
  }

  if (!result.data) {
    throw new ShopifyError('Shopify API response is missing data.');
  }

  return result.data;
}
