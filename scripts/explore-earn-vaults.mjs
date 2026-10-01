import { EarnKit } from "@circle-fin/earn-kit";

const kit = new EarnKit();

async function list(chain) {
  const { vaults, pagination } = await kit.exploreVaults({
    chain,
    asset: "USDC",
    sortBy: "apy",
    pageSize: 100,
  });
  console.log(`\n=== ${chain} (${pagination.totalCount} vaults) ===`);
  for (const v of vaults) {
    console.log(
      JSON.stringify({
        name: v.name,
        vaultAddress: v.vaultAddress ?? v.address,
        protocol: v.protocol,
        status: v.status,
        currentApy: v.currentApy,
        circleGuarded: v.circleGuarded,
        circleSentinel: v.riskSignals?.circleSentinel,
        totalDeposits: v.totalDeposits,
        liquidity: v.liquidity,
      }),
    );
  }
}

await list("Arc_Testnet");
await list("Arc");
