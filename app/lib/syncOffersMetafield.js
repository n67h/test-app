import prisma from "../db.server";
import { computeEffectiveStatus } from "./offerStatus";

export async function syncOffersMetafield(shop, admin) {
  const offers = await prisma.offer.findMany({
    where: { shop, status: { in: ["ACTIVE", "SCHEDULED"] } },
    orderBy: { createdAt: "desc" },
  });

  // Filter to only currently active offers using computed status
  const activeOffers = offers.filter(
    (offer) => computeEffectiveStatus(offer) === "ACTIVE"
  );

  const offersPayload = activeOffers.map((offer) => {
    const config = JSON.parse(offer.config || "{}");
    return {
      id: offer.id,
      type: offer.type,
      triggerType: offer.triggerType,
      triggerValue: offer.triggerValue,
      cartCondition: config.cartCondition,
      productCondition: config.productCondition,
      multiplierCondition: config.multiplierCondition,
      gift: config.gift,
      schedule: config.schedule,
    };
  });

  const shopResponse = await admin.graphql(`#graphql
    query { shop { id } }
  `);
  const shopData = await shopResponse.json();
  const shopId = shopData.data.shop.id;

  const response = await admin.graphql(
    `#graphql
    mutation syncOffersMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
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
    console.error("Metafield sync errors:", data.data.metafieldsSet.userErrors);
    throw new Error(`Metafield sync failed: ${data.data.metafieldsSet.userErrors[0].message}`);
  }

  return data.data?.metafieldsSet?.metafields?.[0];
}