import { Column, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { Task } from "./Task.model";
import { TaskExecution } from "./TaskExecution.model";

@Table({
    timestamps: false,
    underscored: true,
    freezeTableName: true,
    tableName: "task_dependency",
    comment: "Tasks and their dependencies"
})
export class TaskDependency extends Model {
    @Column({
        field: "task_id",
        type: "uuid",
        allowNull: false
    })
    @ForeignKey(() => Task)
    taskId: Task;

    @Column({
        field: "dependency_id",
        type: "uuid",
        allowNull: false
    })
    @ForeignKey(() => Task)
    dependencyId: Task;
}
