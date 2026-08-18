import { randomUUID } from 'node:crypto'

import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm'

export enum EmailTrackingEventType {
  ATTACHMENT_VIEWED = 'attachment_viewed',
  BOUNCE_PERMANENT = 'bounce_permanent',
  BOUNCE_TRANSIENT = 'bounce_transient',
  BOUNCE_UNDETERMINED = 'bounce_undetermined',
  CLICK = 'click',
  COMPLAINT = 'complaint',
  DELIVERED = 'delivered',
  DELIVERY_DELAYED = 'delivery_delayed',
  OPEN = 'open',
  REJECT = 'reject'
}

export enum EmailTrackingEventSource {
  NDR_HEURISTIC = 'ndr_heuristic',
  TRACKING = 'tracking',
  TRANSPORT_WEBHOOK = 'transport_webhook'
}

@Entity({ name: 'email_tracking_events' })
export class EmailTrackingEventEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Index()
  @Column({ type: 'text', unique: true })
  dedupe_key!: string

  @Index()
  @Column({ type: 'uuid' })
  email_id!: string

  @Column({ type: 'uuid', nullable: true })
  email_recipient_id!: string | null

  @Column({ type: 'enum', enum: EmailTrackingEventType })
  event_type!: EmailTrackingEventType

  @Column({ type: 'text', nullable: true })
  ip_address!: string | null

  @Column({ type: 'uuid', nullable: true })
  link_id!: string | null

  @Column({ type: 'text', nullable: true })
  link_name!: string | null

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null

  @Index()
  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  occurred_at!: Date

  @Index()
  @Column({ type: 'uuid', nullable: true })
  org_id!: string | null

  @Column({ type: 'text', nullable: true })
  provider!: string | null

  @Index()
  @Column({ type: 'text', nullable: true })
  recipient_email!: string | null

  @Column({ type: 'text', nullable: true })
  source!: string | null

  @Column({ type: 'text', nullable: true })
  target_url!: string | null

  @Column({ type: 'text', nullable: true })
  tracking_scope!: string | null

  @Column({ type: 'text', nullable: true })
  user_agent!: string | null

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
