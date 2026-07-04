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
  const operations = [];

  for (const offer of activeOffers) {
    if (offer.type !== "GIFT") continue;
    if (offer.triggerType !== "CART_VALUE") continue;

    const min = offer.cartCondition?.min ?? 0;
    const max = offer.cartCondition?.max ?? null;
    const appliesTo = offer.cartCondition?.appliesTo ?? "ANY";
    const conditionProductIds = offer.cartCondition?.productIds ?? [];

    // Calculate cart subtotal based on appliesTo scope
    let cartSubtotal = 0;
    for (const line of cartLines) {
      // Skip gift lines when calculating subtotal
      if (line.attribute?.value === "true") continue;

      const lineAmount = parseFloat(line.cost?.subtotalAmount?.amount ?? "0");

      if (appliesTo === "ANY") {
        cartSubtotal += lineAmount;
      } else if (appliesTo === "SELECTED") {
        // Only count lines whose product is in the condition product list
        const productId = line.merchandise?.product?.id ?? null;
        if (productId && conditionProductIds.includes(productId)) {
          cartSubtotal += lineAmount;
        }
      } else {
        // For other modes (not yet implemented), fall back to full cart
        cartSubtotal += lineAmount;
      }
    }

    // Check threshold
    if (cartSubtotal < min) continue;
    if (max !== null && max > 0 && cartSubtotal > max) continue;

    // Check schedule
    const now = Date.now();
    if (offer.schedule?.startAt && now < new Date(offer.schedule.startAt).getTime()) continue;
    if (offer.schedule?.endAt && now > new Date(offer.schedule.endAt).getTime()) continue;

    const giftProductIds = offer.gift?.productIds ?? [];
    if (!giftProductIds.length) continue;

    const discountType = offer.gift?.discountType ?? "PERCENTAGE";
    const discountValue = parseFloat(offer.gift?.discountValue ?? "100");
    const receiveMode = offer.gift?.receiveMode ?? "ALL";
    const receiveCount = offer.gift?.receiveCount ?? null;

    // Find valid gift lines in the cart
    const validGiftLines = cartLines.filter((line) => {
      if (line.attribute?.value !== "true") return false;
      const productId = line.merchandise?.product?.id ?? null;
      if (!productId) return false;
      return giftProductIds.includes(productId);
    });

    if (!validGiftLines.length) continue;

    // Apply receiveCount limit if set
    const linesToDiscount =
      receiveMode === "CHOOSE_COUNT" && receiveCount !== null
        ? validGiftLines.slice(0, receiveCount)
        : validGiftLines;

    for (const line of linesToDiscount) {
      let discountedPrice;

      if (discountType === "PERCENTAGE") {
        const originalPrice = parseFloat(
          line.cost?.subtotalAmount?.amount ?? "0",
        );
        const quantity = line.quantity || 1;
        const pricePerUnit = originalPrice / quantity;
        const discount = discountValue / 100;
        discountedPrice = (pricePerUnit * (1 - discount)).toFixed(2);
      } else {
        // AMOUNT — fixed amount off per unit
        const originalPrice = parseFloat(
          line.cost?.subtotalAmount?.amount ?? "0",
        );
        const quantity = line.quantity || 1;
        const pricePerUnit = originalPrice / quantity;
        const discounted = Math.max(0, pricePerUnit - discountValue);
        discountedPrice = discounted.toFixed(2);
      }

      operations.push({
        lineUpdate: {
          cartLineId: line.id,
          price: {
            adjustment: {
              fixedPricePerUnit: {
                amount: discountedPrice,
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