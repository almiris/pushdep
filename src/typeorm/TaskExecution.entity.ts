import { PushDepTaskExecution } from "src/core/PushDep"
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, VersionColumn, ManyToOne, JoinColumn } from "typeorm"
import { Task } from "./Task.entity";

@Entity()
export class TaskExecution implements PushDepTaskExecution {

    @PrimaryGeneratedColumn({
        name: "id",
        type: "int"
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
    })
    startedAt: Date;

    @Column({
        name: "completed_at",
        type: "timestamp with time zone",
        nullable: true,
    })
    completedAt: Date;

    @Column({
        name: "canceled_at",
        type: "timestamp with time zone",
        nullable: true,
    })
    canceledAt: Date;

    @Column({
        name: "failed_at",
        type: "timestamp with time zone",
        nullable: true,
    })
    failedAt: Date;

    @CreateDateColumn({
        name: "created_at",
        type: "timestamp with time zone",
        nullable: false,
    })
    createdAt: Date;
    
    @UpdateDateColumn({
        name: "updated_at",
        type: "timestamp with time zone",
        nullable: false,
    })
    updatedAt: Date;
    
    @DeleteDateColumn({
        name: "deleted_at",
        type: "timestamp with time zone",
        nullable: true
    })
    deletedAt: Date;
    
    @VersionColumn({
        name: "version",
        type: "int",
        nullable: false
    })
    version: number;     

    @Column({
        name: "task_id",
        nullable: false
    })
    taskId: string;
    
    @ManyToOne(() => Task, task => task.taskExecutions, {
        nullable: true
    })
    @JoinColumn({ name: "task_id" })
    task: Task;    
}
/*
    task: PushDepTask;
    state?: PushDepExecutionState;
    createdAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    canceledAt?: Date;
    failedAt?: Date;
*/
