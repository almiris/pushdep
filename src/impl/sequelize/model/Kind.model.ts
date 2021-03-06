import { PushDepKind } from "../../../core/PushDep";
import { Column, CreatedAt, DeletedAt, HasMany, Model, PrimaryKey, Table, UpdatedAt } from "sequelize-typescript";
import { Task } from "./Task.model";
import { KindActivityLock } from "./KindActivityLock.model";

@Table({
    timestamps: true,
    paranoid: true,
    underscored: true,
    freezeTableName: true,
    tableName: "kind",
    version: "version",
    comment: "A worker will process tasks of a given kind"
})
export class Kind extends Model implements PushDepKind {
    @PrimaryKey 
    @Column({
        field: "id",
        type: "text",
        comment: "Id of this kind"
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

    @HasMany(() => Task)
    tasks: Task[];

    @HasMany(() => KindActivityLock)
    kindActivityLocks: KindActivityLock[];
}
