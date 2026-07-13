(function () {
  const GIFT_ATTR = "_is_gift";
  const CHECK_INTERVAL = 8000;
  let isSyncing = false;
  let syncTimer = null;

  function getConfig() {
    return window.__giftOffers || [];
  }

  async function getCart() {
    const res = await fetch("/cart.js");
    if (!res.ok) throw new Error("Cart fetch failed: " + res.status);
    return res.json();
  }

  async function addToCart(variantId) {
    const numericId = String(variantId).split("/").pop();
    const res = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: numericId, quantity: 1, properties: { [GIFT_ATTR]: "true" } }],
      }),
    });
    if (!res.ok) throw new Error("Add to cart failed: " + res.status);
    return res.json();
  }

  async function removeFromCart(lineKey) {
    const res = await fetch("/cart/change.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lineKey, quantity: 0 }),
    });
    if (!res.ok) throw new Error("Remove from cart failed: " + res.status);
    return res.json();
  }

  function getCartSubtotal(cartItems, appliesTo, conditionProductIds) {
    return cartItems
      .filter((item) => item.properties?.[GIFT_ATTR] !== "true")
      .reduce((sum, item) => {
        const price = item.final_line_price / 100;
        if (appliesTo === "ANY") return sum + price;
        if (appliesTo === "SELECTED") {
          const productGid = `gid://shopify/Product/${item.product_id}`;
          return conditionProductIds.includes(productGid) ? sum + price : sum;
        }
        return sum + price;
      }, 0);
  }

  function getQualifyingQty(cartItems, conditionProductIds) {
    return cartItems
      .filter((item) => item.properties?.[GIFT_ATTR] !== "true")
      .reduce((sum, item) => {
        if (!conditionProductIds.length) return sum + item.quantity;
        const productGid = `gid://shopify/Product/${item.product_id}`;
        return conditionProductIds.includes(productGid) ? sum + item.quantity : sum;
      }, 0);
  }

  async function syncGifts() {
    if (isSyncing) return;
    isSyncing = true;

    try {
      const offers = getConfig();
      if (!offers.length) return;

      const cart = await getCart();

      // Map existing gift lines by product GID
      const giftLinesByProductGid = {};
      cart.items.forEach((item) => {
        if (item.properties?.[GIFT_ATTR] === "true") {
          giftLinesByProductGid[`gid://shopify/Product/${item.product_id}`] = item;
        }
      });

      for (const offer of offers) {
        if (offer.type !== "GIFT") continue;

        // Check schedule
        const now = Date.now();
        if (offer.schedule?.startAt && now < new Date(offer.schedule.startAt).getTime()) continue;
        if (offer.schedule?.endAt && now > new Date(offer.schedule.endAt).getTime()) continue;

        const giftProductIds = offer.gift?.productIds ?? [];
        const giftVariantIds = offer.gift?.variantIds ?? [];
        if (!giftProductIds.length) continue;

        let qualifies = false;
        let giftQty = 1; // default number of gifts to add

        if (offer.triggerType === "CART_VALUE") {
          const min = offer.cartCondition?.min ?? 0;
          const max = offer.cartCondition?.max ?? null;
          const appliesTo = offer.cartCondition?.appliesTo ?? "ANY";
          const conditionProductIds = offer.cartCondition?.productIds ?? [];
          const subtotal = getCartSubtotal(cart.items, appliesTo, conditionProductIds);
          qualifies = subtotal >= min && (max === null || max === 0 || subtotal <= max);

        } else if (offer.triggerType === "PRODUCT_QUANTITY") {
          const requiredQty = offer.productCondition?.requiredQty ?? 1;
          const conditionProductIds = offer.productCondition?.productIds ?? [];
          const qty = getQualifyingQty(cart.items, conditionProductIds);
          qualifies = qty >= requiredQty;

          // If multiplyGifts is on, calculate how many gifts
          if (qualifies && offer.productCondition?.multiplyGifts) {
            giftQty = Math.floor(qty / requiredQty);
          }

        } else if (offer.triggerType === "CART_VALUE_MULTIPLIER") {
          const baseValue = offer.multiplierCondition?.baseValue ?? 0;
          const appliesTo = offer.multiplierCondition?.appliesTo ?? "ANY";
          const conditionProductIds = offer.multiplierCondition?.productIds ?? [];
          if (baseValue <= 0) continue;
          const subtotal = getCartSubtotal(cart.items, appliesTo, conditionProductIds);
          qualifies = subtotal >= baseValue;
          if (qualifies) {
            giftQty = Math.floor(subtotal / baseValue);
          }
        }

        for (let i = 0; i < giftProductIds.length; i++) {
          const giftProductGid = giftProductIds[i];
          const variantId = giftVariantIds[i] ?? null;
          const existingLine = giftLinesByProductGid[giftProductGid];
          const currentQty = existingLine ? existingLine.quantity : 0;

          if (qualifies && !existingLine) {
            if (variantId) {
              await addToCart(variantId);
              giftLinesByProductGid[giftProductGid] = { key: "pending", quantity: 1 };
            }
          } else if (!qualifies && existingLine && existingLine.key !== "pending") {
            await removeFromCart(existingLine.key);
            delete giftLinesByProductGid[giftProductGid];
          }
        }
      }
    } catch (err) {
      console.error("[GiftOffer]", err.message);
    } finally {
      isSyncing = false;
    }
  }

  function scheduleSyncGifts() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncGifts, 1000);
  }

  setTimeout(syncGifts, 2000);
  setInterval(syncGifts, CHECK_INTERVAL);
  document.addEventListener("cart:updated", scheduleSyncGifts);
  document.addEventListener("cart:refresh", scheduleSyncGifts);
})();