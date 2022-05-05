import { Column, ForeignKey, Model, Table } from "sequelize-typescript";
import { Task } from "./Task.model";

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
    taskId: string;

    @Column({
        field: "dependency_id",
        type: "uuid",
        allowNull: false
    })
    @ForeignKey(() => Task)
    dependencyId: string;
}
