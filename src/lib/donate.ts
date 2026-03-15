const rawDonationUrl = String(import.meta.env.PUBLIC_STRIPE_DONATION_URL || "").trim();

export const isDonationPlaceholder = rawDonationUrl.length === 0;

export const getDonationHref = (source: string) => {
  const encodedSource = encodeURIComponent(source);
  if (!isDonationPlaceholder) {
    const separator = rawDonationUrl.includes("?") ? "&" : "?";
    return `${rawDonationUrl}${separator}source=${encodedSource}`;
  }
  return `/donate?source=${encodedSource}&placeholder=1`;
};

export const getDonationTitle = () =>
  isDonationPlaceholder
    ? "Stripe donation checkout placeholder until the account is connected."
    : "Donate securely with Stripe.";
