import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

let saverPromise: Promise<PostgresSaver> | null = null;

/** Lazily creates and `.setup()`s the LangGraph Postgres checkpointer once per process. */
export function getCheckpointer(): Promise<PostgresSaver> {
  if (!saverPromise) {
    saverPromise = (async () => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) throw new Error('DATABASE_URL is not set');
      const saver = PostgresSaver.fromConnString(connectionString);
      await saver.setup();
      return saver;
    })();
  }
  return saverPromise;
}
