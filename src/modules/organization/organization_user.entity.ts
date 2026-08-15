import { randomUUID } from 'node:crypto'

import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm'

export enum OrganizationUserStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  INACTIVE = 'inactive',
  INVITED = 'invited'
}

@Entity({ name: 'organization_user' })
@Index(['org_id', 'slug'], { unique: true, where: 'slug IS NOT NULL' })
export class OrganizationUserEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  org_id!: string

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string

  @Index()
  @Column({ type: 'uuid', nullable: true })
  localization_language_id!: string | null

  @Column({ type: 'timestamptz', nullable: true, default: null })
  notifications_seen_at!: Date | null

  @Index()
  @Column({ type: 'enum', enum: OrganizationUserStatus, default: OrganizationUserStatus.INVITED })
  status!: OrganizationUserStatus

  @Column({ type: 'text', nullable: true })
  slug!: string | null

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
