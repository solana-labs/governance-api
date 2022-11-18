import { MigrationInterface, QueryRunner } from "typeorm";

export class migrations1668717005862 implements MigrationInterface {
    name = 'migrations1668717005862'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "discord_user" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "data" jsonb NOT NULL,
                "authId" character varying NOT NULL,
                "publicKeyStr" character varying NOT NULL,
                "refreshToken" character varying NOT NULL,
                "created" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted" TIMESTAMP,
                "updated" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_f1a1fe2a331511fcb2bd709fd35" UNIQUE ("authId"),
                CONSTRAINT "PK_2c465db058d41ca3a50f819b0a1" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "discord_user"
        `);
    }

}
