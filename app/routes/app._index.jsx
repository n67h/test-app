import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { computeEffectiveStatus, formatStatus, statusTone } from "../lib/offerStatus";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const allOffers = await prisma.offer.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });

  // Compute effective status for each offer
  const offersWithStatus = allOffers.map((offer) => ({
    ...offer,
    effectiveStatus: computeEffectiveStatus(offer),
  }));

  const totalOffers = offersWithStatus.length;
  const activeOffers = offersWithStatus.filter((o) => o.effectiveStatus === "ACTIVE").length;
  const draftOffers = offersWithStatus.filter((o) => o.effectiveStatus === "DRAFT").length;
  const scheduledOffers = offersWithStatus.filter((o) => o.effectiveStatus === "SCHEDULED").length;
  const expiredOffers = offersWithStatus.filter((o) => o.effectiveStatus === "EXPIRED").length;
  const deactivatedOffers = offersWithStatus.filter((o) => o.effectiveStatus === "DEACTIVATED").length;
  const recentOffers = offersWithStatus.slice(0, 5);

  return {
    totalOffers,
    activeOffers,
    draftOffers,
    scheduledOffers,
    expiredOffers,
    deactivatedOffers,
    recentOffers,
  };
};

export default function DashboardPage() {
  const {
    totalOffers,
    activeOffers,
    draftOffers,
    scheduledOffers,
    expiredOffers,
    deactivatedOffers,
    recentOffers,
  } = useLoaderData();
  const navigate = useNavigate();

  return (
    <s-page heading="Dashboard">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/offers")}
      >
        Manage offers
      </s-button>

      {/* Stats row */}
      {/* Stats row */}
      <s-section>
        <s-grid gridTemplateColumns="1fr 1fr 1fr 1fr 1fr 1fr" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text>{totalOffers}</s-text>
              <s-heading>Total</s-heading>
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
              <s-text>{scheduledOffers}</s-text>
              <s-heading>Scheduled</s-heading>
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
              <s-text>{expiredOffers}</s-text>
              <s-heading>Expired</s-heading>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text>{deactivatedOffers}</s-text>
              <s-heading>Deactivated</s-heading>
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
            <s-button variant="primary" onClick={() => navigate("/app/offers")}>
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
                  <s-table-cell>
                    {offer.type.charAt(0) + offer.type.slice(1).toLowerCase()}
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={statusTone(offer.effectiveStatus)}>
                      {formatStatus(offer.effectiveStatus)}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {new Date(offer.createdAt).toLocaleDateString()}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
        {recentOffers.length > 0 && (
          <s-button variant="tertiary" onClick={() => navigate("/app/offers")}>
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
          <s-button
            onClick={() =>
              navigate("/app/offers/new?type=gift&template=spend-x-get-gift")
            }
          >
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
            <s-text>Scheduled</s-text>
            <s-badge tone="info">{scheduledOffers}</s-badge>
          </s-stack>
          <s-stack direction="inline" gap="base" alignment="space-between">
            <s-text>Draft</s-text>
            <s-badge tone="neutral">{draftOffers}</s-badge>
          </s-stack>
          <s-stack direction="inline" gap="base" alignment="space-between">
            <s-text>Expired</s-text>
            <s-badge tone="neutral">{expiredOffers}</s-badge>
          </s-stack>
          <s-stack direction="inline" gap="base" alignment="space-between">
            <s-text>Deactivated</s-text>
            <s-badge tone="neutral">{deactivatedOffers}</s-badge>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};