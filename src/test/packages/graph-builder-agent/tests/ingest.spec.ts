// import { describe, it, beforeAll } from "vitest";
// import {
//   addOrUpdateEntity,
//   addOrUpdateFile,
//   createRelationships,
// } from "../src/builder";
// import { EnrichedEntity, FileEntity } from "../src/types";
// import { NebulaClient } from "@xhs/nebula-client";
// // import { SPACE, CREATE_SCHEMA_STATEMENTS } from "../src/schema";
// import * as fs from "fs";
// import * as path from "path";
// import * as crypto from "crypto";
// import "dotenv/config";

// describe("Ingestion Tests", () => {
//   let nebulaClient: NebulaClient;
//   let entities: EnrichedEntity[];
//   let files: FileEntity[];

//   beforeAll(async () => {
//     // 1. Setup client and connect
//     nebulaClient = new NebulaClient();
//     await nebulaClient.connect();
//     // DANGER: This will drop the existing space and recreate it.
//     console.log(`Dropping space ${SPACE} if it exists...`);
//     await nebulaClient.executeNgql(`DROP SPACE IF EXISTS ${SPACE}`);
//     console.log("Recreating schema...");
//     for (const stmt of CREATE_SCHEMA_STATEMENTS) {
//       await nebulaClient.executeNgql(stmt);
//     }
//     // Wait for schema to be applied
//     console.log("Waiting for schema to be applied...");
//     await new Promise((resolve) => setTimeout(resolve, 10000)); // wait 10s

//     // 2. Read and parse data
//     const jsonPath = path.resolve(
//       __dirname,
//       "../src/fulfullmentTestData/entities.enriched.json"
//     );
//     const jsonData = fs.readFileSync(jsonPath, "utf-8");
//     entities = JSON.parse(jsonData);

//     // 3. Prepare file entities
//     const fileMap = new Map<string, FileEntity>();
//     for (const entity of entities) {
//       if (!fileMap.has(entity.file)) {
//         const filePath = entity.file;
//         const fileId = crypto.createHash("md5").update(filePath).digest("hex");
//         fileMap.set(filePath, {
//           id: fileId,
//           path: filePath,
//           name: path.basename(filePath),
//           extension: path.extname(filePath),
//         });
//         // Update entity to use the new fileId
//         entity.file = fileId;
//       } else {
//         entity.file = fileMap.get(entity.file)!.id;
//       }
//     }
//     files = Array.from(fileMap.values());
//   }, 30000);

//   it("should ingest all data from enriched.json and measure RT for each object", async () => {
//     console.log(
//       `\n🚀 Starting ingestion of ${files.length} files and ${entities.length} entities...`
//     );

//     // Ingest files first
//     for (const file of files) {
//       await addOrUpdateFile(file, nebulaClient);
//     }
//     console.log("✅ All file nodes ingested.");

//     // Ingest entities and measure RT
//     const durations: { id: string; rt: number }[] = [];
//     for (const entity of entities) {
//       const startTime = performance.now();
//       await addOrUpdateEntity(entity, nebulaClient);
//       const endTime = performance.now();
//       const duration = endTime - startTime;
//       durations.push({ id: entity.id, rt: duration });
//     }

//     // Log all RTs
//     console.log("\n--- Ingestion Round-Trip Times ---");
//     for (const result of durations) {
//       console.log(`  - ${result.id}: ${result.rt.toFixed(2)} ms`);
//     }
//     const avgRt =
//       durations.reduce((acc, d) => acc + d.rt, 0) / durations.length;
//     console.log(`\n📊 Average RT per entity: ${avgRt.toFixed(2)} ms`);

//     // Use createRelationships to build the connections
//     console.log("\n🔗 Creating relationships...");
//     // The previous buildGraph call was incorrect, let's call the internal relationship function directly
//     // This assumes we can access it. If not, we need to export it from builder.ts
//     // For now, let's assume it is available or we will export it.
//     // I will modify builder.ts to export createRelationships
//     await createRelationships(entities, nebulaClient);
//     console.log("✅ All relationships created.");
//   }, 60000); // Increase timeout for ingestion
// });

// // We need to export createRelationships from builder.ts.
// // Let's create an internal utility file for that.
// // Or just export it for test purposes.
// // For now, I will modify builder.ts to export it, then import it here.
// // But first, let's create the internal utility.
