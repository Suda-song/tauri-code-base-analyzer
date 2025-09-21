import { describe, it, expect, beforeAll } from "vitest";
import { addOrUpdateEntity } from "../src/builder";
import { EnrichedEntity } from "../src/types";
import { NebulaClient } from "@xhs/nebula-client";
// import { dePACE } from "../src/schema";
import "dotenv/config";

describe("Performance Tests", () => {
  let nebulaClient: NebulaClient;

  beforeAll(async () => {
    nebulaClient = new NebulaClient();
    await nebulaClient.connect();
    // await nebulaClient.executeNgql(`USE ${SPACE}`);
  });

  it("should measure the performance of adding a single entity", async () => {
    const entity: EnrichedEntity = {
      id: "Perf:Test",
      type: "performance",
      file: "src/perf.test.ts",
      loc: { start: 1, end: 1 },
      rawName: "PerfTest",
      IMPORTS: [],
      CALLS: [],
      EMITS: [],
      summary: "Performance test entity",
      tags: ["performance", "test"],
      isDDD: false,
      isWorkspace: false,
      ANNOTATION: "",
    };

    const startTime = performance.now();
    await addOrUpdateEntity(entity, nebulaClient);
    const endTime = performance.now();

    const duration = endTime - startTime;
    console.log(`\n⏱️  addOrUpdateEntity RT: ${duration.toFixed(2)} ms`);

    // You can add assertions here if needed, e.g.
    expect(duration).toBeLessThan(1000); // Example: assert it takes less than 1 second
  });
});
