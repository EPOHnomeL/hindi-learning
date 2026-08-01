// Hand the browser to PayFast's hosted checkout with a set of signed fields.
//
// A real form submission (top-level navigation), built off-DOM and fired once —
// PayFast's page is not something we can fetch. **The pairs are ordered and must
// be posted in the order given**: the signature is computed over the field
// order, so reordering them corrupts it and PayFast rejects the payment (see the
// ordering assertion in convex/purchase.test.ts). That is why both callers get
// an array of `{name, value}` from Convex rather than an object — Convex sorts
// object keys, and an object here would silently lose the order.
//
// Shared by the sale rail (CheckoutPage) and the donation rail (DonateSection)
// so the ordering rule is stated once, in the one place that could break it.
export function postToPayFast(action: string, fields: readonly { name: string; value: string }[]): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  for (const { name, value } of fields) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
