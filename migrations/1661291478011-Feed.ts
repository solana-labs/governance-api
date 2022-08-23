import { MigrationInterface, QueryRunner } from "typeorm";

export class Feed1661291478011 implements MigrationInterface {
    name = 'Feed1661291478011'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "realm_feed_item" (
                "id" SERIAL NOT NULL,
                "data" jsonb NOT NULL,
                "environment" character varying NOT NULL,
                "metadata" jsonb NOT NULL,
                "realmPublicKeyStr" character varying NOT NULL,
                "created" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted" TIMESTAMP,
                "updated" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_e24c04da3892a7573c1aa0d37ef" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "realm_post" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "data" jsonb NOT NULL,
                "environment" character varying NOT NULL,
                "realmPublicKeyStr" character varying NOT NULL,
                "created" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted" TIMESTAMP,
                "updated" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_656c881149a9a927ec98733bcc0" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "realm_post"
        `);
        await queryRunner.query(`
            DROP TABLE "realm_feed_item"
        `);
    }

}
