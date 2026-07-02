import prisma from "../db.server";

/**
 * Syncs all ACTIVE offers for a shop into a shop-level metafield.
 * Called whenever an offer is activated, paused, deleted, or published.
 * Both the Cart Transform Function and Theme Extension read this metafield
 * to know what offers are currently active.
 */
export async function syncOffersMetafield(shop, admin) {
  // Fetch all active offers for this shop
  const activeOffers = await prisma.offer.findMany({
    where: { shop, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  // Shape the data the Function and Theme Extension need
  const offersPayload = activeOffers.map((offer) => {
    const config = JSON.parse(offer.config || "{}");
    return {
      id: offer.id,
      type: offer.type,
      triggerType: offer.triggerType,
      triggerValue: offer.triggerValue,
      cartCondition: config.cartCondition,
      gift: config.gift,
      schedule: config.schedule,
    };
  });

  // Get the real shop GID — needed as ownerId for shop-level metafields
  const shopResponse = await admin.graphql(
    `#graphql
    query {
      shop {
        id
      }
    }`,
  );
  const shopData = await shopResponse.json();
  const shopId = shopData.data.shop.id;

  // Write to shop metafield using $app namespace (app-exclusive ownership)
  const response = await admin.graphql(
    `#graphql
    mutation syncOffersMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
          value
          updatedAt
        }
        userErrors {
          field
          message
          code
        }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "$app",
            key: "active_offers",
            type: "json",
            value: JSON.stringify(offersPayload),
          },
        ],
      },
    },
  );

  const data = await response.json();

  if (data.data?.metafieldsSet?.userErrors?.length > 0) {
    console.error(
      "Metafield sync errors:",
      data.data.metafieldsSet.userErrors,
    );
    throw new Error(
      `Metafield sync failed: ${data.data.metafieldsSet.userErrors[0].message}`,
    );
  }

  return data.data?.metafieldsSet?.metafields?.[0];
}