import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Kind } from "./Kind.entity";
import { Task } from "./Task.entity";

@Entity({
    name: "kind_activity_lock",
})
@Index("idx_kind_activity_lock_kind_id", [ "kindId" ])
export class KindActivityLock {
    @PrimaryGeneratedColumn('identity', {
        generatedIdentity: 'BY DEFAULT',
        name: "id",
        type: "int",
        comment: "Id of the lock"
    })
    id: number;

    @Column({
        name: "locked_at",
        type: "timestamp with time zone",
        nullable: true,
        comment: "Last time this lock has been acquired"
    })
    lockedAt: Date;

    @Column({
        name: "kind_id",
        type: "text",
        nullable: false,
        comment: "The lock's kind"
    })
    kindId: string;
    
    @ManyToOne(() => Kind, kind => kind.tasks, {
        nullable: false
    })
    @JoinColumn({ name: "kind_id" })
    kind: Kind;    

    @Column({
        name: "task_id",
        type: "bigint",
        nullable: true,
        comment: "The task that has acquired the lock"
    })
    taskId: string;

    @ManyToOne(() => Task, task => task.kindActivityLocks, {
        nullable: false
    })
    @JoinColumn({ name: "task_id" })
    task: Task;
}
