// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

const NO_CHANGES = { operations: [] };

/**
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  // Read active offers from the shop metafield
  const metafieldValue = input.shop?.metafield?.value;
  if (!metafieldValue) return NO_CHANGES;

  let activeOffers;
  try {
    activeOffers = JSON.parse(metafieldValue);
  } catch {
    return NO_CHANGES;
  }

  if (!activeOffers?.length) return NO_CHANGES;

  const cartLines = input.cart.lines;
  // Sum line subtotals to get cart total
  // (cart.cost is not available in Cart Transform input schema)
  const cartSubtotal = cartLines.reduce((sum, line) => {
    const lineAmount = parseFloat(
      line.cost?.subtotalAmount?.amount ?? "0",
    );
    return sum + lineAmount;
  }, 0);

  const operations = [];

  for (const offer of activeOffers) {
    if (offer.type !== "GIFT") continue;
    if (offer.triggerType !== "CART_VALUE") continue;

    const min = offer.cartCondition?.min ?? 0;
    const max = offer.cartCondition?.max ?? null;

    // Check if cart subtotal meets the threshold
    if (cartSubtotal < min) continue;
    if (max !== null && cartSubtotal > max) continue;

    // Check schedule validity
    const now = Date.now();
    if (offer.schedule?.startAt && now < new Date(offer.schedule.startAt).getTime()) continue;
    if (offer.schedule?.endAt && now > new Date(offer.schedule.endAt).getTime()) continue;

    const giftProductIds = offer.gift?.productIds ?? [];
    if (!giftProductIds.length) continue;

    // Find any gift lines already in the cart (marked with _is_gift attribute)
    // and make them free via lineUpdate
    for (const line of cartLines) {
      const isGift = line.attribute?.value === "true";
      if (!isGift) continue;

      const productId = line.merchandise?.product?.id ?? null;

      if (!productId) continue;

      // Verify this gift line's product is actually one of the offer's gift products
      const isValidGift = giftProductIds.includes(productId);
      if (!isValidGift) continue;

      // Apply 100% off by setting price to 0.00
      operations.push({
        lineUpdate: {
          cartLineId: line.id,
          price: {
            adjustment: {
              fixedPricePerUnit: {
                amount: "0.00",
              },
            },
          },
        },
      });
    }
  }

  if (!operations.length) return NO_CHANGES;

  return { operations };
}