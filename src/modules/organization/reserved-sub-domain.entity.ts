import { randomUUID } from 'node:crypto'

import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm'

@Entity({ name: 'reserved_sub_domain' })
export class ReservedSubDomainEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Index()
  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  sub_domain!: string

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at!: Date

  @BeforeInsert()
  generateId() {
    this.id = randomUUID()
  }
}
