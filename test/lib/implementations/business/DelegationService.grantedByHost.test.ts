import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DomainString,
  type IExecutionPermissionResponse,
} from "@1shotapi/ows-types";

import { DelegationService } from "@/lib/implementations/business/DelegationService.ts";
import type { IDelegationRepository } from "@/lib/interfaces/data/IDelegationRepository.ts";
import type {
  IDelegationSummary,
  IStoredDelegation,
} from "@/lib/types/domain/StoredDelegation.ts";

function grant(id: string, hostDomain: string): IStoredDelegation {
  return {
    delegationId: id,
    hostDomain: DomainString(hostDomain),
    permissionResponse: {
      context: `0x${id}`,
    } as unknown as IExecutionPermissionResponse,
  } as unknown as IStoredDelegation;
}

function fakeRepository(grants: IStoredDelegation[]): IDelegationRepository {
  return {
    listDelegations: async () =>
      grants.map(
        (g) =>
          ({
            delegationId: g.delegationId,
            hostDomain: g.hostDomain,
          }) as IDelegationSummary,
      ),
    getDelegation: async (id) => grants.find((g) => g.delegationId === id),
  } as unknown as IDelegationRepository;
}

function serviceWith(grants: IStoredDelegation[]): DelegationService {
  return new DelegationService(
    undefined as never,
    fakeRepository(grants),
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );
}

describe("DelegationService.getGrantedExecutionPermissions", () => {
  it("returns only the grants made to the asking host", async () => {
    const service = serviceWith([
      grant("a1", "app.example.com"),
      grant("b2", "other.example"),
      grant("c3", "App.Example.COM"),
    ]);

    const responses = await service.getGrantedExecutionPermissions(
      DomainString("app.example.com"),
    );

    assert.deepEqual(
      responses.map((r) => r.context),
      ["0xa1", "0xc3"],
    );
  });

  it("returns nothing for a host that holds no grants", async () => {
    const service = serviceWith([grant("a1", "app.example.com")]);
    assert.deepEqual(
      await service.getGrantedExecutionPermissions(
        DomainString("evil.example"),
      ),
      [],
    );
    assert.deepEqual(
      await service.getGrantedExecutionPermissions(DomainString("unknown")),
      [],
    );
  });
});
