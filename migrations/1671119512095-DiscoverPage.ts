import { MigrationInterface, QueryRunner } from "typeorm";

export class DiscoverPage1671119512095 implements MigrationInterface {
    name = 'DiscoverPage1671119512095'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "discover_page" (
                "id" SERIAL NOT NULL,
                "data" jsonb NOT NULL,
                "environment" character varying NOT NULL,
                "created" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted" TIMESTAMP,
                "updated" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_a1d0ed0726579c1087195dfe972" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "discover_page"
        `);
    }

}
