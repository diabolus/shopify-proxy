# Shopify Cart Proxy Worker

This Cloudflare Worker acts as a proxy for Shopify's Storefront GraphQL API. It intercepts `cartCreate` mutations to add a custom attribute `{ key: "proxy", value: "true" }` to the cart. This is useful for tracking carts that are created via a specific channel.

## Configuration

1.  **Update `wrangler.toml`**:
    Open the `wrangler.toml` file and replace `{YOUR_SHOP_NAME}` in the `SHOPIFY_API_URL` with your actual Shopify store name.

    ```toml
    [vars]
    SHOPIFY_API_URL = "https://{YOUR_SHOP_NAME}.myshopify.com/api/2023-07/graphql.json"
    ```

2.  **Set Shopify API Token**:
    You need to set the Shopify Storefront Access Token as a secret for the worker. You can do this by running the following command:

    ```bash
    npx wrangler secret put SHOPIFY_API_TOKEN
    ```

    You will be prompted to enter the value for the secret.

## Deployment

To deploy the worker, run the following command:

```bash
npm run deploy
```

This will build and deploy the worker to your Cloudflare account.
