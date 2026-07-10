import { useState } from "react";
import { useNavigate, useNavigation, Form, redirect, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { syncOffersMetafield } from "../lib/syncOffersMetafield";
import GiftOfferFormFields from "../components/GiftOfferFormFields";
import BogoFormFields from "../components/BogoFormFields";
import SpendMoreFormFields from "../components/SpendMoreFormFields";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent");
  const template = formData.get("template");
  const title = formData.get("title");
  const internalName = formData.get("internalName");
  const startAt = formData.get("startAt") || null;
  const endAt = formData.get("endAt") || null;

  let config = {};
  let triggerType = "CART_VALUE";
  let triggerValue = null;

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

  await prisma.offer.create({
    data: {
      shop: session.shop,
      type: "GIFT",
      title: internalName,
      status: intent === "publish" ? "ACTIVE" : "DRAFT",
      triggerType,
      triggerValue,
      config: JSON.stringify(config),
    },
  });

  if (intent === "publish") {
    await syncOffersMetafield(session.shop, admin);
  }
  return redirect("/app/offers");
};

const EMPTY_DEFAULTS = {
  internalName: "",
  title: "",
  startAt: "",
  endAt: "",
  cartMin: "",
  cartMax: "",
  giftDiscountType: "PERCENTAGE",
  giftDiscountValue: "100",
  receiveCount: "1",
};

const BOGO_DEFAULTS = {
  internalName: "",
  title: "",
  startAt: "",
  endAt: "",
  requiredQty: "1",
  multiplyGifts: false,
  giftSameAsCondition: true,
  trackBy: "variant",
  appliesTo: "SELECTED",
  giftDiscountType: "PERCENTAGE",
  giftDiscountValue: "100",
  receiveMode: "CHOOSE_COUNT",
  receiveCount: "1",
};

const SPEND_MORE_DEFAULTS = {
  internalName: "",
  title: "",
  startAt: "",
  endAt: "",
  baseValue: "",
  appliesTo: "ANY",
  giftDiscountType: "PERCENTAGE",
  giftDiscountValue: "100",
};

export default function NewGiftOfferPage() {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams] = useSearchParams();
  const template = searchParams.get("template") || "spend-x-get-gift";

  const [appliesTo, setAppliesTo] = useState("ANY");
  const [receiveMode, setReceiveMode] = useState("ALL");
  const [conditionProducts, setConditionProducts] = useState([]);
  const [giftProducts, setGiftProducts] = useState([]);

  const getHeading = () => {
    const headings = {
      "spend-x-get-gift": "Create Gift offer — Spend X amount",
      "bogo": "Create Gift offer — BOGO",
      "bxgy": "Create Gift offer — Buy X Get Y",
      "spend-more-get-more": "Create Gift offer — Spend more get more",
      "custom": "Create Gift offer",
    };
    return headings[template] || "Create Gift offer";
  };

  return (
    <s-page heading={getHeading()} backAction="/app/offers">
      <Form method="post">
        <input type="hidden" name="template" value={template} />

        {(template === "spend-x-get-gift" || template === "custom") && (
          <GiftOfferFormFields
            defaultValues={EMPTY_DEFAULTS}
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
            defaultValues={BOGO_DEFAULTS}
            isBogo={template === "bogo"}
            conditionProducts={conditionProducts}
            setConditionProducts={setConditionProducts}
            giftProducts={giftProducts}
            setGiftProducts={setGiftProducts}
          />
        )}

        {template === "spend-more-get-more" && (
          <SpendMoreFormFields
            defaultValues={SPEND_MORE_DEFAULTS}
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
            Save draft
          </s-button>
          <s-button
            type="submit"
            name="intent"
            value="publish"
            variant="primary"
            {...(isSubmitting ? { loading: true } : {})}
          >
            Publish
          </s-button>
          <s-button type="button" onClick={() => navigate("/app/offers")}>
            Cancel
          </s-button>
        </s-stack>
      </Form>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};