import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';
import { PaginationDto } from '@common/dtos/pagination.dto';
import { bind } from './bind-params';
import { DynamicSql } from './dynamic-sql';
import { SqlStore } from './sql-store';
import { rowToCamel } from './to-camel';
import { ClassConstructor, Paginated } from './sql-mapper.types';

type Sql = string | DynamicSql;

@Injectable()
export class SqlMapper {
  constructor(
    private readonly dataSource: DataSource,
    private readonly store: SqlStore,
  ) {}

  named(id: string): DynamicSql {
    return DynamicSql.of(this.store.get(id));
  }

  private resolve(sql: Sql, params?: object): { text: string; params: Record<string, unknown> } {
    if (typeof sql === 'string') {
      return { text: sql, params: (params ?? {}) as Record<string, unknown> };
    }
    const built = sql.build();
    return { text: built.sql, params: { ...built.params, ...(params ?? {}) } };
  }

  private query(text: string, params: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    const { text: bound, values } = bind(text, params);
    return this.dataSource.query(bound, values);
  }

  async selectOne<T>(target: ClassConstructor<T>, sql: Sql, params?: object): Promise<T | null> {
    const { text, params: p } = this.resolve(sql, params);
    const rows = await this.query(text, p);
    return rows.length ? plainToInstance(target, rowToCamel(rows[0])) : null;
  }

  async selectList<T>(target: ClassConstructor<T>, sql: Sql, params?: object): Promise<T[]> {
    const { text, params: p } = this.resolve(sql, params);
    const rows = await this.query(text, p);
    return rows.map((r) => plainToInstance(target, rowToCamel(r)));
  }

  async selectPage<T>(
    target: ClassConstructor<T>,
    sql: Sql,
    page: PaginationDto,
    params?: object,
  ): Promise<Paginated<T>> {
    const { text, params: p } = this.resolve(sql, params);

    const countRows = await this.query(`SELECT count(*)::int AS total FROM (${text}) AS _c`, p);
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await this.query(`${text} LIMIT #{__limit} OFFSET #{__offset}`, {
      ...p,
      __limit: page.limit,
      __offset: page.offset,
    });

    return {
      data: rows.map((r) => plainToInstance(target, rowToCamel(r))),
      meta: {
        page: page.page,
        limit: page.limit,
        total,
        totalPages: Math.ceil(total / page.limit),
      },
    };
  }

  async execute<T>(target: ClassConstructor<T>, sql: Sql, params?: object): Promise<T[]> {
    const { text, params: p } = this.resolve(sql, params);
    const rows = await this.query(text, p);
    return rows.map((r) => rowToCamel(r)) as T[];
  }

  insert(sql: Sql, params?: object): Promise<number> {
    return this.affected(sql, params);
  }

  update(sql: Sql, params?: object): Promise<number> {
    return this.affected(sql, params);
  }

  delete(sql: Sql, params?: object): Promise<number> {
    return this.affected(sql, params);
  }

  private async affected(sql: Sql, params?: object): Promise<number> {
    const { text, params: p } = this.resolve(sql, params);
    const { text: bound, values } = bind(text, p);
    // Structured result (with affected count) is exposed on QueryRunner, not DataSource.query.
    const runner = this.dataSource.createQueryRunner();
    try {
      const result = await runner.query(bound, values, true);
      return Number(result?.affected ?? 0);
    } finally {
      await runner.release();
    }
  }
}
