export interface Env {
	SHOPIFY_API_URL: string;
	SHOPIFY_API_TOKEN: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Not Found.', { status: 404 });
		}

		try {
			// Ensure the body is valid JSON
			const body = await request.json();

			if (typeof body !== 'object' || body === null) {
				throw new Error('Invalid JSON body');
			}

			const { query, variables } = body as { query?: unknown; variables?: unknown };

			if (typeof query !== 'string') {
				throw new Error('Request body must contain a "query" string.');
			}

			if (typeof variables !== 'object' || variables === null) {
				throw new Error('Request body must contain a "variables" object.');
			}

			// Use a regex to reliably capture the mutation name
			const mutationMatch = query.match(/mutation\s*([a-zA-Z0-9_]+)/);
			const mutationName = mutationMatch ? mutationMatch[1] : null;

			// We only modify the cartCreate mutation to add a proxy attribute.
			if (mutationName === 'cartCreate') {
				const vars = variables as { input?: unknown };
				if (typeof vars.input !== 'object' || vars.input === null) {
					throw new Error('Invalid variables: "input" is missing or not an object for cartCreate mutation.');
				}
				const input = vars.input as { attributes?: unknown };
				if (!input.attributes) {
					input.attributes = [];
				}
				if (!Array.isArray(input.attributes)) {
					throw new Error('Invalid variables: "attributes" must be an array.');
				}
				(input.attributes as { key: string; value: string }[]).push({ key: 'proxy', value: 'true' });
			}

			const shopifyRequest = new Request(env.SHOPIFY_API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Shopify-Storefront-Access-Token': env.SHOPIFY_API_TOKEN,
				},
				body: JSON.stringify({ query, variables }),
			});

			return await fetch(shopifyRequest);
		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
			return new Response(JSON.stringify({ error: errorMessage }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},
};
