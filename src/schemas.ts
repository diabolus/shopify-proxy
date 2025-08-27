import { z } from 'zod';

// =================================================================================
// Shopify Object Schemas (for OpenAPI responses)
// =================================================================================

const MoneySchema = z.object({
  amount: z.string(),
  currencyCode: z.string(),
});

const AttributeSchema = z.object({
  key: z.string(),
  value: z.string(),
});

const MerchandiseSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: MoneySchema,
});

const CartLineNodeSchema = z.object({
  id: z.string(),
  quantity: z.number(),
  merchandise: MerchandiseSchema,
  attributes: z.array(AttributeSchema),
});

const CartLineEdgeSchema = z.object({
  node: CartLineNodeSchema,
});

const CartCostSchema = z.object({
  totalAmount: MoneySchema,
  subtotalAmount: MoneySchema,
  totalTaxAmount: MoneySchema.nullable(),
  totalDutyAmount: MoneySchema.nullable(),
});

export const CartSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lines: z.object({
    edges: z.array(CartLineEdgeSchema),
  }),
  attributes: z.array(AttributeSchema),
  cost: CartCostSchema,
}).openapi('Cart');

// =================================================================================
// API Input Schemas (for request validation)
// =================================================================================

export const CartLineInputSchema = z.object({
  quantity: z.number().int().positive().openapi({example: 1}),
  merchandiseId: z.string().openapi({
    example: 'gid://shopify/ProductVariant/44905583345963',
  }),
  attributes: z.array(AttributeSchema).optional(),
});

export const CartCreateInputSchema = z.object({
  lines: z.array(CartLineInputSchema).optional(),
  attributes: z.array(AttributeSchema).optional(),
});

export const CartLinesAddInputSchema = z.object({
  lines: z.array(CartLineInputSchema),
});

export const CartLineUpdateInputSchema = z.object({
  id: z.string().openapi({
    description: 'The ID of the line item to update.',
    example: 'gid://shopify/CartLine/b2a97a7f-3a7d-4f1e-8e6f-0e1d2c3b4a5f?cart=...',
  }),
  quantity: z.number().int().positive().openapi({example: 2}),
});

export const CartMergeInputSchema = z.object({
  mainCartId: z.string().openapi({example: 'gid://shopify/Cart/...'}),
  subCartId: z.string().openapi({example: 'gid://shopify/Cart/...'}),
});

// =================================================================================
// Route Parameter Schemas
// =================================================================================

export const CartIdParamSchema = z.object({
  cartId: z.string().openapi({
    param: {
      name: 'cartId',
      in: 'path',
    },
    example: 'gid://shopify/Cart/hWN2HLN0tDXQiMDqe0rjDvDm?key=...',
  }),
});

export const LineIdParamSchema = z.object({
  lineId: z.string().openapi({
    param: {
      name: 'lineId',
      in: 'path',
    },
    example: 'gid://shopify/CartLine/b2a97a7f-3a7d-4f1e-8e6f-0e1d2c3b4a5f?cart=...',
  }),
});

// =================================================================================
// General API Schemas
// =================================================================================

export const ErrorSchema = z.object({
  error: z.string(),
}).openapi('Error');

export const UserErrorSchema = z.object({
  field: z.array(z.string()).nullable(),
  message: z.string(),
});
