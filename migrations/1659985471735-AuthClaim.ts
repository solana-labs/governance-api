import { MigrationInterface, QueryRunner } from "typeorm";

export class AuthClaim1659985471735 implements MigrationInterface {
    name = 'AuthClaim1659985471735'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "auth_claim" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "nonce" character varying NOT NULL,
                "onBehalfOf" character varying NOT NULL,
                "created" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted" TIMESTAMP,
                "updated" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_b0d640283a501763c9f7e6e942d" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "auth_claim"
        `);
    }

}
