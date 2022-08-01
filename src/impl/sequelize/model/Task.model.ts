import { BelongsTo, BelongsToMany, Column, CreatedAt, DeletedAt, ForeignKey, HasMany, Model, PrimaryKey, Table, UpdatedAt } from "sequelize-typescript";
import { PushDepTask } from "../../../core/PushDep";
import { PSHDP_TASK_TABLE } from "../definitions";
import { Kind } from "./Kind.model";
import { KindActivityLock } from "./KindActivityLock.model";
import { TaskDependency } from "./TaskDependency.model";

@Table({
    timestamps: true,
    paranoid: true,
    underscored: true,
    freezeTableName: true,
    tableName: PSHDP_TASK_TABLE,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    deletedAt: "deletedAt",
    version: "version",
    comment: "A task of a kind will be executed by a worker",
    indexes: [{
        name: "idx_task_priority",
        fields: ["priority"]
    }, {
        name: "idx_task_tag",
        fields: ["tag"]
    }, {
        name: "idx_task_kind_id",
        fields: ["kind_id"]
    }, {
        name: "idx_task_state",
        fields: ["state"]
    }, {
        name: "idx_task_created_at",
        fields: ["created_at"]
    }, {
        name: "idx_task_deleted_at",
        fields: ["deleted_at"]
    }, {
        name: "idx_task_state_priority_created_at",
        fields: [{
            name: "state",
            order: "ASC"
        },{
            name: "priority",
            order: "DESC"
        }, {
            name: "created_at",
            order: "ASC"
        }]
    }]
})
export class Task extends Model implements PushDepTask {
    @PrimaryKey
    @Column({
        field: "id",
        type: "bigint",
        autoIncrement: true,
        autoIncrementIdentity: true,
        comment: "Id of the task"
    })
    id: string; // https://stackoverflow.com/questions/39168501/pg-promise-returns-integers-as-strings

    @Column({
        field: "priority",
        type: "int",
        allowNull: false,
        comment: "Priority of the task"
    })
    priority: number;

    @Column({
        field: "tag",
        type: "text",
        allowNull: true,
        comment: "Tag of the task"
    })
    tag: string;

    @Column({
        field: "args",
        type: "jsonb",
        allowNull: true,
        comment: "Arguments of the task"
    })
    args: any;

    @Column({
        field: "results",
        type: "jsonb",
        allowNull: true,
        comment: "Results of the task"
    })
    results: any;

    @Column({
        field: "state",
        type: "int",
        allowNull: false,
        comment: "State of the execution"
    })
    state: number;

    @Column({
        field: "started_at",
        type: "timestamp with time zone",
        allowNull: true,
        comment: "Timestamp that tracks when the task started to become active"
    })
    startedAt: Date;

    @Column({
        field: "completed_at",
        type: "timestamp with time zone",
        allowNull: true,
        comment: "Timestamp that tracks if the task has succedeed"
    })
    completedAt: Date;
 
    @Column({
        field: "canceled_at",
        type: "timestamp with time zone",
        allowNull: true,
        comment: "Timestamp that tracks if the task was canceled"
    })
    canceledAt: Date;

    @Column({
        field: "failed_at",
        type: "timestamp with time zone",
        allowNull: true,
        comment: "Timestamp that tracks if the task has failed"
    })
    failedAt: Date;

    @CreatedAt
    @Column({
        field: "created_at",
        type: "timestamp with time zone",
        allowNull: false,
        comment: "Timestamp that tracks when the kind is first set"
    })
    createdAt: Date;
    
    @UpdatedAt
    @Column({
        field: "updated_at",
        type: "timestamp with time zone",
        allowNull: false,
        comment: "Timestamp that tracks when the kind is updated"
    })
    updatedAt: Date;
    
    @DeletedAt
    @Column({
        field: "deleted_at",
        type: "timestamp with time zone",
        allowNull: true,
        comment: "Timestamp that tracks when the task is deleted"
    })
    deletedAt: Date;
    
    @Column({
        field: "version",
        type: "int",
        allowNull: false,
        defaultValue: 0,
        comment: "Version of the task - used for optimistic locking"
    })
    version: number;       

    @ForeignKey(() => Kind)
    @Column({
        field: "kind_id",
        type: "text",
        allowNull: false,
        comment: "The task's kind"
    })
    kindId: string;
    
    @BelongsTo(() => Kind)
    kind: Kind;

    @BelongsToMany(() => Task, {
        through: {
            model: () => TaskDependency,
            unique: false
        },
        otherKey: "dependencyId"
    })
    dependencies: Task[];

    @BelongsToMany(() => Task, {
        through: {
            model: () => TaskDependency,
            unique: false
        },
        otherKey: "taskId"
    })
    dependents: Task[];

    @HasMany(() => KindActivityLock)
    kindActivityLocks: KindActivityLock[];
}
