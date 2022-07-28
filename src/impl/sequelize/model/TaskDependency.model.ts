import { Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { Task } from "./Task.model";

@Table({
    timestamps: false,
    underscored: true,
    freezeTableName: true,
    tableName: "task_dependency",
    comment: "Tasks and their dependencies",
    indexes: [{
        name: "idx_task_dependency_task_id",
        fields: ["task_id"]
    }, {
        name: "idx_task_dependency_dependency_id",
        fields: ["dependency_id"]
    }]
})
export class TaskDependency extends Model {
    @PrimaryKey
    @ForeignKey(() => Task)
    @Column({
        field: "task_id",
        type: "bigint",
        allowNull: false
    })
    taskId: string;

    @PrimaryKey
    @ForeignKey(() => Task)
    @Column({
        field: "dependency_id",
        type: "bigint",
        allowNull: false
    })
    dependencyId: string;
}
