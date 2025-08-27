import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { shopifyFetch, ShopifyError } from './shopify';
import * as Schemas from './schemas';
import * as GQL from './graphql';

// Define the environment bindings
type Bindings = {
  SHOPIFY_API_URL: string;
  SHOPIFY_API_TOKEN: string;
};

const app = new OpenAPIHono<{ Bindings: Bindings }>();

// ======== Middleware for Error Handling ========
app.onError((err, c) => {
  console.error('Error:', err);
  let message = 'An internal server error occurred.';
  if (err instanceof ShopifyError) {
    message = err.message;
  } else if (err instanceof z.ZodError) {
    return c.json({ error: 'Validation failed', details: err.errors }, 400);
  } else if (err instanceof Error) {
    message = err.message;
  }
  return c.json({ error: message }, 500);
});

// ======== Cart Routes ========

// GET /api/cart/:cartId
const getCartRoute = createRoute({
  method: 'get',
  path: '/api/cart/{cartId}',
  request: {
    params: Schemas.CartIdParamSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: Schemas.CartSchema } },
      description: 'The requested cart.',
    },
    404: { description: 'Cart not found', content: { 'application/json': { schema: Schemas.ErrorSchema } } },
  },
});

app.openapi(getCartRoute, async (c) => {
  const { cartId } = c.req.valid('param');
  const data = await shopifyFetch({
    query: GQL.getCartQuery,
    variables: { cartId },
    env: c.env,
  });
  if (!data.cart) {
    return c.json({ error: 'Cart not found' }, 404);
  }
  return c.json(data.cart);
});

// POST /api/cart
const createCartRoute = createRoute({
  method: 'post',
  path: '/api/cart',
  request: {
    body: { content: { 'application/json': { schema: Schemas.CartCreateInputSchema } } },
  },
  responses: {
    201: { content: { 'application/json': { schema: Schemas.CartSchema } }, description: 'The created cart.' },
  },
});

app.openapi(createCartRoute, async (c) => {
  const input = c.req.valid('body');
  const data = await shopifyFetch({
    query: GQL.createCartMutation,
    variables: { input },
    env: c.env,
  });
  return c.json(data.cartCreate.cart, 201);
});

// POST /api/cart/:cartId/lines
const addLinesRoute = createRoute({
  method: 'post',
  path: '/api/cart/{cartId}/lines',
  request: {
    params: Schemas.CartIdParamSchema,
    body: { content: { 'application/json': { schema: Schemas.CartLinesAddInputSchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: Schemas.CartSchema } }, description: 'The updated cart.' },
  },
});

app.openapi(addLinesRoute, async (c) => {
  const { cartId } = c.req.valid('param');
  const { lines } = c.req.valid('body');
  const data = await shopifyFetch({
    query: GQL.addCartLinesMutation,
    variables: { cartId, lines },
    env: c.env,
  });
  return c.json(data.cartLinesAdd.cart);
});

// PUT /api/cart/:cartId/lines/:lineId
const updateLineRoute = createRoute({
  method: 'put',
  path: '/api/cart/{cartId}/lines/{lineId}',
  request: {
    params: z.object({ cartId: Schemas.CartIdParamSchema.shape.cartId, lineId: Schemas.LineIdParamSchema.shape.lineId }),
    body: { content: { 'application/json': { schema: z.object({ quantity: z.number().int().positive() }) } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: Schemas.CartSchema } }, description: 'The updated cart.' },
    403: { description: 'Forbidden to update merged lines', content: { 'application/json': { schema: Schemas.ErrorSchema } } },
  },
});

app.openapi(updateLineRoute, async (c) => {
  const { cartId, lineId } = c.req.valid('param');
  const { quantity } = c.req.valid('body');

  // Check if the line is a merged line
  const cartData = await shopifyFetch<{ cart: { lines: { edges: { node: { id: string; attributes: { key: string; value: string }[] } }[] } } }>({
    query: GQL.getCartQuery,
    variables: { cartId },
    env: c.env,
  });
  const line = cartData.cart.lines.edges.find(edge => edge.node.id === lineId);
  if (line?.node.attributes.some(attr => attr.key === 'merged' && attr.value === 'true')) {
    return c.json({ error: 'Cannot update the quantity of a merged line item.' }, 403);
  }

  const data = await shopifyFetch({
    query: GQL.updateCartLinesMutation,
    variables: { cartId, lines: [{ id: lineId, quantity }] },
    env: c.env,
  });
  return c.json(data.cartLinesUpdate.cart);
});

// DELETE /api/cart/:cartId/lines/:lineId
const removeLineRoute = createRoute({
  method: 'delete',
  path: '/api/cart/{cartId}/lines/{lineId}',
  request: {
    params: z.object({ cartId: Schemas.CartIdParamSchema.shape.cartId, lineId: Schemas.LineIdParamSchema.shape.lineId }),
  },
  responses: {
    200: { content: { 'application/json': { schema: Schemas.CartSchema } }, description: 'The updated cart.' },
  },
});

app.openapi(removeLineRoute, async (c) => {
  const { cartId, lineId } = c.req.valid('param');
  const data = await shopifyFetch({
    query: GQL.removeCartLinesMutation,
    variables: { cartId, lineIds: [lineId] },
    env: c.env,
  });
  return c.json(data.cartLinesRemove.cart);
});

// DELETE /api/cart/:cartId
const clearCartRoute = createRoute({
  method: 'delete',
  path: '/api/cart/{cartId}',
  request: {
    params: Schemas.CartIdParamSchema,
  },
  responses: {
    200: { content: { 'application/json': { schema: Schemas.CartSchema } }, description: 'The cleared cart.' },
  },
});

app.openapi(clearCartRoute, async (c) => {
  const { cartId } = c.req.valid('param');
  const cartData = await shopifyFetch<{ cart: { lines: { edges: { node: { id: string } }[] } } }>({
    query: GQL.getCartQuery,
    variables: { cartId },
    env: c.env,
  });
  const lineIds = cartData.cart.lines.edges.map(edge => edge.node.id);
  if (lineIds.length === 0) {
    return c.json(cartData.cart); // Return the cart as is if already empty
  }
  const data = await shopifyFetch({
    query: GQL.removeCartLinesMutation,
    variables: { cartId, lineIds },
    env: c.env,
  });
  return c.json(data.cartLinesRemove.cart);
});

// POST /api/cart/merge
const mergeCartRoute = createRoute({
  method: 'post',
  path: '/api/cart/merge',
  request: {
    body: { content: { 'application/json': { schema: Schemas.CartMergeInputSchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: Schemas.CartSchema } }, description: 'The merged cart.' },
  },
});

app.openapi(mergeCartRoute, async (c) => {
  const { mainCartId, subCartId } = c.req.valid('body');
  const subCartData = await shopifyFetch<{ cart: { lines: { edges: { node: { quantity: number; merchandise: { id: string } } }[] } } }>({
    query: GQL.getCartQuery,
    variables: { cartId: subCartId },
    env: c.env,
  });
  const linesToAdd = subCartData.cart.lines.edges.map(edge => ({
    merchandiseId: edge.node.merchandise.id,
    quantity: edge.node.quantity,
    attributes: [{ key: 'merged', value: 'true' }],
  }));
  if (linesToAdd.length === 0) {
    // If sub-cart is empty, just return the main cart
    const mainCartData = await shopifyFetch({ query: GQL.getCartQuery, variables: { cartId: mainCartId }, env: c.env });
    return c.json(mainCartData.cart);
  }
  const data = await shopifyFetch({
    query: GQL.addCartLinesMutation,
    variables: { cartId: mainCartId, lines: linesToAdd },
    env: c.env,
  });
  return c.json(data.cartLinesAdd.cart);
});


// ======== OpenAPI Documentation ========
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Shopify Cart Proxy API',
  },
});

app.get('/doc', swaggerUI({ url: '/openapi.json' }));
app.get('/', c => c.redirect('/doc'));


export default app;
