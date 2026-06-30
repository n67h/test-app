import { useState } from "react";
import { useNavigate, useNavigation, Form, redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import GiftOfferFormFields from "../components/GiftOfferFormFields";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent"); // "draft" | "publish"

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

  const appliesTo = formData.get("appliesTo"); // "ANY" | "SELECTED"

  const giftDiscountType = formData.get("giftDiscountType"); // "PERCENTAGE" | "AMOUNT"
  const giftDiscountValue = parseFloat(formData.get("giftDiscountValue") || "0");

  const receiveMode = formData.get("receiveMode"); // "ALL" | "CHOOSE_COUNT"
  const receiveCount = formData.get("receiveCount")
    ? parseInt(formData.get("receiveCount"), 10)
    : null;

  const config = {
    customerTitle: title,
    cartCondition: {
      min: cartMin,
      max: cartMax,
      appliesTo,
      productIds: [], // wired up in product picker step
    },
    gift: {
      discountType: giftDiscountType,
      discountValue: giftDiscountValue,
      receiveMode,
      receiveCount,
      productIds: [], // wired up in product picker step
    },
    schedule: {
      startAt,
      endAt,
    },
  };

  await prisma.offer.create({
    data: {
      shop: session.shop,
      type: "GIFT",
      title: internalName,
      status: intent === "publish" ? "ACTIVE" : "DRAFT",
      triggerType: "CART_VALUE",
      triggerValue: cartMin,
      config: JSON.stringify(config),
    },
  });

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

export default function NewGiftOfferPage() {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [appliesTo, setAppliesTo] = useState("ANY");
  const [receiveMode, setReceiveMode] = useState("ALL");

  return (
    <s-page heading="Create Gift offer" backAction="/app/offers">
      <Form method="post">
        <GiftOfferFormFields
          defaultValues={EMPTY_DEFAULTS}
          appliesTo={appliesTo}
          setAppliesTo={setAppliesTo}
          receiveMode={receiveMode}
          setReceiveMode={setReceiveMode}
        />

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