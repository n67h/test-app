import { useRef } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const offers = await prisma.offer.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });

  return { offers };
};

const GIFT_TEMPLATES = [
  {
    id: "spend-x-get-gift",
    title: "Spend X amount to get gift(s)",
    description: "E.g. Spend $500 get gift(s)",
  },
  {
    id: "free-sample",
    title: "Free sample with purchase",
    description:
      "E.g. Reward customers with a sample once they purchase at least 1 product.",
  },
  {
    id: "bogo",
    title: "BOGO (Buy 1 get 1 the same)",
    description: "E.g. Purchase a pair of socks and get another for free.",
  },
  {
    id: "bxgy",
    title: "BXGY (Buy X get Y)",
    description: "E.g. Purchase a shirt and get a hat for free.",
  },
  {
    id: "spend-more-get-more",
    title: "Spend more get more",
    description: "E.g. Get a gift for each $500 spent",
  },
  {
    id: "custom",
    title: "Start from scratch",
    description: "Create an offer manually, from condition to gifts.",
  },
];

export default function OffersIndexPage() {
  const { offers } = useLoaderData();
  const navigate = useNavigate();

  const typeModalRef = useRef(null);
  const templateModalRef = useRef(null);

  const openTemplateModal = () => {
    typeModalRef.current?.hideOverlay();
    templateModalRef.current?.showOverlay();
  };

  const startTemplate = (templateId) => {
    templateModalRef.current?.hideOverlay();
    navigate(`/app/offers/new?type=gift&template=${templateId}`);
  };

  return (
    <s-page heading="Offers">
      <s-button
        slot="primary-action"
        variant="primary"
        command="--show"
        commandFor="choose-offer-type-modal"
      >
        Create offer
      </s-button>

      <s-section heading={`${offers.length} offer${offers.length === 1 ? "" : "s"}`}>
        {offers.length === 0 ? (
          <s-paragraph>
            You haven't created any offers yet. Click "Create offer" to set up
            your first Gift or Bundle offer.
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Title</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Created</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {offers.map((offer) => (
                <s-table-row
                  key={offer.id}
                  onClick={() => navigate(`/app/offers/${offer.id}`)}
                >
                  <s-table-cell>{offer.title}</s-table-cell>
                  <s-table-cell>{offer.type}</s-table-cell>
                  <s-table-cell>{offer.status}</s-table-cell>
                  <s-table-cell>
                    {new Date(offer.createdAt).toLocaleDateString()}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      {/* Modal 1: Choose offer type */}
      <s-modal
        id="choose-offer-type-modal"
        ref={typeModalRef}
        heading="Choose offer type"
      >
        <s-stack direction="block" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="base" alignment="space-between">
              <s-stack direction="block" gap="tight">
                <s-heading>Gift offer</s-heading>
                <s-paragraph>
                  Example: Spend $400 to get gift, Buy 3 products to get gift
                </s-paragraph>
              </s-stack>
              <s-button variant="primary" onClick={openTemplateModal}>
                Start
              </s-button>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="base" alignment="space-between">
              <s-stack direction="block" gap="tight">
                <s-heading>Bundle offer</s-heading>
                <s-paragraph>
                  Example: Purchase a bundle of A and B with discount
                </s-paragraph>
              </s-stack>
              <s-button disabled>Coming soon</s-button>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="base" alignment="space-between">
              <s-stack direction="block" gap="tight">
                <s-heading>Upsell offer</s-heading>
                <s-paragraph>
                  Example: Buy an item from a collection with half off price
                </s-paragraph>
              </s-stack>
              <s-button disabled>Coming soon</s-button>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="inline" gap="base" alignment="space-between">
              <s-stack direction="block" gap="tight">
                <s-heading>Discount offer</s-heading>
                <s-paragraph>
                  Example: Purchase 2 with 10% OFF, purchase 3 with 30% OFF
                </s-paragraph>
              </s-stack>
              <s-button disabled>Coming soon</s-button>
            </s-stack>
          </s-box>
        </s-stack>

        <s-button
          slot="secondary-actions"
          onClick={() => typeModalRef.current?.hideOverlay()}
        >
          Cancel
        </s-button>
      </s-modal>

      {/* Modal 2: Choose a Gift offer template */}
      <s-modal
        id="choose-gift-template-modal"
        ref={templateModalRef}
        heading="Create gift offer"
      >
        <s-stack direction="block" gap="base">
          <s-paragraph>Choose a template:</s-paragraph>
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            {GIFT_TEMPLATES.map((template) => (
              <s-box
                key={template.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="tight">
                  <s-heading>{template.title}</s-heading>
                  <s-paragraph>{template.description}</s-paragraph>
                  <s-button onClick={() => startTemplate(template.id)}>
                    Select
                  </s-button>
                </s-stack>
              </s-box>
            ))}
          </s-grid>
        </s-stack>

        <s-button
          slot="secondary-actions"
          onClick={() => {
            templateModalRef.current?.hideOverlay();
            typeModalRef.current?.showOverlay();
          }}
        >
          Go back
        </s-button>
      </s-modal>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};