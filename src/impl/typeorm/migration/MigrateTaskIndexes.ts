import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrateTaskIndexes1658264833157 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX idx_task_state_priority_created_at ON public.task USING btree (state, priority DESC, created_at);`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX idx_task_state_priority_created_at ON public.task;`);
    }
}
