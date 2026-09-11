/**
 * Mobile money provider adapter.
 *
 * Swap providers with one env var:  MOMO_PROVIDER=mock | hubtel | paystack
 * Every provider exposes the same three functions, so controllers, webhooks
 * and the apps never change when you switch.
 */
import { env } from "../../config/env.js";
import * as mock from "./mock.js";
import * as hubtel from "./hubtel.js";
import * as paystack from "./paystack.js";

const providers = { mock, hubtel, paystack };

export function getProvider(providerName = env.momo.provider) {
  const provider = providers[String(providerName).toLowerCase()];
  if (!provider) throw new Error(`Unknown MOMO_PROVIDER "${providerName}" (use mock, hubtel or paystack)`);
  return provider;
}

export const activeProvider = () => env.momo.provider;

export const charge = (args) => getProvider().charge(args);
export const verify = (args) => getProvider().verify(args);
export const parseWebhook = (payload, query) => getProvider().parseWebhook(payload, query);
