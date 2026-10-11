import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { plainToInstance } from 'class-transformer';
import type { Logger as WinstonLogger } from 'winston';
import { PaginationDto } from '@common/dtos/pagination.dto';
import { DB_LOGGER } from '@infra/logger/logger.module';
import { callerService } from '@infra/logger/utils/caller';
import { bind } from './utils/bind-params';
import { DynamicSql } from './utils/dynamic-sql';
import { SqlStore } from './sql-store';
import { rowToCamel } from './utils/to-camel';
import { ClassConstructor, Paginated } from './types/sql-mapper.types';

type Sql = string | DynamicSql;

@Injectable()
export class SqlMapper {
  private readonly dbLog: boolean;

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly store: SqlStore,
    config: ConfigService,
    @Inject(DB_LOGGER) private readonly dbLogger: WinstonLogger,
  ) {
    this.dbLog = config.get<boolean>('logging.db', false);
  }

  named(id: string): DynamicSql {
    return DynamicSql.of(this.store.get(id));
  }

  private resolve(sql: Sql, params?: object): { text: string; params: Record<string, unknown> } {
    if (typeof sql === 'string') {
      return { text: sql, params: (params ?? {}) as Record<string, unknown> };
    }
    const built = sql.build();
    return { text: built.sql, params: { ...built.params, ...params } };
  }

  private async query(
    text: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    const { text: bound, values } = bind(text, params);
    if (!this.dbLog) return this.txHost.tx.query(bound, values);
    const caller = callerService();
    const t0 = performance.now();
    const rows = await this.txHost.tx.query(bound, values);
    const ms = (performance.now() - t0).toFixed(1);
    this.dbLogger.debug({
      context: caller,
      message: `${bound} -- params: ${JSON.stringify(values)} (${ms}ms)`,
    });
    return rows;
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
    // Structured result (affected count) is exposed on QueryRunner, not EntityManager.query.
    // In a tx, reuse the tx's runner so the write participates and commits with it.
    const txRunner = this.txHost.tx.queryRunner;
    const runner = txRunner ?? this.txHost.tx.connection.createQueryRunner();
    const owns = !txRunner;
    try {
      if (!this.dbLog) {
        const result = await runner.query(bound, values, true);
        return Number(result?.affected ?? 0);
      }
      const caller = callerService();
      const t0 = performance.now();
      const result = await runner.query(bound, values, true);
      const ms = (performance.now() - t0).toFixed(1);
      this.dbLogger.debug({
        context: caller,
        message: `${bound} -- params: ${JSON.stringify(values)} (${ms}ms)`,
      });
      return Number(result?.affected ?? 0);
    } finally {
      if (owns) await runner.release(); // never release the tx's own runner
    }
  }
}
