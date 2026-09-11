/**
 * Ghana phone helpers.
 * Everything is stored in international format WITHOUT the plus: 233241234567
 */

const NETWORK_PREFIXES = {
  mtn: ["23324", "23354", "23355", "23359", "23353"],
  vodafone: ["23320", "23350"],
  airteltigo: ["23326", "23327", "23356", "23357"],
};

/** "024 123 4567" | "+233241234567" | "00233241234567" -> "233241234567" */
export function normalizePhone(input, defaultCountryCode = "233") {
  if (!input) return null;
  let digits = String(input).replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = defaultCountryCode + digits.slice(1);
  if (!digits.startsWith(defaultCountryCode) && digits.length === 9) {
    digits = defaultCountryCode + digits;
  }
  return /^233\d{9}$/.test(digits) ? digits : null;
}

/** Guess the mobile money network from a Ghanaian number. */
export function detectNetwork(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return "mtn";
  for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
    if (prefixes.some((prefix) => normalized.startsWith(prefix))) return network;
  }
  return "mtn";
}

/** natthesisa network key -> Hubtel channel */
export function hubtelChannel(network) {
  return { mtn: "mtn-gh", vodafone: "vodafone-gh", airteltigo: "airtel-gh" }[network] || "mtn-gh";
}

/** natthesisa network key -> Paystack provider code */
export function paystackProvider(network) {
  return { mtn: "mtn", vodafone: "vod", airteltigo: "atl" }[network] || "mtn";
}

export function maskPhone(phone) {
  if (!phone) return null;
  return phone.slice(0, 3) + "***" + phone.slice(-3);
}
