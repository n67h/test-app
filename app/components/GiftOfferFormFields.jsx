import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

// Helper: parse an ISO datetime string into { date: "YYYY-MM-DD", time: "HH:MM" }
function parseDateTime(isoString) {
  if (!isoString) return { date: "", time: "" };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { date: "", time: "" };
    const date = d.toISOString().split("T")[0];
    const time = d.toTimeString().slice(0, 5);
    return { date, time };
  } catch {
    return { date: "", time: "" };
  }
}

// Helper: combine date + time into ISO string, or null if date is empty
function toISOString(date, time) {
  if (!date) return "";
  const timeStr = time || "00:00";
  return `${date}T${timeStr}:00`;
}

export default function GiftOfferFormFields({
  defaultValues,
  appliesTo,
  setAppliesTo,
  receiveMode,
  setReceiveMode,
  conditionProducts,
  setConditionProducts,
  giftProducts,
  setGiftProducts,
}) {
  const shopify = useAppBridge();

  // Parse saved datetime values into separate date/time parts
  const parsedStart = parseDateTime(defaultValues.startAt);
  const parsedEnd = parseDateTime(defaultValues.endAt);

  const [startDate, setStartDate] = useState(parsedStart.date);
  const [startTime, setStartTime] = useState(parsedStart.time);
  const [endDate, setEndDate] = useState(parsedEnd.date);
  const [endTime, setEndTime] = useState(parsedEnd.time);

  const openConditionProductPicker = async () => {
    const result = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: conditionProducts.map((p) => ({ id: p.id })),
    });
    if (result?.selection) {
      setConditionProducts(
        result.selection.map((p) => ({
          id: p.id,
          title: p.title,
          variantId: p.variants?.[0]?.id ?? null,
        })),
      );
    }
  };

  const openGiftProductPicker = async () => {
    const result = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: giftProducts.map((p) => ({ id: p.id })),
    });
    if (result?.selection) {
      setGiftProducts(
        result.selection.map((p) => ({
          id: p.id,
          title: p.title,
          variantId: p.variants?.[0]?.id ?? null,
        })),
      );
    }
  };

  return (
    <>
      {/* Hidden inputs for form submission */}
      <input
        type="hidden"
        name="conditionProductIds"
        value={JSON.stringify(conditionProducts.map((p) => p.id))}
      />
      <input
        type="hidden"
        name="conditionProductVariantIds"
        value={JSON.stringify(conditionProducts.map((p) => p.variantId))}
      />
      <input
        type="hidden"
        name="giftProductIds"
        value={JSON.stringify(giftProducts.map((p) => p.id))}
      />
      <input
        type="hidden"
        name="giftProductVariantIds"
        value={JSON.stringify(giftProducts.map((p) => p.variantId))}
      />
      {/* Combined datetime hidden inputs */}
      <input
        type="hidden"
        name="startAt"
        value={toISOString(startDate, startTime)}
      />
      <input
        type="hidden"
        name="endAt"
        value={toISOString(endDate, endTime)}
      />

      <s-section heading="Offer information">
        <s-stack direction="block" gap="base">
          <s-text-field
            name="internalName"
            label="Offer name"
            details="For internal use only, not shown to customers."
            placeholder="Spend X amount to get gift"
            value={defaultValues.internalName}
            required
          ></s-text-field>

          <s-text-field
            name="title"
            label="Offer title"
            details="Shown to customers on the storefront."
            placeholder="Spend X amount to get gift(s)"
            value={defaultValues.title}
            required
          ></s-text-field>

          <s-stack direction="inline" gap="base">
            <s-stack direction="block" gap="tight">
              <s-text>Start date</s-text>
              <s-date-field
                label="Start date"
                value={startDate}
                placeholder="YYYY-MM-DD"
                onChange={(e) => setStartDate(e.target.value)}
              ></s-date-field>
              <s-text-field
                label="Start time"
                placeholder="14:00"
                details="24-hour format (HH:MM)"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              ></s-text-field>
            </s-stack>

            <s-stack direction="block" gap="tight">
              <s-text>End date</s-text>
              <s-date-field
                label="End date"
                value={endDate}
                placeholder="YYYY-MM-DD"
                onChange={(e) => setEndDate(e.target.value)}
              ></s-date-field>
              <s-text-field
                label="End time"
                placeholder="23:59"
                details="24-hour format (HH:MM)"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              ></s-text-field>
            </s-stack>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Offer main condition">
        <s-stack direction="block" gap="base">
          <s-paragraph>Cart value condition</s-paragraph>
          <s-stack direction="inline" gap="base">
            <s-number-field
              name="cartMin"
              label="Min"
              step="0.01"
              placeholder="0.00"
              value={defaultValues.cartMin}
            ></s-number-field>
            <s-number-field
              name="cartMax"
              label="Max (optional)"
              step="0.01"
              placeholder="0.00"
              value={defaultValues.cartMax}
            ></s-number-field>
          </s-stack>

          <s-select
            name="appliesTo"
            label="The condition will apply to"
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value)}
          >
            <s-option value="ANY">any products</s-option>
            <s-option value="SELECTED">selected products</s-option>
            <s-option value="EXCLUDE_PRODUCTS" disabled>
              all except selected products (coming soon)
            </s-option>
            <s-option value="EXCLUDE_CATEGORY" disabled>
              all except selected types/vendors/collections (coming soon)
            </s-option>
            <s-option value="INCLUDE_CATEGORY" disabled>
              products in selected types/vendors/collections (coming soon)
            </s-option>
          </s-select>

          {appliesTo === "SELECTED" && (
            <s-stack direction="block" gap="tight">
              <s-button type="button" onClick={openConditionProductPicker}>
                Select products ({conditionProducts.length} selected)
              </s-button>
              {conditionProducts.length > 0 && (
                <s-stack direction="block" gap="tight">
                  {conditionProducts.map((p) => (
                    <s-stack
                      key={p.id}
                      direction="inline"
                      gap="tight"
                      alignment="space-between"
                    >
                      <s-text>{p.title}</s-text>
                      <s-button
                        type="button"
                        variant="tertiary"
                        onClick={() =>
                          setConditionProducts(
                            conditionProducts.filter((x) => x.id !== p.id),
                          )
                        }
                      >
                        Remove
                      </s-button>
                    </s-stack>
                  ))}
                </s-stack>
              )}
            </s-stack>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Select gifts">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            <s-select
              name="giftDiscountType"
              label="Gift discount type"
              value={defaultValues.giftDiscountType}
            >
              <s-option value="PERCENTAGE">Percentage</s-option>
              <s-option value="AMOUNT">Amount</s-option>
            </s-select>
            <s-number-field
              name="giftDiscountValue"
              label="Value"
              step="0.01"
              placeholder="100"
              value={defaultValues.giftDiscountValue}
            ></s-number-field>
          </s-stack>

          <s-select
            name="receiveMode"
            label="Customer will receive"
            value={receiveMode}
            onChange={(e) => setReceiveMode(e.target.value)}
          >
            <s-option value="ALL">Automatically all gifts</s-option>
            <s-option value="CHOOSE_COUNT">
              Number of gifts customer will receive
            </s-option>
          </s-select>

          {receiveMode === "CHOOSE_COUNT" && (
            <s-number-field
              name="receiveCount"
              label="Number of gifts"
              placeholder="1"
              value={defaultValues.receiveCount}
            ></s-number-field>
          )}

          <s-stack direction="block" gap="tight">
            <s-button type="button" onClick={openGiftProductPicker}>
              Select gifts ({giftProducts.length} product(s) selected)
            </s-button>
            {giftProducts.length > 0 && (
              <s-stack direction="block" gap="tight">
                {giftProducts.map((p) => (
                  <s-stack
                    key={p.id}
                    direction="inline"
                    gap="tight"
                    alignment="space-between"
                  >
                    <s-text>{p.title}</s-text>
                    <s-button
                      type="button"
                      variant="tertiary"
                      onClick={() =>
                        setGiftProducts(
                          giftProducts.filter((x) => x.id !== p.id),
                        )
                      }
                    >
                      Remove
                    </s-button>
                  </s-stack>
                ))}
              </s-stack>
            )}
          </s-stack>
        </s-stack>
      </s-section>
    </>
  );
}