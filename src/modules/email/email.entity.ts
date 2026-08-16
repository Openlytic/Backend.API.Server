import { randomUUID } from 'node:crypto'

import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm'

export enum EmailStage {
  DRAFT = 'draft',
  INBOX = 'inbox',
  SENT = 'sent'
}

@Entity({ name: 'email' })
export class EmailEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Index()
  @Column({ type: 'text', nullable: true })
  message_id!: string | null

  @Index()
  @Column({ type: 'text', nullable: true })
  thread_id!: string | null

  @Index()
  @Column({ type: 'text', nullable: true })
  provider_thread_id!: string | null

  @Column({ type: 'boolean', default: false })
  is_parent!: boolean

  @Column({ type: 'text', nullable: true })
  subject!: string | null

  @Column({ type: 'text', nullable: true })
  snippet!: string | null

  @Column({ type: 'text', nullable: true })
  body_html!: string | null

  @Column({ type: 'boolean', default: false })
  is_read!: boolean

  @Column({ type: 'timestamptz', nullable: true })
  sent_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  queued_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  received_at!: Date | null

  @Column({ type: 'enum', enum: EmailStage, default: EmailStage.DRAFT })
  stage!: EmailStage

  @Column({ type: 'timestamptz', nullable: true })
  trashed_at!: Date | null

  @Column({ type: 'boolean', default: false })
  is_trashed!: boolean

  @Index()
  @Column({ type: 'uuid', nullable: true })
  org_id!: string | null

  @Index()
  @Column({ type: 'uuid', nullable: true })
  org_user_id!: string | null

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
