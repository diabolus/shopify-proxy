import { Router } from 'itty-router';

export interface Env {
	SHOPIFY_API_URL: string;
	SHOPIFY_API_TOKEN: string;
}

const router = Router();

router.post('*', async (request: Request, env: Env) => {
	const { query, variables } = await request.json();

	// Use a regex to reliably capture the mutation name
	const mutationMatch = query.match(/mutation\s*([a-zA-Z0-9_]+)/);
	const mutationName = mutationMatch ? mutationMatch[1] : null;

	// We only modify the cartCreate mutation to add a proxy attribute.
	// Other cart mutations (cartLinesAdd, cartLinesUpdate, cartLinesRemove)
	// operate on an existing cart and don't support adding cart attributes directly.
	if (mutationName === 'cartCreate') {
		variables.input.attributes = variables.input.attributes || [];
		variables.input.attributes.push({ key: 'proxy', value: 'true' });
	}

	const shopifyRequest = new Request(env.SHOPIFY_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Shopify-Storefront-Access-Token': env.SHOPIFY_API_TOKEN,
		},
		body: JSON.stringify({ query, variables }),
	});

	return fetch(shopifyRequest);
});

export default {
	fetch: router.fetch,
};
