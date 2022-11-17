import { MigrationInterface, QueryRunner } from "typeorm";

export class User1660048272853 implements MigrationInterface {
    name = 'User1660048272853'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "user" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "data" jsonb NOT NULL,
                "authId" character varying NOT NULL,
                "publicKeyStr" character varying NOT NULL,
                "created" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted" TIMESTAMP,
                "updated" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_ad5065ee18a722baaa932d1c3c6" UNIQUE ("authId"),
                CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "user"
        `);
    }

}
