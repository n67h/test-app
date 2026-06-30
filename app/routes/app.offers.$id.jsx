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
  const { session } = await authenticate.admin(request);

  const offer = await prisma.offer.findFirst({
    where: { id: params.id, shop: session.shop },
  });

  if (!offer) {
    throw new Response("Offer not found", { status: 404 });
  }

  return { offer };
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Confirm the offer belongs to this shop before mutating it.
  const existing = await prisma.offer.findFirst({
    where: { id: params.id, shop: session.shop },
  });
  if (!existing) {
    throw new Response("Offer not found", { status: 404 });
  }

  if (intent === "delete") {
    await prisma.offer.delete({ where: { id: params.id } });
    return redirect("/app/offers");
  }

  if (intent === "activate" || intent === "pause") {
    await prisma.offer.update({
      where: { id: params.id },
      data: { status: intent === "activate" ? "ACTIVE" : "PAUSED" },
    });
    return redirect(`/app/offers/${params.id}`);
  }

  // Otherwise, this is a full form save (draft or publish).
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

  // Preserve productIds already saved (picker comes in a later step).
  const existingConfig = JSON.parse(existing.config || "{}");

  const config = {
    customerTitle: title,
    cartCondition: {
      min: cartMin,
      max: cartMax,
      appliesTo,
      productIds: existingConfig.cartCondition?.productIds || [],
    },
    gift: {
      discountType: giftDiscountType,
      discountValue: giftDiscountValue,
      receiveMode,
      receiveCount,
      productIds: existingConfig.gift?.productIds || [],
    },
    schedule: {
      startAt,
      endAt,
    },
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

  return redirect("/app/offers");
};

export default function EditGiftOfferPage() {
  const { offer } = useLoaderData();
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