type Row = Record<string, any>;
type Seed = Record<string, Row[]>;

function clone<T>(value: T): T { return structuredClone(value); }

export function createFakeAdmin(seed: Seed = {}) {
  const store: Seed = Object.fromEntries(Object.entries(seed).map(([key, value]) => [key, clone(value)]));
  const insertLog: Array<{ table: string; row: Row }> = [];

  class Query {
    table: string;
    mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
    payload: any = null;
    filters: Array<(row: Row) => boolean> = [];
    orderSpec: { column: string; ascending: boolean } | null = null;
    limitCount: number | null = null;
    head = false;
    wantCount = false;

    constructor(table: string) {
      this.table = table;
      if (!store[table]) store[table] = [];
    }

    select(_columns = '*', options: any = {}) { this.head = Boolean(options?.head); this.wantCount = options?.count === 'exact'; return this; }
    insert(payload: any) { this.mode = 'insert'; this.payload = Array.isArray(payload) ? payload : [payload]; return this; }
    update(payload: any) { this.mode = 'update'; this.payload = payload; return this; }
    delete() { this.mode = 'delete'; return this; }
    eq(column: string, value: any) { this.filters.push((row) => row?.[column] === value); return this; }
    neq(column: string, value: any) { this.filters.push((row) => row?.[column] !== value); return this; }
    in(column: string, values: any[]) { this.filters.push((row) => values.includes(row?.[column])); return this; }
    is(column: string, value: any) { this.filters.push((row) => row?.[column] === value); return this; }
    not(column: string, op: string, value: any) { if (op === 'is') this.filters.push((row) => row?.[column] !== value); return this; }
    order(column: string, { ascending = true }: any = {}) { this.orderSpec = { column, ascending }; return this; }
    limit(count: number) { this.limitCount = count; return this; }
    contains(column: string, value: any) { const needle = JSON.stringify(value).slice(1, -1); this.filters.push((row) => JSON.stringify(row?.[column] || {}).includes(needle)); return this; }

    private matched() {
      let rows = (store[this.table] || []).filter((row) => this.filters.every((filter) => filter(row)));
      if (this.orderSpec) {
        const { column, ascending } = this.orderSpec;
        rows = [...rows].sort((a, b) => {
          const av = a?.[column], bv = b?.[column];
          return (av < bv ? -1 : av > bv ? 1 : 0) * (ascending ? 1 : -1);
        });
      }
      if (this.limitCount != null) rows = rows.slice(0, this.limitCount);
      return rows;
    }

    private async execute() {
      if (this.mode === 'insert') {
        const rows = (this.payload || []).map((row: Row) => ({ id: row.id || crypto.randomUUID(), created_at: row.created_at || new Date().toISOString(), ...clone(row) }));
        store[this.table].push(...rows);
        rows.forEach((row) => insertLog.push({ table: this.table, row: clone(row) }));
        return { data: this.head ? null : clone(rows), error: null, count: this.wantCount ? rows.length : null };
      }
      if (this.mode === 'update') {
        const rows = this.matched();
        rows.forEach((row) => Object.assign(row, clone(this.payload)));
        return { data: this.head ? null : clone(rows), error: null, count: this.wantCount ? rows.length : null };
      }
      if (this.mode === 'delete') {
        const matched = new Set(this.matched());
        store[this.table] = store[this.table].filter((row) => !matched.has(row));
        return { data: null, error: null, count: matched.size };
      }
      const rows = this.matched();
      return { data: this.head ? null : clone(rows), error: null, count: this.wantCount ? rows.length : null };
    }

    async single() {
      const result = await this.execute();
      const rows = Array.isArray(result.data) ? result.data : [];
      return rows.length === 1 ? { ...result, data: rows[0] } : { ...result, data: null, error: { message: 'PGRST_SINGLE' } };
    }

    async maybeSingle() {
      const result = await this.execute();
      const rows = Array.isArray(result.data) ? result.data : [];
      return rows.length <= 1 ? { ...result, data: rows[0] || null } : { ...result, data: null, error: { message: 'PGRST_MULTIPLE' } };
    }

    then(resolve: any, reject: any) { return this.execute().then(resolve, reject); }
  }

  return {
    from(table: string) { return new Query(table); },
    countInserts(table: string) { return insertLog.filter((entry) => entry.table === table).length; },
    rows(table: string) { return clone(store[table] || []); },
  };
}
