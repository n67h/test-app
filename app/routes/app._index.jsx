import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const [totalOffers, activeOffers, draftOffers, pausedOffers, recentOffers] =
    await Promise.all([
      prisma.offer.count({ where: { shop: session.shop } }),
      prisma.offer.count({ where: { shop: session.shop, status: "ACTIVE" } }),
      prisma.offer.count({ where: { shop: session.shop, status: "DRAFT" } }),
      prisma.offer.count({ where: { shop: session.shop, status: "PAUSED" } }),
      prisma.offer.findMany({
        where: { shop: session.shop },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  return {
    totalOffers,
    activeOffers,
    draftOffers,
    pausedOffers,
    recentOffers,
  };
};

export default function DashboardPage() {
  const { totalOffers, activeOffers, draftOffers, pausedOffers, recentOffers } =
    useLoaderData();
  const navigate = useNavigate();

  return (
    <s-page heading="Dashboard">
      <s-button
        slot="primary-action"
        variant="primary"
        command="--show"
        commandFor="choose-offer-type-modal"
        onClick={() => navigate("/app/offers")}
      >
        Manage offers
      </s-button>

      {/* Stats row */}
      <s-section>
        <s-grid gridTemplateColumns="1fr 1fr 1fr 1fr" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text>{totalOffers}</s-text>
              <s-heading>Total offers</s-heading>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text>{activeOffers}</s-text>
              <s-heading>Active</s-heading>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text>{draftOffers}</s-text>
              <s-heading>Draft</s-heading>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text>{pausedOffers}</s-text>
              <s-heading>Paused</s-heading>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* Recent offers */}
      <s-section heading="Recent offers">
        {recentOffers.length === 0 ? (
          <s-stack direction="block" gap="base">
            <s-paragraph>
              You haven't created any offers yet. Create your first gift offer
              to start rewarding customers.
            </s-paragraph>
            <s-button
              variant="primary"
              onClick={() => navigate("/app/offers")}
            >
              Create your first offer
            </s-button>
          </s-stack>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Title</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Created</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {recentOffers.map((offer) => (
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

        {recentOffers.length > 0 && (
          <s-button
            variant="tertiary"
            onClick={() => navigate("/app/offers")}
          >
            View all offers
          </s-button>
        )}
      </s-section>

      {/* Quick actions */}
      <s-section slot="aside" heading="Quick actions">
        <s-stack direction="block" gap="base">
          <s-button onClick={() => navigate("/app/offers")}>
            View all offers
          </s-button>
          <s-button onClick={() => navigate("/app/offers/new?type=gift&template=spend-x-get-gift")}>
            Create gift offer
          </s-button>
        </s-stack>
      </s-section>

      {/* Offer breakdown */}
      <s-section slot="aside" heading="Offer breakdown">
        <s-stack direction="block" gap="tight">
          <s-stack direction="inline" gap="base" alignment="space-between">
            <s-text>Active</s-text>
            <s-badge tone="success">{activeOffers}</s-badge>
          </s-stack>
          <s-stack direction="inline" gap="base" alignment="space-between">
            <s-text>Draft</s-text>
            <s-badge tone="neutral">{draftOffers}</s-badge>
          </s-stack>
          <s-stack direction="inline" gap="base" alignment="space-between">
            <s-text>Paused</s-text>
            <s-badge tone="neutral">{pausedOffers}</s-badge>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};