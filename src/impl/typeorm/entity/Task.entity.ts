import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from "typeorm";
import { PushDepTask } from "../../../core/PushDep";
import { PSHDP_TASK_DEPENDENCY_TABLE, PSHDP_TASK_TABLE } from "../definitions";
import { Kind } from "./Kind.entity";
import { KindActivityLock } from "./KindActivityLock.entity";

@Entity({
    name: PSHDP_TASK_TABLE
})
@Index("idx_task_priority", [ "priority" ])
@Index("idx_task_tag", [ "tag" ])
@Index("idx_task_kind_id", [ "kindId" ])
@Index("idx_task_state", [ "state" ])
@Index("idx_task_created_at", [ "createdAt" ])
@Index("idx_task_deleted_at", [ "deletedAt" ])
// TypeORM does not allow using ASC or DESC in @Index: https://stackoverflow.com/questions/69850518/typeorm-index-creation => @see migration/MigrateTaskIndexes
// @Index("idx_task_state_priority_created_at", [ "state ASC", "priority DESC", "created_at ASC" ])
// @Index("idx_task_state_priority_created_at", [ "state", "priority", "createdAt" ])
export class Task implements PushDepTask {
    @PrimaryGeneratedColumn('identity', {
        generatedIdentity: 'BY DEFAULT',
        name: "id",
        type: "bigint",
        comment: "Id of the task"
    })
    id: string; // https://stackoverflow.com/questions/39168501/pg-promise-returns-integers-as-strings

    @Column({
        name: "priority",
        type: "int",
        nullable: false,
        comment: "Priority of the task"
    })
    priority: number;

    @Column({
        name: "tag",
        type: "text",
        nullable: true,
        comment: "Tag of the task"
    })
    tag: string;

    @Column({
        name: "args",
        type: "jsonb",
        nullable: true,
        comment: "Arguments of the task"
    })
    args: any;

    @Column({
        name: "results",
        type: "jsonb",
        nullable: true,
        comment: "Results of the task"
    })
    results: any;

    @Column({
        name: "state",
        type: "int",
        nullable: false,
        comment: "State of the execution"
    })
    state: number;

    @Column({
        name: "started_at",
        type: "timestamp with time zone",
        nullable: true,
        comment: "Timestamp that tracks when the task started to become active"
    })
    startedAt: Date;

    @Column({
        name: "completed_at",
        type: "timestamp with time zone",
        nullable: true,
        comment: "Timestamp that tracks if the task has succedeed"
    })
    completedAt: Date;

    @Column({
        name: "canceled_at",
        type: "timestamp with time zone",
        nullable: true,
        comment: "Timestamp that tracks if the task was canceled"
    })
    canceledAt: Date;

    @Column({
        name: "failed_at",
        type: "timestamp with time zone",
        nullable: true,
        comment: "Timestamp that tracks if the task has failed"
    })
    failedAt: Date;

    @CreateDateColumn({
        name: "created_at",
        type: "timestamp with time zone",
        nullable: false,
        comment: "Timestamp that tracks when the task is pushed"
    })
    createdAt: Date;
    
    @UpdateDateColumn({
        name: "updated_at",
        type: "timestamp with time zone",
        nullable: false,
        comment: "Timestamp that tracks when the task is updated"
    })
    updatedAt: Date;
    
    @DeleteDateColumn({
        name: "deleted_at",
        type: "timestamp with time zone",
        nullable: true,
        comment: "Timestamp that tracks when the task is deleted"
    })
    deletedAt: Date;
    
    @VersionColumn({
        name: "version",
        type: "int",
        nullable: false,
        default: 0,
        comment: "Version of the task - used for optimistic locking"
    })
    version: number;       

    @Column({
        name: "kind_id",
        type: "text",
        nullable: false,
        comment: "The task's kind"
    })
    kindId: string;
    
    @ManyToOne(() => Kind, kind => kind.tasks, {
        nullable: false
    })
    @JoinColumn({ name: "kind_id" })
    kind: Kind;    

    /*
    @ManyToMany(() => TaskDependency, { nullable: true })
    @JoinTable({
        name: "task_dependency",
        joinColumn: {
            name: "task_id",
            referencedColumnName: "id"
        }
    })
    dependencies: Task[];

    @ManyToMany(() => TaskDependency, { nullable: true })
    @JoinTable({
        name: "task_dependency",
        joinColumn: {
            name: "dependency_id",
            referencedColumnName: "id"
        }
    })
    dependents: Task[];
    */

    @ManyToMany(() => Task, task => task.dependents, { nullable: true })
    @JoinTable({
        name: PSHDP_TASK_DEPENDENCY_TABLE,
        joinColumn: {
            name: "task_id",
            referencedColumnName: "id"
        },
        inverseJoinColumn: {
            name: "dependency_id",
            referencedColumnName: "id"
        }
    })
    dependencies: Task[];

    @ManyToMany(() => Task, task => task.dependencies, { nullable: true })
    dependents: Task[];

    @OneToMany(() => KindActivityLock, lock => lock.task, { nullable: false })
    kindActivityLocks: KindActivityLock[];
}
