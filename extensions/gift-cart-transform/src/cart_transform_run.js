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

    // Check schedule validity
    const now = Date.now();
    if (offer.schedule?.startAt && now < new Date(offer.schedule.startAt).getTime()) continue;
    if (offer.schedule?.endAt && now > new Date(offer.schedule.endAt).getTime()) continue;

    const giftProductIds = offer.gift?.productIds ?? [];
    const giftVariantIds = offer.gift?.variantIds ?? [];
    if (!giftProductIds.length) continue;

    const discountType = offer.gift?.discountType ?? "PERCENTAGE";
    const discountValue = parseFloat(offer.gift?.discountValue ?? "100");
    const receiveMode = offer.gift?.receiveMode ?? "ALL";
    const receiveCount = offer.gift?.receiveCount ?? null;

    // Find valid gift lines already in the cart
    const validGiftLines = cartLines.filter((line) => {
      if (line.attribute?.value !== "true") return false;
      const productId = line.merchandise?.product?.id ?? null;
      return productId && giftProductIds.includes(productId);
    });

    if (!validGiftLines.length) continue;

    let qualifies = false;

    if (offer.triggerType === "CART_VALUE") {
      // --- CART VALUE trigger ---
      const min = offer.cartCondition?.min ?? 0;
      const max = offer.cartCondition?.max ?? null;
      const appliesTo = offer.cartCondition?.appliesTo ?? "ANY";
      const conditionProductIds = offer.cartCondition?.productIds ?? [];

      let cartSubtotal = 0;
      for (const line of cartLines) {
        if (line.attribute?.value === "true") continue;
        const lineAmount = parseFloat(line.cost?.subtotalAmount?.amount ?? "0");
        if (appliesTo === "ANY") {
          cartSubtotal += lineAmount;
        } else if (appliesTo === "SELECTED") {
          const productId = line.merchandise?.product?.id ?? null;
          if (productId && conditionProductIds.includes(productId)) {
            cartSubtotal += lineAmount;
          }
        } else {
          cartSubtotal += lineAmount;
        }
      }

      qualifies = cartSubtotal >= min && (max === null || max === 0 || cartSubtotal <= max);

    } else if (offer.triggerType === "PRODUCT_QUANTITY") {
      // --- PRODUCT QUANTITY trigger (BOGO / BXGY) ---
      const requiredQty = offer.productCondition?.requiredQty ?? 1;
      const conditionProductIds = offer.productCondition?.productIds ?? [];
      const giftSameAsCondition = offer.productCondition?.giftSameAsCondition ?? false;
      const trackBy = offer.productCondition?.trackBy ?? "variant";

      // Count qualifying products in cart (non-gift lines only)
      let qualifyingQty = 0;
      for (const line of cartLines) {
        if (line.attribute?.value === "true") continue;
        const productId = line.merchandise?.product?.id ?? null;
        const variantId = line.merchandise?.id ?? null;

        if (conditionProductIds.length === 0) {
          // No specific products — any product qualifies
          qualifyingQty += line.quantity;
        } else if (trackBy === "variant" && variantId) {
          // Check if this variant's product is in the condition list
          if (conditionProductIds.includes(productId)) {
            qualifyingQty += line.quantity;
          }
        } else {
          // Track by product
          if (conditionProductIds.includes(productId)) {
            qualifyingQty += line.quantity;
          }
        }
      }

      qualifies = qualifyingQty >= requiredQty;

    } else if (offer.triggerType === "CART_VALUE_MULTIPLIER") {
      // --- CART VALUE MULTIPLIER trigger (Spend more get more) ---
      // For multiplier, we always qualify if cart > baseValue
      // The number of gifts is determined by floor(cartSubtotal / baseValue)
      const baseValue = offer.multiplierCondition?.baseValue ?? 0;
      const appliesTo = offer.multiplierCondition?.appliesTo ?? "ANY";
      const conditionProductIds = offer.multiplierCondition?.productIds ?? [];

      if (baseValue <= 0) continue;

      let cartSubtotal = 0;
      for (const line of cartLines) {
        if (line.attribute?.value === "true") continue;
        const lineAmount = parseFloat(line.cost?.subtotalAmount?.amount ?? "0");
        if (appliesTo === "ANY") {
          cartSubtotal += lineAmount;
        } else if (appliesTo === "SELECTED") {
          const productId = line.merchandise?.product?.id ?? null;
          if (productId && conditionProductIds.includes(productId)) {
            cartSubtotal += lineAmount;
          }
        } else {
          cartSubtotal += lineAmount;
        }
      }

      qualifies = cartSubtotal >= baseValue;
    }

    if (!qualifies) continue;

    // Apply receiveCount limit
    const linesToDiscount =
      receiveMode === "CHOOSE_COUNT" && receiveCount !== null
        ? validGiftLines.slice(0, receiveCount)
        : validGiftLines;

    for (const line of linesToDiscount) {
      let discountedPrice;

      if (discountType === "PERCENTAGE") {
        const originalPrice = parseFloat(line.cost?.subtotalAmount?.amount ?? "0");
        const quantity = line.quantity || 1;
        const pricePerUnit = originalPrice / quantity;
        const discount = discountValue / 100;
        discountedPrice = (pricePerUnit * (1 - discount)).toFixed(2);
      } else {
        const originalPrice = parseFloat(line.cost?.subtotalAmount?.amount ?? "0");
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