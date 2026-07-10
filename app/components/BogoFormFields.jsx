import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

function parseDateTime(isoString) {
  if (!isoString) return { date: "", time: "" };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { date: "", time: "" };
    return { date: d.toISOString().split("T")[0], time: d.toTimeString().slice(0, 5) };
  } catch { return { date: "", time: "" }; }
}

function toISOString(date, time) {
  if (!date) return "";
  return `${date}T${time || "00:00"}:00`;
}

export default function BogoFormFields({
  defaultValues,
  isBogo,
  conditionProducts,
  setConditionProducts,
  giftProducts,
  setGiftProducts,
}) {
  const shopify = useAppBridge();

  const parsedStart = parseDateTime(defaultValues.startAt);
  const parsedEnd = parseDateTime(defaultValues.endAt);

  const [startDate, setStartDate] = useState(parsedStart.date);
  const [startTime, setStartTime] = useState(parsedStart.time);
  const [endDate, setEndDate] = useState(parsedEnd.date);
  const [endTime, setEndTime] = useState(parsedEnd.time);

  const [multiplyGifts, setMultiplyGifts] = useState(defaultValues.multiplyGifts ?? false);
  const [giftSameAsCondition, setGiftSameAsCondition] = useState(isBogo ? true : false);
  const [trackBy, setTrackBy] = useState(defaultValues.trackBy || "variant");
  const [receiveMode, setReceiveMode] = useState(defaultValues.receiveMode || "CHOOSE_COUNT");

  const openConditionPicker = async () => {
    const result = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: conditionProducts.map((p) => ({ id: p.id })),
    });
    if (result?.selection) {
      setConditionProducts(result.selection.map((p) => ({
        id: p.id, title: p.title, variantId: p.variants?.[0]?.id ?? null,
      })));
    }
  };

  const openGiftPicker = async () => {
    const result = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: giftProducts.map((p) => ({ id: p.id })),
    });
    if (result?.selection) {
      setGiftProducts(result.selection.map((p) => ({
        id: p.id, title: p.title, variantId: p.variants?.[0]?.id ?? null,
      })));
    }
  };

  return (
    <>
      <input type="hidden" name="conditionProductIds" value={JSON.stringify(conditionProducts.map(p => p.id))} />
      <input type="hidden" name="conditionProductVariantIds" value={JSON.stringify(conditionProducts.map(p => p.variantId))} />
      <input type="hidden" name="giftProductIds" value={JSON.stringify(giftSameAsCondition ? conditionProducts.map(p => p.id) : giftProducts.map(p => p.id))} />
      <input type="hidden" name="giftProductVariantIds" value={JSON.stringify(giftSameAsCondition ? conditionProducts.map(p => p.variantId) : giftProducts.map(p => p.variantId))} />
      <input type="hidden" name="multiplyGifts" value={String(multiplyGifts)} />
      <input type="hidden" name="giftSameAsCondition" value={String(giftSameAsCondition)} />
      <input type="hidden" name="trackBy" value={trackBy} />
      <input type="hidden" name="startAt" value={toISOString(startDate, startTime)} />
      <input type="hidden" name="endAt" value={toISOString(endDate, endTime)} />

      <s-section heading="Offer information">
        <s-stack direction="block" gap="base">
          <s-text-field name="internalName" label="Offer name" details="For internal use only, not shown to customers." placeholder={isBogo ? "BOGO Buy 1 get 1 the same" : "BXGY Buy X get Y"} value={defaultValues.internalName} required></s-text-field>
          <s-text-field name="title" label="Offer title" details="Shown to customers on the storefront." placeholder={isBogo ? "BOGO (Buy 1 get 1 the same)" : "BXGY (Buy X get Y)"} value={defaultValues.title} required></s-text-field>
          <s-stack direction="inline" gap="base">
            <s-stack direction="block" gap="tight">
              <s-date-field label="Start date" value={startDate} placeholder="YYYY-MM-DD" onChange={(e) => setStartDate(e.target.value)}></s-date-field>
              <s-text-field label="Start time" placeholder="14:00" details="24-hour format (HH:MM)" value={startTime} onChange={(e) => setStartTime(e.target.value)}></s-text-field>
            </s-stack>
            <s-stack direction="block" gap="tight">
              <s-date-field label="End date" value={endDate} placeholder="YYYY-MM-DD" onChange={(e) => setEndDate(e.target.value)}></s-date-field>
              <s-text-field label="End time" placeholder="23:59" details="24-hour format (HH:MM)" value={endTime} onChange={(e) => setEndTime(e.target.value)}></s-text-field>
            </s-stack>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Offer main condition">
        <s-stack direction="block" gap="base">
          <s-paragraph>Specific product condition</s-paragraph>

          <s-number-field name="requiredQty" label="Number of products required" placeholder="1" value={defaultValues.requiredQty}></s-number-field>

          <s-stack direction="block" gap="tight">
            <s-checkbox
              name="multiplyGiftsCheckbox"
              checked={multiplyGifts}
              onChange={(e) => setMultiplyGifts(e.target.checked)}
            >
              Multiply gifts with number of products
            </s-checkbox>
            {multiplyGifts && (
              <s-paragraph details>This feature allows customers to get more gifts by purchasing more products.</s-paragraph>
            )}
          </s-stack>

          {isBogo && (
            <s-stack direction="block" gap="tight">
              <s-checkbox
                name="giftSameCheckbox"
                checked={giftSameAsCondition}
                onChange={(e) => setGiftSameAsCondition(e.target.checked)}
              >
                Gifts will be the same as selected products
              </s-checkbox>
              {giftSameAsCondition && (
                <s-stack direction="block" gap="tight">
                  <s-select
                    name="trackBySelect"
                    label="Track by"
                    value={trackBy}
                    onChange={(e) => setTrackBy(e.target.value)}
                  >
                    <s-option value="variant">Track by variant</s-option>
                    <s-option value="product">Track by product</s-option>
                  </s-select>
                </s-stack>
              )}
            </s-stack>
          )}

          <s-select name="appliesTo" label="The condition will apply to" value="SELECTED">
            <s-option value="ANY">any products</s-option>
            <s-option value="SELECTED">selected products</s-option>
          </s-select>

          <s-stack direction="block" gap="tight">
            <s-button type="button" onClick={openConditionPicker}>
              Select products ({conditionProducts.length} selected)
            </s-button>
            {conditionProducts.map((p) => (
              <s-stack key={p.id} direction="inline" gap="tight" alignment="space-between">
                <s-text>{p.title}</s-text>
                <s-button type="button" variant="tertiary" onClick={() => setConditionProducts(conditionProducts.filter(x => x.id !== p.id))}>Remove</s-button>
              </s-stack>
            ))}
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Select gifts">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            <s-select name="giftDiscountType" label="Gift discount type" value={defaultValues.giftDiscountType}>
              <s-option value="PERCENTAGE">Percentage</s-option>
              <s-option value="AMOUNT">Amount</s-option>
            </s-select>
            <s-number-field name="giftDiscountValue" label="Value" step="0.01" placeholder="100" value={defaultValues.giftDiscountValue}></s-number-field>
          </s-stack>

          <s-select name="receiveMode" label="Customer will receive" value={receiveMode} onChange={(e) => setReceiveMode(e.target.value)}>
            <s-option value="ALL">Automatically all gifts</s-option>
            <s-option value="CHOOSE_COUNT">Number of gifts customer will receive</s-option>
          </s-select>

          {receiveMode === "CHOOSE_COUNT" && (
            <s-number-field name="receiveCount" label="Number of gifts" placeholder="1" value={defaultValues.receiveCount}></s-number-field>
          )}

          {!giftSameAsCondition && (
            <s-stack direction="block" gap="tight">
              <s-button type="button" onClick={openGiftPicker}>
                Select gifts ({giftProducts.length} product(s) selected)
              </s-button>
              {giftProducts.map((p) => (
                <s-stack key={p.id} direction="inline" gap="tight" alignment="space-between">
                  <s-text>{p.title}</s-text>
                  <s-button type="button" variant="tertiary" onClick={() => setGiftProducts(giftProducts.filter(x => x.id !== p.id))}>Remove</s-button>
                </s-stack>
              ))}
            </s-stack>
          )}

          {giftSameAsCondition && (
            <s-paragraph>Gift products are the same as the condition products selected above.</s-paragraph>
          )}
        </s-stack>
      </s-section>
    </>
  );
}