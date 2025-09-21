"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const builder_1 = require("../src/builder");
const nebula_client_1 = require("@xhs/nebula-client");
const schema_1 = require("../src/schema");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
require("dotenv/config");
(0, vitest_1.describe)('Ingestion Tests', () => {
    let nebulaClient;
    let entities;
    let files;
    (0, vitest_1.beforeAll)(async () => {
        // 1. Setup client and connect
        nebulaClient = new nebula_client_1.NebulaClient();
        await nebulaClient.connect();
        // DANGER: This will drop the existing space and recreate it.
        console.log(`Dropping space ${schema_1.SPACE} if it exists...`);
        await nebulaClient.executeNgql(`DROP SPACE IF EXISTS ${schema_1.SPACE}`);
        console.log('Recreating schema...');
        for (const stmt of schema_1.CREATE_SCHEMA_STATEMENTS) {
            await nebulaClient.executeNgql(stmt);
        }
        // Wait for schema to be applied
        console.log('Waiting for schema to be applied...');
        await new Promise(resolve => setTimeout(resolve, 10000)); // wait 10s
        // 2. Read and parse data
        const jsonPath = path.resolve(__dirname, '../src/fulfullmentTestData/entities.enriched.json');
        const jsonData = fs.readFileSync(jsonPath, 'utf-8');
        entities = JSON.parse(jsonData);
        // 3. Prepare file entities
        const fileMap = new Map();
        for (const entity of entities) {
            if (!fileMap.has(entity.file)) {
                const filePath = entity.file;
                const fileId = crypto.createHash('md5').update(filePath).digest('hex');
                fileMap.set(filePath, {
                    id: fileId,
                    path: filePath,
                    name: path.basename(filePath),
                    extension: path.extname(filePath)
                });
                // Update entity to use the new fileId
                entity.file = fileId;
            }
            else {
                entity.file = fileMap.get(entity.file).id;
            }
        }
        files = Array.from(fileMap.values());
    }, 30000);
    (0, vitest_1.it)('should ingest all data from enriched.json and measure RT for each object', async () => {
        console.log(`\n🚀 Starting ingestion of ${files.length} files and ${entities.length} entities...`);
        // Ingest files first
        for (const file of files) {
            await (0, builder_1.addOrUpdateFile)(file, nebulaClient);
        }
        console.log('✅ All file nodes ingested.');
        // Ingest entities and measure RT
        const durations = [];
        for (const entity of entities) {
            const startTime = performance.now();
            await (0, builder_1.addOrUpdateEntity)(entity, nebulaClient);
            const endTime = performance.now();
            const duration = endTime - startTime;
            durations.push({ id: entity.id, rt: duration });
        }
        // Log all RTs
        console.log('\n--- Ingestion Round-Trip Times ---');
        for (const result of durations) {
            console.log(`  - ${result.id}: ${result.rt.toFixed(2)} ms`);
        }
        const avgRt = durations.reduce((acc, d) => acc + d.rt, 0) / durations.length;
        console.log(`\n📊 Average RT per entity: ${avgRt.toFixed(2)} ms`);
        // Use createRelationships to build the connections
        console.log('\n🔗 Creating relationships...');
        // The previous buildGraph call was incorrect, let's call the internal relationship function directly
        // This assumes we can access it. If not, we need to export it from builder.ts
        // For now, let's assume it is available or we will export it.
        // I will modify builder.ts to export createRelationships
        await (0, builder_1.createRelationships)(entities, nebulaClient);
        console.log('✅ All relationships created.');
    }, 60000); // Increase timeout for ingestion
});
// We need to export createRelationships from builder.ts. 
// Let's create an internal utility file for that.
// Or just export it for test purposes.
// For now, I will modify builder.ts to export it, then import it here.
// But first, let's create the internal utility. 
