import { MigrationInterface, QueryRunner } from "typeorm";

export class FeedVote1661458148129 implements MigrationInterface {
    name = 'FeedVote1661458148129'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "realm_feed_item_vote" (
                "feedItemId" integer NOT NULL,
                "userId" uuid NOT NULL,
                "realmPublicKeyStr" character varying NOT NULL,
                "data" jsonb NOT NULL,
                "created" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted" TIMESTAMP,
                "updated" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_b38f37a82c7f2026c4615998e67" PRIMARY KEY ("feedItemId", "userId", "realmPublicKeyStr")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "realm_feed_item_vote"
        `);
    }

}
