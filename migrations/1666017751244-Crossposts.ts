import { MigrationInterface, QueryRunner } from "typeorm";

export class Crossposts1666017751244 implements MigrationInterface {
    name = 'Crossposts1666017751244'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "realm_feed_item"
            ADD "crosspostedRealms" character varying array
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "realm_feed_item" DROP COLUMN "crosspostedRealms"
        `);
    }

}
