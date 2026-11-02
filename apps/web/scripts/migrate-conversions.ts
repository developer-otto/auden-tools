import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(
  new URL("../db/001-conversions.sql", import.meta.url),
  "utf8",
);
// Neon supports a transaction of separate statements. Keep the PL/pgSQL function
// body intact (it contains semicolons) when splitting this known migration.
const [tables, functionBody] = migration.split("CREATE OR REPLACE FUNCTION");
const statements = tables!.split(";").filter((statement) => statement.trim());
if (functionBody) statements.push(`CREATE OR REPLACE FUNCTION${functionBody}`);
await sql.transaction(statements.map((statement) => sql.query(statement, [])));
console.info("Conversion database schema is ready.");
