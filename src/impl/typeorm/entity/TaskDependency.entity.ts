import { Entity, Index, PrimaryColumn } from "typeorm";

@Entity({
    name: "task_dependency",
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
