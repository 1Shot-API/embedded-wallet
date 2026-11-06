import { type Brand, make } from "ts-brand";

/**
 * Web origin as the browser serializes it on `MessageEvent.origin` and
 * `location.ancestorOrigins`: scheme + host + optional port, no path
 * (e.g. `https://app.example.com`). Use `DomainString` for the hostname alone.
 */
export type OriginString = Brand<string, "OriginString">;
export const OriginString = make<OriginString>();
