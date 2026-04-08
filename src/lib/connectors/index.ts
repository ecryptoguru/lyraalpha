import type { BrokerConnector, BrokerProvider } from "@/lib/types/broker";

import { ZerodhaConnector } from "./zerodha";
import { UpstoxConnector } from "./upstox";
import { AngelOneConnector } from "./angel-one";
import { DhanConnector } from "./dhan";
import { FyersConnector } from "./fyers";
import { GrowwConnector } from "./groww";
import { ICICIDirectConnector } from "./icici-direct";
import { KotakNeoConnector } from "./kotak-neo";
import { FivePaisaConnector } from "./five-paisa";
import { MotilalOswalConnector } from "./motilal-oswal";
import { ShoonyaConnector } from "./shoonya";
import { AliceBlueConnector } from "./alice-blue";
import { PlaidConnector } from "./plaid";
import { AlpacaConnector } from "./alpaca";

// ─── Registry ────────────────────────────────────────────────────────────────

const REGISTRY = new Map<BrokerProvider, BrokerConnector>([
  ["zerodha", ZerodhaConnector],
  ["upstox", UpstoxConnector],
  ["angel_one", AngelOneConnector],
  ["dhan", DhanConnector],
  ["fyers", FyersConnector],
  ["groww", GrowwConnector],
  ["icici_direct", ICICIDirectConnector],
  ["kotak_neo", KotakNeoConnector],
  ["five_paisa", FivePaisaConnector],
  ["motilal_oswal", MotilalOswalConnector],
  ["shoonya", ShoonyaConnector],
  ["alice_blue", AliceBlueConnector],
  ["plaid", PlaidConnector],
  ["alpaca", AlpacaConnector],
]);

export function getConnector(provider: BrokerProvider): BrokerConnector {
  const connector = REGISTRY.get(provider);
  if (!connector) {
    throw new Error(`No connector registered for provider: ${provider}`);
  }
  return connector;
}

export function listConnectors(): BrokerConnector[] {
  return Array.from(REGISTRY.values());
}

export {
  ZerodhaConnector,
  UpstoxConnector,
  AngelOneConnector,
  DhanConnector,
  FyersConnector,
  GrowwConnector,
  ICICIDirectConnector,
  KotakNeoConnector,
  FivePaisaConnector,
  MotilalOswalConnector,
  ShoonyaConnector,
  AliceBlueConnector,
  PlaidConnector,
  AlpacaConnector,
};

export { BrokerConnectorError, withRetry } from "./base";
