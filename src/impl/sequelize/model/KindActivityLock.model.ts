import { BelongsTo, Column, ForeignKey, Model, Table } from "sequelize-typescript";
import { Kind } from "./Kind.model";
import { Task } from "./Task.model";

@Table({
    timestamps: false,
    paranoid: false,
    underscored: true,
    freezeTableName: true,
    tableName: "kind_activity_lock",
    comment: "A lock table used to implement kind concurrency"
})
export class KindActivityLock extends Model {
    @Column({
        field: "locked_at",
        type: "timestamp with time zone",
        allowNull: true,
    })
    lockedAt: Date;

    @ForeignKey(() => Kind)
    @Column({
        field: "kind_id",
        type: "text",
        allowNull: false
    })
    kindId: string;
    
    @BelongsTo(() => Kind)
    kind: Kind;

    @ForeignKey(() => Task)
    @Column({
        field: "task_id",
        type: "uuid",
        allowNull: true
    })
    taskId: string;
    
    @BelongsTo(() => Task)
    task: Task;
}
