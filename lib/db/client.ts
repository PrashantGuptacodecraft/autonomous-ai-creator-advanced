import { neon, Pool } from "@neondatabase/serverless";
import { getConfig } from "@/lib/config";

let sqlClient: ReturnType<typeof neon> | undefined;

export function db(): ReturnType<typeof neon> {
  if (!sqlClient) {
    sqlClient = neon(getConfig().DATABASE_URL);
  }
  return sqlClient;
}

export async function withTransaction<T>(
  callback: (client: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  }) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString: getConfig().DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client as never);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

export function resetDbForTests(): void {
  sqlClient = undefined;
}
