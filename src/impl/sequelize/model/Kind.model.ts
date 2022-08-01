import { PushDepKind } from "../../../core/PushDep";
import { Column, CreatedAt, DeletedAt, HasMany, Model, PrimaryKey, Table, UpdatedAt } from "sequelize-typescript";
import { Task } from "./Task.model";
import { KindActivityLock } from "./KindActivityLock.model";
import { PSHDP_KIND_TABLE } from "../definitions";

@Table({
    timestamps: true,
    paranoid: true,
    underscored: true,
    freezeTableName: true,
    tableName: PSHDP_KIND_TABLE,
    version: "version",
    comment: "A worker will process tasks of a given kind"
})
export class Kind extends Model implements PushDepKind {
    @PrimaryKey 
    @Column({
        field: "id",
        type: "text",
        comment: "Id of the kind"
    })
    id: string;

    @Column({
        field: "concurrency",
        type: "int",
        allowNull: false,
        comment: "Max concurrency for this kind - Multiple workers will only be able to execute this number of tasks concurrently"
    })
    concurrency: number;

    @Column({
        field: "lock_timeout_ms",
        type: "int",
        allowNull: true,
        comment: "If concurrency is set, this should be greater than the expected execution time of a task of this kind"
    })
    lockTimeoutMs: number;

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
        comment: "Timestamp that tracks when the kind is deleted"
    })
    deletedAt: Date;

    @Column({
        field: "version",
        type: "int",
        allowNull: false,
        defaultValue: 0,
        comment: "Version of the kind - used for optimistic locking"
    })
    version: number;

    @HasMany(() => Task)
    tasks: Task[];

    @HasMany(() => KindActivityLock)
    kindActivityLocks: KindActivityLock[];
}
