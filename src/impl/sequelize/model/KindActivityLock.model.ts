import { BelongsTo, Column, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { Kind } from "./Kind.model";
import { Task } from "./Task.model";

@Table({
    timestamps: false,
    paranoid: false,
    underscored: true,
    freezeTableName: true,
    tableName: "kind_activity_lock",
    comment: "A lock table used to implement kind concurrency",
    indexes: [{
        name: "idx_kind_activity_lock_kind_id",
        fields: ["kind_id"]
    }/*, {
        name: "idx_kind_activity_lock_task_id",
        fields: ["task_id"]
    }*/]
})
export class KindActivityLock extends Model {
    @PrimaryKey
    @Column({
        field: "id",
        type: "int",
        autoIncrement: true,
        autoIncrementIdentity: true,
        comment: "Id of the lock"
    })
    id: number;

    @Column({
        field: "locked_at",
        type: "timestamp with time zone",
        allowNull: true,
        comment: "Last time this lock has been acquired"
    })
    lockedAt: Date;

    @ForeignKey(() => Kind)
    @Column({
        field: "kind_id",
        type: "text",
        allowNull: false,
        comment: "The lock's kind"
    })
    kindId: string;
    
    @BelongsTo(() => Kind)
    kind: Kind;

    @ForeignKey(() => Task)
    @Column({
        field: "task_id",
        type: "bigint",
        allowNull: true,
        comment: "The task that has acquired the lock"
    })
    taskId: string;
    
    @BelongsTo(() => Task)
    task: Task;
}
