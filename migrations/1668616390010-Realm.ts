import { MigrationInterface, QueryRunner } from "typeorm";

export class Realm1668616390010 implements MigrationInterface {
    name = 'Realm1668616390010'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "realm" (
                "id" SERIAL NOT NULL,
                "data" jsonb NOT NULL,
                "environment" character varying NOT NULL,
                "publicKeyStr" character varying NOT NULL,
                "symbol" character varying,
                "created" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted" TIMESTAMP,
                "updated" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_c7757698a0934c102bde0d7f105" UNIQUE ("symbol"),
                CONSTRAINT "UQ_8cf45582e754cc64f8db829ee21" UNIQUE ("publicKeyStr"),
                CONSTRAINT "PK_6537490af0806cafc07ee7c032f" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "realm"
        `);
    }

}
