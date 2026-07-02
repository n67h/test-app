(function () {
  const GIFT_ATTR = "_is_gift";
  const CHECK_INTERVAL = 8000; // 8 seconds between checks
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
    const res = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: variantId, quantity: 1, properties: { [GIFT_ATTR]: "true" } }],
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

  async function getVariantId(productGid) {
    // Use /products/NUMERIC_ID.js — most reliable Ajax API endpoint
    const numericId = productGid.split("/").pop();
    try {
      const res = await fetch(`/products/${numericId}.js`);
      if (!res.ok) return null;
      const product = await res.json();
      return product?.variants?.[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  async function syncGifts() {
    if (isSyncing) return;
    isSyncing = true;

    try {
      const offers = getConfig();
      if (!offers.length) return;

      const cart = await getCart();
      const subtotal = cart.total_price / 100;

      // Build map of existing gift lines by product GID
      const giftLinesByProductGid = {};
      cart.items.forEach((item) => {
        if (item.properties?.[GIFT_ATTR] === "true") {
          giftLinesByProductGid[`gid://shopify/Product/${item.product_id}`] = item;
        }
      });

      for (const offer of offers) {
        if (offer.type !== "GIFT" || offer.triggerType !== "CART_VALUE") continue;

        const min = offer.cartCondition?.min ?? 0;
        const max = offer.cartCondition?.max ?? null;
        const giftProductIds = offer.gift?.productIds ?? [];

        // Check schedule
        const now = Date.now();
        if (offer.schedule?.startAt && now < new Date(offer.schedule.startAt).getTime()) continue;
        if (offer.schedule?.endAt && now > new Date(offer.schedule.endAt).getTime()) continue;

        const qualifies = subtotal >= min && (max === null || subtotal <= max);

        for (const giftProductGid of giftProductIds) {
          const existingLine = giftLinesByProductGid[giftProductGid];

          if (qualifies && !existingLine) {
            const variantId = await getVariantId(giftProductGid);
            if (variantId) {
              await addToCart(variantId);
              // Prevent re-adding in same cycle
              giftLinesByProductGid[giftProductGid] = { key: "pending" };
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

  // Debounced sync — prevents rapid-fire calls
  function scheduleSyncGifts() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncGifts, 1000);
  }

  // Run once on page load after a short delay
  setTimeout(syncGifts, 2000);

  // Poll every 8 seconds
  setInterval(syncGifts, CHECK_INTERVAL);

  // Hook into theme events but debounced
  document.addEventListener("cart:updated", scheduleSyncGifts);
  document.addEventListener("cart:refresh", scheduleSyncGifts);
})();