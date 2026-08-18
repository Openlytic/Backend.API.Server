import { randomUUID } from 'node:crypto'

import { BeforeInsert, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm'

export enum EmailAnalyticStatus {
  BOUNCED = 'bounced',
  CLICKED = 'clicked',
  COMPLAINED = 'complained',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  OPENED = 'opened',
  PENDING = 'pending',
  REJECTED = 'rejected',
  SENT = 'sent'
}

@Entity({ name: 'email_analytic' })
@Unique('uq_email_analytic_email', ['email_id'])
export class EmailAnalyticEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ type: 'integer', default: 0 })
  attachment_view_count!: number

  @Column({ type: 'timestamptz', nullable: true })
  bounced_at!: Date | null

  @Column({ type: 'integer', default: 0 })
  click_count!: number

  @Column({ type: 'timestamptz', nullable: true })
  clicked_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  complained_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  delivered_at!: Date | null

  @Index()
  @Column({ type: 'uuid' })
  email_id!: string

  @Column({ type: 'uuid', nullable: true })
  email_recipient_id!: string | null

  @Column({ type: 'timestamptz', nullable: true })
  first_click_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  first_open_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  last_open_at!: Date | null

  @Column({ type: 'integer', default: 0 })
  open_count!: number

  @Index()
  @Column({ type: 'uuid', nullable: true })
  org_id!: string | null

  @Column({ type: 'timestamptz', nullable: true })
  rejected_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  sent_at!: Date | null

  @Column({ type: 'enum', enum: EmailAnalyticStatus, default: EmailAnalyticStatus.PENDING })
  status!: EmailAnalyticStatus

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
