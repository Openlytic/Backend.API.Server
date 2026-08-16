import { randomUUID } from 'node:crypto'

import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm'

export enum AppQueueStatus {
  HOLD = 'hold',
  READY = 'ready',
  SENT = 'sent',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

@Entity({ name: 'app_queue' })
export class AppQueueEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Index()
  @Column({ type: 'text', nullable: true })
  category!: string | null

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null

  @Index()
  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null

  @Column({ type: 'integer', default: 0 })
  delay_seconds!: number

  @Index()
  @Column({ type: 'text' })
  destination!: string

  @Index()
  @Column({ type: 'text' })
  event!: string

  @Index()
  @Column({ type: 'uuid', nullable: true })
  org_id!: string | null

  @Column({ type: 'jsonb' })
  params!: Record<string, unknown>

  @Column({ type: 'integer', default: 0 })
  retry_count!: number

  @Index()
  @Column({ type: 'enum', enum: AppQueueStatus, default: AppQueueStatus.READY })
  status!: AppQueueStatus

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
