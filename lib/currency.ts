export function formatCurrency(amount: number | string, currencyCode: string = "DZD"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  const safeValue = Number.isFinite(value) ? value : 0;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
    })
      .format(safeValue)
      .replace(currencyCode, currencyCode) // keep explicit code, e.g. "DZD 7,000.00"
      .trim();
  } catch {
    // Unknown currency code — fall back to a plain, unambiguous format.
    return `${safeValue.toFixed(2)} ${currencyCode}`;
  }
}

export function currencySymbol(currencyCode: string): string {
  switch (currencyCode.toUpperCase()) {
    case "EUR":
      return "€";
    case "DZD":
      return "DA";
    case "USD":
      return "$";
    case "GBP":
      return "£";
    default:
      return currencyCode.toUpperCase();
  }
}
