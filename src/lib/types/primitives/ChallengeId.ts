import { type Brand, make } from "ts-brand";

/** UUID returned by the relayer for a challenge */
export type ChallengeId = Brand<string, "ChallengeId">;
export const ChallengeId = make<ChallengeId>();
