import { BelongsTo, BelongsToMany, Column, CreatedAt, DataType, DeletedAt, ForeignKey, HasMany, Index, Model, PrimaryKey, Table, UpdatedAt } from "sequelize-typescript";
import { PushDepTask } from "../../../core/PushDep";
import { Kind } from "./Kind.model";
import { KindActivityLock } from "./KindActivityLock.model";
import { TaskDependency } from "./TaskDependency.model";
import { TaskExecution } from "./TaskExecution.model";

@Table({
    timestamps: true,
    paranoid: true,
    underscored: true,
    freezeTableName: true,
    tableName: "task",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    deletedAt: "deletedAt",
    version: "version",
    comment: "A task of a kind will be executed by a worker",
    indexes: [{
        name: "idx_task_kind_id",
        fields: ["kind_id"]
    }, {
        name: "idx_task_created_at",
        fields: ["created_at"]
    }, {
        name: "idx_task_deleted_at",
        fields: ["deleted_at"]
    }]
})
export class Task extends Model implements PushDepTask {
    @PrimaryKey
    @Column({
        field: "id",
        type: "uuid",
        defaultValue: DataType.UUIDV4
    })
    id: string;

    @Column({
        field: "priority",
        type: "int",
        allowNull: false,
        comment: "Priority of the task"
    })
    @Index({
        name: "idx_task_priority"
    })
    priority: number;

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

    @ForeignKey(() => Kind)
    @Column({
        field: "kind_id",
        type: "text",
        allowNull: false
    })
    kindId: string;
    
    @BelongsTo(() => Kind)
    kind: Kind;

    // @BelongsToMany(() => Task, () => TaskDependency, "dependencyId")
    // dependencies: Task[];

    // @BelongsToMany(() => Task, () => TaskDependency, "taskId")
    // dependents: Task[];

    @BelongsToMany(() => Task, {
        through: {
            model: () => TaskDependency,
            unique: false
        },
        otherKey: "dependencyId"
        // sourceKey: "id",
        // targetKey: "dependency_id"
    })
    dependencies: Task[];

    @BelongsToMany(() => Task, {
        through: {
            model: () => TaskDependency,
            unique: false
        },
        otherKey: "taskId"
        // sourceKey: "id",
        // targetKey: "task_id"
    })
    dependents: Task[];

    @HasMany(() => TaskExecution)
    taskExecutions: TaskExecution[];

    @HasMany(() => KindActivityLock)
    kindActivityLocks: KindActivityLock[];
}
