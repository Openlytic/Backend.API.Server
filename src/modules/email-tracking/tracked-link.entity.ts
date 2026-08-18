import { randomUUID } from 'node:crypto'

import { BeforeInsert, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm'

export enum TrackedLinkKind {
  ATTACHMENT = 'attachment',
  CLICK = 'click'
}

@Entity({ name: 'tracked_link' })
@Unique('uq_tracked_link_email_url', ['email_id', 'target_url'])
export class TrackedLinkEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  email_id!: string

  @Column({ type: 'enum', enum: TrackedLinkKind })
  kind!: TrackedLinkKind

  @Column({ type: 'text', nullable: true })
  label!: string | null

  @Index()
  @Column({ type: 'uuid', nullable: true })
  org_id!: string | null

  @Column({ type: 'integer', default: 0 })
  sort!: number

  @Column({ type: 'text' })
  target_url!: string

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
