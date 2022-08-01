import { MigrationInterface, QueryRunner } from "typeorm";
import { PSHDP_SCHEMA, PSHDP_TASK_TABLE } from "../definitions";

export class MigrateTaskIndexes1658264833157 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX idx_task_state_priority_created_at ON ${PSHDP_SCHEMA}.${PSHDP_TASK_TABLE} USING btree (state ASC, priority DESC, created_at ASC);`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX idx_task_state_priority_created_at ON ${PSHDP_SCHEMA}.${PSHDP_TASK_TABLE};`);
    }
}
