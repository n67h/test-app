const FUNCTION_HANDLE = "gift-cart-transform";

export async function ensureCartTransform(admin) {
  try {
    // Check if Cart Transform already exists
    const checkResponse = await admin.graphql(`
      {
        cartTransforms(first: 5) {
          nodes {
            id
            functionId
          }
        }
      }
    `);
    const checkData = await checkResponse.json();
    const existing = checkData.data?.cartTransforms?.nodes ?? [];

    if (existing.length > 0) return; // Already exists, nothing to do

    // Get the deployed function ID
    const functionsResponse = await admin.graphql(`
      {
        shopifyFunctions(first: 10) {
          nodes {
            id
            title
            apiType
          }
        }
      }
    `);
    const functionsData = await functionsResponse.json();
    const fn = functionsData.data?.shopifyFunctions?.nodes?.find(
      (f) => f.title === FUNCTION_HANDLE && f.apiType === "cart_transform"
    );

    if (!fn) return; // Function not deployed yet

    // Create the Cart Transform
    await admin.graphql(
      `mutation {
        cartTransformCreate(
          functionId: "${fn.id}"
          blockOnFailure: false
        ) {
          cartTransform { id }
          userErrors { message }
        }
      }`
    );
  } catch (err) {
    // Non-fatal — log but don't crash the app
    console.error("[ensureCartTransform]", err.message);
  }
}