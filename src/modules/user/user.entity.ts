import { randomUUID } from 'node:crypto'

import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm'

export enum UserStatus {
  INVITED = 'invited',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  UNVERIFIED = 'unverified'
}

@Entity({ name: 'user' })
export class UserEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ type: 'varchar', unique: true })
  email!: string

  @Column({ type: 'varchar', nullable: true })
  new_email!: string | null

  @Column({ type: 'varchar', nullable: true })
  password!: string | null

  @Column({ type: 'simple-array', nullable: true })
  old_passwords!: string[]

  @Index()
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.INVITED })
  status!: UserStatus

  @Index()
  @Column({ type: 'boolean', default: false })
  has_temp_password!: boolean

  @Column({ type: 'varchar', nullable: true })
  first_name!: string | null

  @Column({ type: 'varchar', nullable: true })
  last_name!: string | null

  @Index()
  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date

  @Index()
  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at!: Date

  @BeforeInsert()
  generateId() {
    this.id = randomUUID()
  }
}
