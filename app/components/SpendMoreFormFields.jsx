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

export default function SpendMoreFormFields({
  defaultValues,
  appliesTo,
  setAppliesTo,
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
  const [conditionProducts, setConditionProducts] = useState([]);

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

  return (
    <>
      <input type="hidden" name="conditionProductIds" value={JSON.stringify(conditionProducts.map(p => p.id))} />
      <input type="hidden" name="conditionProductVariantIds" value={JSON.stringify(conditionProducts.map(p => p.variantId))} />
      <input type="hidden" name="giftProductIds" value={JSON.stringify(giftProducts.map(p => p.id))} />
      <input type="hidden" name="giftProductVariantIds" value={JSON.stringify(giftProducts.map(p => p.variantId))} />
      <input type="hidden" name="startAt" value={toISOString(startDate, startTime)} />
      <input type="hidden" name="endAt" value={toISOString(endDate, endTime)} />

      <s-section heading="Offer information">
        <s-stack direction="block" gap="base">
          <s-text-field name="internalName" label="Offer name" details="For internal use only, not shown to customers." placeholder="Spend more get more" value={defaultValues.internalName} required></s-text-field>
          <s-text-field name="title" label="Offer title" details="Shown to customers on the storefront." placeholder="Spend more get more" value={defaultValues.title} required></s-text-field>
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
          <s-paragraph>Cart value multiplier condition</s-paragraph>
          <s-number-field
            name="baseValue"
            label="Multiply base value"
            step="0.01"
            placeholder="500.00"
            details="E.g. when base value is $500, customer receives 1 gift when cart is above $500, 2 gifts when above $1000, 3 gifts when above $1500."
            value={defaultValues.baseValue}
          ></s-number-field>

          <s-select
            name="appliesTo"
            label="The condition will apply to"
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value)}
          >
            <s-option value="ANY">any products</s-option>
            <s-option value="SELECTED">selected products</s-option>
          </s-select>

          {appliesTo === "SELECTED" && (
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
          )}
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

          <s-paragraph details>
            Customer automatically receives 1 gift per base value threshold reached.
            E.g. with base value $500: spend $500 = 1 gift, spend $1000 = 2 gifts.
          </s-paragraph>

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
        </s-stack>
      </s-section>
    </>
  );
}