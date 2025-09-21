"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const builder_1 = require("../src/builder");
const nebula_client_1 = require("@xhs/nebula-client");
const schema_1 = require("../src/schema");
require("dotenv/config");
(0, vitest_1.describe)("Performance Tests", () => {
    let nebulaClient;
    (0, vitest_1.beforeAll)(async () => {
        nebulaClient = new nebula_client_1.NebulaClient();
        await nebulaClient.connect();
        await nebulaClient.executeNgql(`USE ${schema_1.SPACE}`);
    });
    (0, vitest_1.it)("should measure the performance of adding a single entity", async () => {
        const entity = {
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
        await (0, builder_1.addOrUpdateEntity)(entity, nebulaClient);
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`\n⏱️  addOrUpdateEntity RT: ${duration.toFixed(2)} ms`);
        // You can add assertions here if needed, e.g.
        (0, vitest_1.expect)(duration).toBeLessThan(1000); // Example: assert it takes less than 1 second
    });
});
