import { MigrationInterface, QueryRunner } from "typeorm";

export class ReshapeUsers1791080101455 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Boilerplate reshape — no data to preserve. Drops the old id/email/status
        // table and recreates it keyed on user_id (login id) with a password hash.
        await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
        await queryRunner.query(`
            CREATE TABLE "users" (
                "user_id"       varchar(20)  PRIMARY KEY,
                "password_hash" varchar(255) NOT NULL,
                "active_flag"   char(1)      NOT NULL DEFAULT 'Y',
                "created_at"    timestamptz  NOT NULL DEFAULT now(),
                "created_by"    varchar(20)  NOT NULL,
                "updated_at"    timestamptz  NOT NULL DEFAULT now(),
                "updated_by"    varchar(20)  NOT NULL
            )`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    }

}
