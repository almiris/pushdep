import { PushDepKind } from "src/core/PushDep";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, VersionColumn, PrimaryColumn } from "typeorm"

@Entity("kind")
export class Kind implements PushDepKind {

    @PrimaryColumn({
        name: "name",
        type: "text",
        comment: "Name of this kind"
    })
    name: string

    @Column({
        name: "concurrency",
        type: "int",
        nullable: false,
        comment: "Max concurrency for this kind - Multiple workers will only be able to execute this number of tasks concurrently"
    })
    concurrency: number

    @CreateDateColumn({
        name: "created_at",
        type: 'timestamp with time zone',
        nullable: false,
      })
      createdAt: Date;
    
      @UpdateDateColumn({
        name: "updated_at",
        type: 'timestamp with time zone',
        nullable: false,
      })
      updatedAt: Date;
    
      @DeleteDateColumn({
        name: "deleted_at",
        type: 'timestamp with time zone',
        nullable: true
      })
      deletedAt: Date;
    
      @VersionColumn({
        name: "version",
        nullable: false
      })
      version: number;    
}
