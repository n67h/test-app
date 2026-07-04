/**
 * Computes the real effective status of an offer based on its stored status
 * and schedule. Called on every read so status is always accurate without
 * needing a background job.
 *
 * Stored status  | Computed result
 * ---------------|-----------------
 * DRAFT          | DRAFT (schedule irrelevant until published)
 * DEACTIVATED    | DEACTIVATED (merchant explicitly turned off)
 * ACTIVE/SCHEDULED/EXPIRED → recomputed from schedule
 */
export function computeEffectiveStatus(offer) {
  const { status } = offer;

  // These statuses are set explicitly by the merchant and never auto-override
  if (status === "DRAFT" || status === "DEACTIVATED") return status;

  // For everything else, recompute from schedule
  const config = JSON.parse(offer.config || "{}");
  const { startAt, endAt } = config.schedule || {};
  const now = Date.now();

  if (endAt && now > new Date(endAt).getTime()) return "EXPIRED";
  if (startAt && now < new Date(startAt).getTime()) return "SCHEDULED";
  return "ACTIVE";
}

/**
 * Returns a display-friendly version of the status.
 * e.g. "ACTIVE" → "Active"
 */
export function formatStatus(status) {
  const labels = {
    ACTIVE: "Active",
    DRAFT: "Draft",
    SCHEDULED: "Scheduled",
    EXPIRED: "Expired",
    DEACTIVATED: "Deactivated",
  };
  return labels[status] ?? status;
}

/**
 * Returns the Polaris badge tone for a status.
 */
export function statusTone(status) {
  const tones = {
    ACTIVE: "success",
    SCHEDULED: "info",
    DRAFT: "neutral",
    EXPIRED: "neutral",
    DEACTIVATED: "neutral",
  };
  return tones[status] ?? "neutral";
}