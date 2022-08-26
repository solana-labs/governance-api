import { MigrationInterface, QueryRunner } from "typeorm";

export class RealmPostAuthor1661530384910 implements MigrationInterface {
    name = 'RealmPostAuthor1661530384910'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "realm_post"
            ADD "authorId" uuid NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "realm_post"
            ADD CONSTRAINT "FK_9d06be18d3a8c7e9aa11c983716" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "realm_post" DROP CONSTRAINT "FK_9d06be18d3a8c7e9aa11c983716"
        `);
        await queryRunner.query(`
            ALTER TABLE "realm_post" DROP COLUMN "authorId"
        `);
    }

}
