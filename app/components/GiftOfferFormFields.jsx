// Shared form fields for both "Create Gift offer" and "Edit Gift offer".
// Both routes render this inside their own <Form method="post"> and <s-page>,
// and handle their own loader/action (create vs update).

export default function GiftOfferFormFields({
  defaultValues,
  appliesTo,
  setAppliesTo,
  receiveMode,
  setReceiveMode,
}) {
  return (
    <>
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
            <s-text-field
              name="startAt"
              label="Start time"
              type="datetime-local"
              value={defaultValues.startAt}
            ></s-text-field>
            <s-text-field
              name="endAt"
              label="End time"
              type="datetime-local"
              value={defaultValues.endAt}
            ></s-text-field>
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
            <s-button type="button" disabled>
              Select products (coming in next step)
            </s-button>
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

          <s-button type="button" disabled>
            Select gifts (coming in next step) — 0 product(s) selected
          </s-button>
        </s-stack>
      </s-section>
    </>
  );
}