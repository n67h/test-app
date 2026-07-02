(function () {
  const GIFT_ATTR = "_is_gift";
  const POLL_INTERVAL = 500;

  // gift-offer.js
  // Reads active offers from the shop metafield (injected by the Liquid block),
  // watches the cart subtotal, and auto-adds/removes gift products accordingly.

  function getConfig() {
    // The Liquid block injects window.__giftOffers = [...] from the metafield
    return window.__giftOffers || [];
  }

  async function getCart() {
    const res = await fetch("/cart.js");
    return res.json();
  }

  async function addToCart(variantId) {
    await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            id: variantId,
            quantity: 1,
            properties: { [GIFT_ATTR]: "true" },
          },
        ],
      }),
    });
  }

  async function removeFromCart(lineKey) {
    await fetch("/cart/change.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lineKey, quantity: 0 }),
    });
  }

  async function getFirstVariantId(productId) {
    // Extract numeric ID from GID
    const numericId = productId.split("/").pop();
    const res = await fetch(
      `/products.json?ids=${numericId}&limit=1&fields=id,variants`
    );
    const data = await res.json();
    const product = data.products?.[0];
    return product?.variants?.[0]?.id ?? null;
  }

  async function syncGifts() {
    const offers = getConfig();
    if (!offers.length) return;

    const cart = await getCart();
    const subtotal = cart.total_price / 100; // Shopify returns cents

    // Find existing gift lines in cart
    const giftLines = cart.items.filter(
      (item) => item.properties?.[GIFT_ATTR] === "true"
    );
    const giftLinesByProductId = {};
    giftLines.forEach((line) => {
      const productId = `gid://shopify/Product/${line.product_id}`;
      giftLinesByProductId[productId] = line;
    });

    for (const offer of offers) {
      if (offer.type !== "GIFT" || offer.triggerType !== "CART_VALUE") continue;

      const min = offer.cartCondition?.min ?? 0;
      const max = offer.cartCondition?.max ?? null;
      const giftProductIds = offer.gift?.productIds ?? [];

      // Check schedule
      const now = Date.now();
      if (
        offer.schedule?.startAt &&
        now < new Date(offer.schedule.startAt).getTime()
      )
        continue;
      if (
        offer.schedule?.endAt &&
        now > new Date(offer.schedule.endAt).getTime()
      )
        continue;

      const qualifies =
        subtotal >= min && (max === null || subtotal <= max);

      for (const giftProductId of giftProductIds) {
        const existingLine = giftLinesByProductId[giftProductId];

        if (qualifies && !existingLine) {
          // Cart qualifies but gift not in cart — add it
          const variantId = await getFirstVariantId(giftProductId);
          if (variantId) {
            await addToCart(variantId);
          }
        } else if (!qualifies && existingLine) {
          // Cart no longer qualifies but gift is in cart — remove it
          await removeFromCart(existingLine.key);
        }
      }
    }
  }

  // Run on page load and then poll for cart changes
  // (polling is more reliable than trying to hook every add-to-cart event
  // across different theme implementations)
  syncGifts();
  setInterval(syncGifts, POLL_INTERVAL * 10); // check every 5 seconds

  // Also hook into Shopify's cart change events if the theme supports them
  document.addEventListener("cart:updated", syncGifts);
  document.addEventListener("cart:refresh", syncGifts);
})();