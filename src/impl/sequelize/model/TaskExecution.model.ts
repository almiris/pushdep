import { PushDepTaskExecution } from "../../../core/PushDep"
import { Task } from "./Task.model";
import { AutoIncrement, BelongsTo, Column, CreatedAt, DeletedAt, ForeignKey, Index, Model, PrimaryKey, Table, UpdatedAt } from "sequelize-typescript";

/**
 * A task execution. As of now, there is only one TaskExecution per Task so both entities
 * could be merged; having both entities leaves room for a future evolution where we
 * would be able to manage multiple execution of the same task, looping tasks...
 */
 @Table({
    timestamps: true,
    paranoid: true,
    underscored: true,
    freezeTableName: true,
    tableName: "task_execution",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    deletedAt: "deletedAt",
    version: "version",
    comment: "Tasks execution track the execution state of tasks",
    indexes: [{
        name: "idx_task_execution_created_at",
        fields: ["created_at"]
    }, {
        name: "idx_task_execution_deleted_at",
        fields: ["deleted_at"]
    }, {
        name: "idx_task_execution_task_id",
        fields: ["task_id"]
    }]
})
export class TaskExecution extends Model implements PushDepTaskExecution {
    @PrimaryKey
    @AutoIncrement
    @Column({
        field: "id",
        // type: "int" // conflicts with @AutoIncrement which set the SERIAL type
    })
    id: number;

    @Column({
        field: "state",
        type: "int",
        allowNull: false,
        comment: "State of this execution"
    })
    @Index({
        name: "idx_task_execution_state"
    })
    state: number;

    @Column({
        field: "started_at",
        type: "timestamp with time zone",
        allowNull: true,
    })
    startedAt: Date;

    @Column({
        field: "completed_at",
        type: "timestamp with time zone",
        allowNull: true,
    })
    completedAt: Date;

    @Column({
        field: "canceled_at",
        type: "timestamp with time zone",
        allowNull: true,
    })
    canceledAt: Date;

    @Column({
        field: "failed_at",
        type: "timestamp with time zone",
        allowNull: true,
    })
    failedAt: Date;

    @CreatedAt
    @Column({
        field: "created_at",
        type: "timestamp with time zone",
        allowNull: false,
    })
    createdAt: Date;
    
    @UpdatedAt
    @Column({
        field: "updated_at",
        type: "timestamp with time zone",
        allowNull: false,
    })
    updatedAt: Date;
    
    @DeletedAt
    @Column({
        field: "deleted_at",
        type: "timestamp with time zone",
        allowNull: true
    })
    deletedAt: Date;
    
    @Column({
        field: "version",
        type: "int",
        allowNull: false,
        defaultValue: 0
    })
    version: number;     

    @ForeignKey(() => Task)
    @Column({
        field: "task_id",
        type: "uuid",
        allowNull: false
    })
    taskId: string;
    
    @BelongsTo(() => Task)
    task: Task;    
}
