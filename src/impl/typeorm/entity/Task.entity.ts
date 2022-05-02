import { PushDepTask } from "src/core/PushDep";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, Generated, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryColumn, UpdateDateColumn, VersionColumn } from "typeorm";
import { Kind } from "./Kind.entity";
import { TaskExecution } from "./TaskExecution.entity";

@Entity({
    name: "task"
})
export class Task implements PushDepTask {
    @PrimaryColumn({
        name: "id",
        type: "uuid",
        comment: "Id of the task"
    })
    @Generated("uuid")
    id: string;

    @Column({
        name: "priority",
        type: "int",
        nullable: false,
        comment: "Priority of the task"
    })
    priority: number;

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

    @ManyToMany(() => Task, { nullable: true })
    @JoinTable({
        name: "task_dependency",
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

    // as of now, we have only one execution per task
    @OneToMany(() => TaskExecution, taskExecution => taskExecution.task, { nullable: false })
    taskExecutions: TaskExecution[];
}
