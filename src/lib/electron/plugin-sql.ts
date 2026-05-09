export default class Database {
  static async load(_name: string): Promise<Database> {
    return new Database();
  }

  async execute(sql: string, params: unknown[] = []) {
    return window.phantom.invoke<{ rowsAffected: number; lastInsertId: number }>(
      "db_execute",
      { sql, params }
    );
  }

  async select<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
    return window.phantom.invoke("db_select", { sql, params }) as Promise<T>;
  }
}
