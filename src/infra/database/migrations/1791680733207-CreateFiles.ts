import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFiles1791680733207 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "files" (
                "file_id"        varchar(36)  PRIMARY KEY,
                "file_path"      varchar(255) NOT NULL UNIQUE,
                "file_name"      varchar(255) NOT NULL,
                "file_size"      int          NOT NULL,
                "file_extension" varchar(20)  NOT NULL,
                "active_flag"    char(1)      NOT NULL DEFAULT 'Y',
                "created_at"     timestamptz  NOT NULL DEFAULT now(),
                "created_by"     varchar(20)  NOT NULL,
                "updated_at"     timestamptz  NOT NULL DEFAULT now(),
                "updated_by"     varchar(20)  NOT NULL
            )`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "files"`);
    }

}
