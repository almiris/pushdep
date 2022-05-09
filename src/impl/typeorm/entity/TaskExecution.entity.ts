import { PushDepTaskExecution } from "../../../core/PushDep"
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, VersionColumn, ManyToOne, JoinColumn } from "typeorm"
import { Task } from "./Task.entity";

/**
 * A task execution. As of now, there is only one TaskExecution per Task so both entities
 * could be merged; having both entities leaves room for a future evolution where we
 * would be able to manage multiple execution of the same task, looping tasks...
 */
@Entity({
    name: "task_execution"
})
export class TaskExecution implements PushDepTaskExecution {
    @PrimaryGeneratedColumn({
        name: "id",
        type: "int",
        comment: "Id of the task execution"
    })
    id: number;

    @Column({
        name: "state",
        type: "int",
        nullable: false,
        comment: "State of this execution"
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
        comment: "Timestamp that tracks when the task execution is created"
    })
    createdAt: Date;
    
    @UpdateDateColumn({
        name: "updated_at",
        type: "timestamp with time zone",
        nullable: false,
        comment: "Timestamp that tracks when the task execution is updated"
    })
    updatedAt: Date;
    
    @DeleteDateColumn({
        name: "deleted_at",
        type: "timestamp with time zone",
        nullable: true,
        comment: "Timestamp that tracks when the task execution is deleted"
    })
    deletedAt: Date;
    
    @VersionColumn({
        name: "version",
        type: "int",
        nullable: false,
        default: 0,
        comment: "Version of the task execution - used for optimistic locking"
    })
    version: number;     

    @Column({
        name: "task_id",
        nullable: false,
        comment: "The task execution's task"
    })
    taskId: string;
    
    @ManyToOne(() => Task, task => task.taskExecutions, {
        nullable: false
    })
    @JoinColumn({ name: "task_id" })
    task: Task;    
}
