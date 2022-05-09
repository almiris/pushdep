import { PushDepKind } from "../../../core/PushDep";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn, VersionColumn } from "typeorm";
import { Task } from "./Task.entity";

@Entity({
    name: "kind",
})
export class Kind implements PushDepKind {
    @PrimaryColumn({
        name: "id",
        type: "text",
        comment: "Id of the kind"
    })
    id: string;

    @Column({
        name: "concurrency",
        type: "int",
        nullable: false,
        comment: "Max concurrency for the kind - Multiple workers will only be able to execute this number of tasks of this kind concurrently"
    })
    concurrency: number;

    @CreateDateColumn({
        name: "created_at",
        type: "timestamp with time zone",
        nullable: false,
        comment: "Timestamp that tracks when the kind is first set"
    })
    createdAt: Date;

    @UpdateDateColumn({
        name: "updated_at",
        type: "timestamp with time zone",
        nullable: false,
        comment: "Timestamp that tracks when the kind is updated"
    })
    updatedAt: Date;

    @DeleteDateColumn({
        name: "deleted_at",
        type: "timestamp with time zone",
        nullable: true,
        comment: "Timestamp that tracks when the kind is deleted"
    })
    deletedAt: Date;

    @VersionColumn({
        name: "version",
        type: "int",
        nullable: false,
        default: 0,
        comment: "Version of the kind - used for optimistic locking"
    })
    version: number;

    @OneToMany(() => Task, task => task.kind)
    tasks: Task[];
}
