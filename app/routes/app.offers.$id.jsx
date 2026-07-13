import { syncOffersMetafield } from "../lib/syncOffersMetafield";
import { computeEffectiveStatus, formatStatus, statusTone } from "../lib/offerStatus";
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
import BogoFormFields from "../components/BogoFormFields";
import SpendMoreFormFields from "../components/SpendMoreFormFields";

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
    ...(config.productCondition?.productIds || []),
    ...(config.multiplierCondition?.productIds || []),
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
      { variables: { ids: [...new Set(allProductIds)] } },
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

  if (intent === "activate" || intent === "deactivate") {
    await prisma.offer.update({
      where: { id: params.id },
      data: { status: intent === "activate" ? "ACTIVE" : "DEACTIVATED" },
    });
    await syncOffersMetafield(session.shop, admin);
    return redirect(`/app/offers/${params.id}`);
  }

  const template = formData.get("template") || "spend-x-get-gift";
  const title = formData.get("title");
  const internalName = formData.get("internalName");
  const startAt = formData.get("startAt") || null;
  const endAt = formData.get("endAt") || null;

  let config = {};
  let triggerType = existing.triggerType;
  let triggerValue = existing.triggerValue;

  if (template === "spend-x-get-gift" || template === "custom") {
    const cartMin = formData.get("cartMin") ? parseFloat(formData.get("cartMin")) : null;
    const cartMax = formData.get("cartMax") ? parseFloat(formData.get("cartMax")) : null;
    const appliesTo = formData.get("appliesTo");
    const giftDiscountType = formData.get("giftDiscountType");
    const giftDiscountValue = parseFloat(formData.get("giftDiscountValue") || "0");
    const receiveMode = formData.get("receiveMode");
    const receiveCount = formData.get("receiveCount") ? parseInt(formData.get("receiveCount"), 10) : null;
    const conditionProductIds = JSON.parse(formData.get("conditionProductIds") || "[]");
    const conditionProductVariantIds = JSON.parse(formData.get("conditionProductVariantIds") || "[]");
    const giftProductIds = JSON.parse(formData.get("giftProductIds") || "[]");
    const giftProductVariantIds = JSON.parse(formData.get("giftProductVariantIds") || "[]");

    triggerType = "CART_VALUE";
    triggerValue = cartMin;
    config = {
      template,
      customerTitle: title,
      cartCondition: { min: cartMin, max: cartMax, appliesTo, productIds: conditionProductIds, variantIds: conditionProductVariantIds },
      gift: { discountType: giftDiscountType, discountValue: giftDiscountValue, receiveMode, receiveCount, productIds: giftProductIds, variantIds: giftProductVariantIds },
      schedule: { startAt, endAt },
    };

  } else if (template === "bogo" || template === "bxgy") {
    const requiredQty = parseInt(formData.get("requiredQty") || "1", 10);
    const multiplyGifts = formData.get("multiplyGifts") === "true";
    const giftSameAsCondition = formData.get("giftSameAsCondition") === "true";
    const trackBy = formData.get("trackBy") || "variant";
    const appliesTo = formData.get("appliesTo");
    const conditionProductIds = JSON.parse(formData.get("conditionProductIds") || "[]");
    const conditionProductVariantIds = JSON.parse(formData.get("conditionProductVariantIds") || "[]");
    const giftDiscountType = formData.get("giftDiscountType");
    const giftDiscountValue = parseFloat(formData.get("giftDiscountValue") || "100");
    const receiveMode = formData.get("receiveMode");
    const receiveCount = formData.get("receiveCount") ? parseInt(formData.get("receiveCount"), 10) : null;
    const giftProductIds = giftSameAsCondition ? conditionProductIds : JSON.parse(formData.get("giftProductIds") || "[]");
    const giftProductVariantIds = giftSameAsCondition ? conditionProductVariantIds : JSON.parse(formData.get("giftProductVariantIds") || "[]");

    triggerType = "PRODUCT_QUANTITY";
    triggerValue = requiredQty;
    config = {
      template,
      customerTitle: title,
      productCondition: { requiredQty, multiplyGifts, giftSameAsCondition, trackBy, appliesTo, productIds: conditionProductIds, variantIds: conditionProductVariantIds },
      gift: { discountType: giftDiscountType, discountValue: giftDiscountValue, receiveMode, receiveCount, productIds: giftProductIds, variantIds: giftProductVariantIds },
      schedule: { startAt, endAt },
    };

  } else if (template === "spend-more-get-more") {
    const baseValue = parseFloat(formData.get("baseValue") || "0");
    const appliesTo = formData.get("appliesTo");
    const conditionProductIds = JSON.parse(formData.get("conditionProductIds") || "[]");
    const conditionProductVariantIds = JSON.parse(formData.get("conditionProductVariantIds") || "[]");
    const giftDiscountType = formData.get("giftDiscountType");
    const giftDiscountValue = parseFloat(formData.get("giftDiscountValue") || "100");
    const giftProductIds = JSON.parse(formData.get("giftProductIds") || "[]");
    const giftProductVariantIds = JSON.parse(formData.get("giftProductVariantIds") || "[]");

    triggerType = "CART_VALUE_MULTIPLIER";
    triggerValue = baseValue;
    config = {
      template,
      customerTitle: title,
      multiplierCondition: { baseValue, appliesTo, productIds: conditionProductIds, variantIds: conditionProductVariantIds },
      gift: { discountType: giftDiscountType, discountValue: giftDiscountValue, productIds: giftProductIds, variantIds: giftProductVariantIds },
      schedule: { startAt, endAt },
    };
  }

  await prisma.offer.update({
    where: { id: params.id },
    data: {
      title: internalName,
      status: intent === "publish" ? "ACTIVE" : existing.status,
      triggerType,
      triggerValue,
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
  const template = config.template || "spend-x-get-gift";
  const effectiveStatus = computeEffectiveStatus(offer);

  const getProductIds = (type) => {
    if (template === "bogo" || template === "bxgy") {
      return type === "condition"
        ? config.productCondition?.productIds || []
        : config.gift?.productIds || [];
    } else if (template === "spend-more-get-more") {
      return type === "condition"
        ? config.multiplierCondition?.productIds || []
        : config.gift?.productIds || [];
    }
    return type === "condition"
      ? config.cartCondition?.productIds || []
      : config.gift?.productIds || [];
  };

  const getVariantIds = (type) => {
    if (template === "bogo" || template === "bxgy") {
      return type === "condition"
        ? config.productCondition?.variantIds || []
        : config.gift?.variantIds || [];
    } else if (template === "spend-more-get-more") {
      return type === "condition"
        ? config.multiplierCondition?.variantIds || []
        : config.gift?.variantIds || [];
    }
    return type === "condition"
      ? config.cartCondition?.variantIds || []
      : config.gift?.variantIds || [];
  };

  const savedConditionProducts = getProductIds("condition").map((id, i) => ({
    id,
    title: productTitles[id] || id.split("/").pop(),
    variantId: getVariantIds("condition")[i] ?? null,
  }));

  const savedGiftProducts = getProductIds("gift").map((id, i) => ({
    id,
    title: productTitles[id] || id.split("/").pop(),
    variantId: getVariantIds("gift")[i] ?? null,
  }));

  const [appliesTo, setAppliesTo] = useState(
    config.cartCondition?.appliesTo ||
    config.productCondition?.appliesTo ||
    config.multiplierCondition?.appliesTo ||
    "ANY",
  );
  const [receiveMode, setReceiveMode] = useState(
    config.gift?.receiveMode || "ALL",
  );
  const [conditionProducts, setConditionProducts] = useState(savedConditionProducts);
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
    baseValue: String(config.multiplierCondition?.baseValue ?? ""),
    requiredQty: String(config.productCondition?.requiredQty ?? "1"),
    multiplyGifts: config.productCondition?.multiplyGifts ?? false,
    giftSameAsCondition: config.productCondition?.giftSameAsCondition ?? (template === "bogo"),
    trackBy: config.productCondition?.trackBy ?? "variant",
    receiveMode: config.gift?.receiveMode ?? "ALL",
  };

  const getHeading = () => {
    const headings = {
      "spend-x-get-gift": "Edit Gift offer — Spend X amount",
      "bogo": "Edit Gift offer — BOGO",
      "bxgy": "Edit Gift offer — Buy X Get Y",
      "spend-more-get-more": "Edit Gift offer — Spend more get more",
      "custom": "Edit Gift offer",
    };
    return `${headings[template] || "Edit Gift offer"} — ${offer.title}`;
  };

  return (
    <s-page heading={getHeading()} backAction="/app/offers">
      <s-badge slot="header-actions" tone={statusTone(effectiveStatus)}>
        {formatStatus(effectiveStatus)}
      </s-badge>

      <Form method="post">
        <input type="hidden" name="template" value={template} />

        {(template === "spend-x-get-gift" || template === "custom" || !template) && (
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
        )}

        {(template === "bogo" || template === "bxgy") && (
          <BogoFormFields
            defaultValues={defaultValues}
            isBogo={template === "bogo"}
            conditionProducts={conditionProducts}
            setConditionProducts={setConditionProducts}
            giftProducts={giftProducts}
            setGiftProducts={setGiftProducts}
          />
        )}

        {template === "spend-more-get-more" && (
          <SpendMoreFormFields
            defaultValues={defaultValues}
            appliesTo={appliesTo}
            setAppliesTo={setAppliesTo}
            giftProducts={giftProducts}
            setGiftProducts={setGiftProducts}
          />
        )}

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
          {effectiveStatus === "ACTIVE" || effectiveStatus === "SCHEDULED" ? (
            <Form method="post">
              <input type="hidden" name="intent" value="deactivate" />
              <s-button type="submit">Deactivate offer</s-button>
            </Form>
          ) : effectiveStatus === "DEACTIVATED" || effectiveStatus === "DRAFT" ? (
            <Form method="post">
              <input type="hidden" name="intent" value="activate" />
              <s-button type="submit" variant="primary">
                Activate offer
              </s-button>
            </Form>
          ) : effectiveStatus === "EXPIRED" ? (
            <s-paragraph>
              This offer has expired. Edit the end time to reactivate it.
            </s-paragraph>
          ) : null}

          <Form
            method="post"
            onSubmit={(e) => {
              if (!confirm("Delete this offer permanently? This cannot be undone.")) {
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