import { MigrationInterface, QueryRunner } from "typeorm";

export class RealmFeedItemComment1663081197272 implements MigrationInterface {
    name = 'RealmFeedItemComment1663081197272'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "realm_feed_item_comment" (
                "id" SERIAL NOT NULL,
                "authorId" uuid NOT NULL,
                "data" jsonb NOT NULL,
                "feedItemId" integer NOT NULL,
                "environment" character varying NOT NULL,
                "metadata" jsonb NOT NULL,
                "parentCommentId" integer,
                "realmPublicKeyStr" character varying NOT NULL,
                "created" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted" TIMESTAMP,
                "updated" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_241ee9ad70d478bea24f5cad849" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "realm_feed_item_comment_vote" (
                "commentId" integer NOT NULL,
                "userId" uuid NOT NULL,
                "realmPublicKeyStr" character varying NOT NULL,
                "data" jsonb NOT NULL,
                "created" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted" TIMESTAMP,
                "updated" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_e163f06bd5b24e570a1e3502598" PRIMARY KEY ("commentId", "userId", "realmPublicKeyStr")
            )
        `);
        await queryRunner.query(`
            ALTER TABLE "realm_feed_item_comment"
            ADD CONSTRAINT "FK_d9738a44f8f8e8436c9bbdcf0d6" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "realm_feed_item_comment"
            ADD CONSTRAINT "FK_8f105becc4961c4627e11ec0ed9" FOREIGN KEY ("feedItemId") REFERENCES "realm_feed_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "realm_feed_item_comment" DROP CONSTRAINT "FK_8f105becc4961c4627e11ec0ed9"
        `);
        await queryRunner.query(`
            ALTER TABLE "realm_feed_item_comment" DROP CONSTRAINT "FK_d9738a44f8f8e8436c9bbdcf0d6"
        `);
        await queryRunner.query(`
            DROP TABLE "realm_feed_item_comment_vote"
        `);
        await queryRunner.query(`
            DROP TABLE "realm_feed_item_comment"
        `);
    }

}
