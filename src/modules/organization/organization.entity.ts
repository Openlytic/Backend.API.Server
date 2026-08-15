import { randomUUID } from 'node:crypto'

import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm'

export enum OrganizationStatus {
  ACTIVE = 'active',
  DELETING = 'deleting',
  INACTIVE = 'inactive',
  RESETTING = 'resetting'
}

@Entity({ name: 'organization' })
export class OrganizationEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ type: 'text' })
  name!: string

  @Index({ unique: true })
  @Column({ type: 'text' })
  sub_domain!: string

  @Index()
  @Column({ type: 'enum', enum: OrganizationStatus, default: OrganizationStatus.ACTIVE })
  status!: OrganizationStatus

  @Column({ type: 'boolean', default: false })
  is_admin_access_disabled!: boolean

  @Index()
  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null

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
