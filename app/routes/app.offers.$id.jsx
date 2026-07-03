import { syncOffersMetafield } from "../lib/syncOffersMetafield";
import { useState } from "react";
import {
  useLoaderData,
  useNavigate,
  useNavigation,
  Form,
  redirect,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import GiftOfferFormFields from "../components/GiftOfferFormFields";

export const loader = async ({ request, params }) => {
  const { session, admin } = await authenticate.admin(request);

  const offer = await prisma.offer.findFirst({
    where: { id: params.id, shop: session.shop },
  });

  if (!offer) {
    throw new Response("Offer not found", { status: 404 });
  }

  const config = JSON.parse(offer.config || "{}");
  const allProductIds = [
    ...(config.cartCondition?.productIds || []),
    ...(config.gift?.productIds || []),
  ];

  let productTitles = {};

  if (allProductIds.length > 0) {
    const response = await admin.graphql(
      `#graphql
      query getProductTitles($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
          }
        }
      }`,
      { variables: { ids: allProductIds } },
    );
    const data = await response.json();
    data.data.nodes.forEach((node) => {
      if (node?.id) productTitles[node.id] = node.title;
    });
  }

  return { offer, productTitles };
};

export const action = async ({ request, params }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const existing = await prisma.offer.findFirst({
    where: { id: params.id, shop: session.shop },
  });
  if (!existing) throw new Response("Offer not found", { status: 404 });

  if (intent === "delete") {
    await prisma.offer.delete({ where: { id: params.id } });
    await syncOffersMetafield(session.shop, admin);
    return redirect("/app/offers");
  }

  if (intent === "activate" || intent === "pause") {
    await prisma.offer.update({
      where: { id: params.id },
      data: { status: intent === "activate" ? "ACTIVE" : "PAUSED" },
    });
    await syncOffersMetafield(session.shop, admin);
    return redirect(`/app/offers/${params.id}`);
  }

  const title = formData.get("title");
  const internalName = formData.get("internalName");
  const startAt = formData.get("startAt") || null;
  const endAt = formData.get("endAt") || null;

  const cartMin = formData.get("cartMin")
    ? parseFloat(formData.get("cartMin"))
    : null;
  const cartMax = formData.get("cartMax")
    ? parseFloat(formData.get("cartMax"))
    : null;

  const appliesTo = formData.get("appliesTo");
  const giftDiscountType = formData.get("giftDiscountType");
  const giftDiscountValue = parseFloat(formData.get("giftDiscountValue") || "0");
  const receiveMode = formData.get("receiveMode");
  const receiveCount = formData.get("receiveCount")
    ? parseInt(formData.get("receiveCount"), 10)
    : null;

  const conditionProductIds = JSON.parse(
    formData.get("conditionProductIds") || "[]",
  );
  const conditionProductVariantIds = JSON.parse(
    formData.get("conditionProductVariantIds") || "[]",
  );
  const giftProductIds = JSON.parse(formData.get("giftProductIds") || "[]");
  const giftProductVariantIds = JSON.parse(
    formData.get("giftProductVariantIds") || "[]",
  );

  const config = {
    customerTitle: title,
    cartCondition: {
      min: cartMin,
      max: cartMax,
      appliesTo,
      productIds: conditionProductIds,
      variantIds: conditionProductVariantIds,
    },
    gift: {
      discountType: giftDiscountType,
      discountValue: giftDiscountValue,
      receiveMode,
      receiveCount,
      productIds: giftProductIds,
      variantIds: giftProductVariantIds,
    },
    schedule: { startAt, endAt },
  };

  await prisma.offer.update({
    where: { id: params.id },
    data: {
      title: internalName,
      status: intent === "publish" ? "ACTIVE" : existing.status,
      triggerType: "CART_VALUE",
      triggerValue: cartMin,
      config: JSON.stringify(config),
    },
  });

  await syncOffersMetafield(session.shop, admin);
  return redirect("/app/offers");
};

export default function EditGiftOfferPage() {
  const { offer, productTitles } = useLoaderData();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const config = JSON.parse(offer.config || "{}");

  const [appliesTo, setAppliesTo] = useState(
    config.cartCondition?.appliesTo || "ANY",
  );
  const [receiveMode, setReceiveMode] = useState(
    config.gift?.receiveMode || "ALL",
  );

  const savedConditionProducts = (config.cartCondition?.productIds || []).map(
    (id, i) => ({
      id,
      title: productTitles[id] || id.split("/").pop(),
      variantId: config.cartCondition?.variantIds?.[i] ?? null,
    }),
  );
  const savedGiftProducts = (config.gift?.productIds || []).map((id, i) => ({
    id,
    title: productTitles[id] || id.split("/").pop(),
    variantId: config.gift?.variantIds?.[i] ?? null,
  }));

  const [conditionProducts, setConditionProducts] =
    useState(savedConditionProducts);
  const [giftProducts, setGiftProducts] = useState(savedGiftProducts);

  const defaultValues = {
    internalName: offer.title || "",
    title: config.customerTitle || "",
    startAt: config.schedule?.startAt || "",
    endAt: config.schedule?.endAt || "",
    cartMin: config.cartCondition?.min ?? "",
    cartMax: config.cartCondition?.max ?? "",
    giftDiscountType: config.gift?.discountType || "PERCENTAGE",
    giftDiscountValue: config.gift?.discountValue ?? "100",
    receiveCount: config.gift?.receiveCount ?? "1",
  };

  return (
    <s-page
      heading={`Edit Gift offer — ${offer.title}`}
      backAction="/app/offers"
    >
      <s-badge
        slot="header-actions"
        tone={offer.status === "ACTIVE" ? "success" : "neutral"}
      >
        {offer.status}
      </s-badge>

      <Form method="post">
        <GiftOfferFormFields
          defaultValues={defaultValues}
          appliesTo={appliesTo}
          setAppliesTo={setAppliesTo}
          receiveMode={receiveMode}
          setReceiveMode={setReceiveMode}
          conditionProducts={conditionProducts}
          setConditionProducts={setConditionProducts}
          giftProducts={giftProducts}
          setGiftProducts={setGiftProducts}
        />

        <s-stack direction="inline" gap="base">
          <s-button
            type="submit"
            name="intent"
            value="draft"
            {...(isSubmitting ? { loading: true } : {})}
          >
            Save changes
          </s-button>
          <s-button
            type="submit"
            name="intent"
            value="publish"
            variant="primary"
            {...(isSubmitting ? { loading: true } : {})}
          >
            Save and publish
          </s-button>
          <s-button type="button" onClick={() => navigate("/app/offers")}>
            Cancel
          </s-button>
        </s-stack>
      </Form>

      <s-section heading="Offer status">
        <s-stack direction="inline" gap="base">
          {offer.status === "ACTIVE" ? (
            <Form method="post">
              <input type="hidden" name="intent" value="pause" />
              <s-button type="submit">Pause offer</s-button>
            </Form>
          ) : (
            <Form method="post">
              <input type="hidden" name="intent" value="activate" />
              <s-button type="submit" variant="primary">
                Activate offer
              </s-button>
            </Form>
          )}

          <Form
            method="post"
            onSubmit={(e) => {
              if (
                !confirm(
                  "Delete this offer permanently? This cannot be undone.",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <s-button type="submit" tone="critical">
              Delete offer
            </s-button>
          </Form>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};