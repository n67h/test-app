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

  async function syncGifts() {
    if (isSyncing) return;
    isSyncing = true;

    try {
      const offers = getConfig();
      if (!offers.length) return;

      const cart = await getCart();
      const subtotal = cart.total_price / 100;

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
        const giftVariantIds = offer.gift?.variantIds ?? [];

        const now = Date.now();
        if (offer.schedule?.startAt && now < new Date(offer.schedule.startAt).getTime()) continue;
        if (offer.schedule?.endAt && now > new Date(offer.schedule.endAt).getTime()) continue;

        const qualifies = subtotal >= min && (max === null || subtotal <= max);

        for (let i = 0; i < giftProductIds.length; i++) {
          const giftProductGid = giftProductIds[i];
          const variantId = giftVariantIds[i] ?? null;
          const existingLine = giftLinesByProductGid[giftProductGid];

          if (qualifies && !existingLine) {
            if (variantId) {
              // Extract numeric ID from GID (e.g. "gid://shopify/ProductVariant/123" → 123)
              const numericVariantId = String(variantId).split("/").pop();
              await addToCart(numericVariantId);
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

  function scheduleSyncGifts() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncGifts, 1000);
  }

  setTimeout(syncGifts, 2000);
  setInterval(syncGifts, CHECK_INTERVAL);
  document.addEventListener("cart:updated", scheduleSyncGifts);
  document.addEventListener("cart:refresh", scheduleSyncGifts);
})();