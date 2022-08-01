import { Entity, Index, PrimaryColumn } from "typeorm";
import { PSHDP_TASK_DEPENDENCY_TABLE } from "../definitions";

@Entity({
    name: PSHDP_TASK_DEPENDENCY_TABLE,
    synchronize: false
})
@Index("idx_task_dependency_task_id", [ "taskId" ])
@Index("idx_task_dependency_dependency_id", [ "dependencyId" ])
export class TaskDependency {
    @PrimaryColumn({
        name: "task_id",
        type: "bigint",
        nullable: false,
        comment: "The task"
    })
    taskId: string;

    @PrimaryColumn({
        name: "dependency_id",
        type: "bigint",
        nullable: false,
        comment: "The task's dependency"
    })
    dependencyId: string;
}
