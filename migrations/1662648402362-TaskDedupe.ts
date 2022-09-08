import { MigrationInterface, QueryRunner } from "typeorm";

export class TaskDedupe1662648402362 implements MigrationInterface {
    name = 'TaskDedupe1662648402362'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "task_dedupe" (
                "id" SERIAL NOT NULL,
                "result" jsonb,
                "key" character varying NOT NULL,
                "created" TIMESTAMP NOT NULL DEFAULT now(),
                "updated" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_f5fa46cee20cf088a51b8c74a81" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "task_dedupe"
        `);
    }

}
