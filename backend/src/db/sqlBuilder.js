/**
 * Small SQL builders shared by the repositories.
 *
 * They only ever produce portable SQL (`?` placeholders - the PostgreSQL driver
 * rewrites them to `$n`), and they refuse unknown column names so a typo in a
 * controller can never reach the database.
 */

/** `UPDATE ... SET a = ?, b = ? WHERE id = ?` with params in the right order. */
export function buildUpdate(table, data, whereValue) {
  const keys = Object.keys(data);
  if (keys.length === 0) return null;

  const assignments = keys.map((key) => `${quoteColumn(key)} = ?`).join(", ");

  return {
    sql: `UPDATE ${quoteIdent(table)} SET ${assignments} WHERE ${quoteColumn("id")} = ?`,
    params: [...keys.map((key) => data[key]), whereValue],
  };
}

export function quoteIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe identifier: ${name}`);
  }
  return name;
}

/** Column names are bare snake_case identifiers on both providers. */
export function quoteColumn(name) {
  return quoteIdent(name);
}
