import { randomUUID } from 'node:crypto'

import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm'

export enum EmailRecipientType {
  CC = 'cc',
  BCC = 'bcc',
  FROM = 'from',
  TO = 'to'
}

export enum EmailRecipientSendStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed'
}

@Entity({ name: 'email_recipient' })
export class EmailRecipientEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  email_id!: string

  @Index()
  @Column({ type: 'text' })
  email!: string

  @Column({ type: 'uuid', nullable: true })
  org_user_id!: string | null

  @Column({ type: 'uuid', nullable: true })
  contact_person_id!: string | null

  @Column({ type: 'uuid', nullable: true })
  contact_org_id!: string | null

  @Column({ type: 'enum', enum: EmailRecipientType })
  type!: EmailRecipientType

  @Index()
  @Column({ type: 'text', nullable: true })
  provider_message_id!: string | null

  @Index()
  @Column({ type: 'text', nullable: true })
  provider_thread_id!: string | null

  @Column({ type: 'enum', enum: EmailRecipientSendStatus, default: EmailRecipientSendStatus.PENDING })
  send_status!: EmailRecipientSendStatus

  @Column({ type: 'timestamptz', nullable: true })
  sent_at!: Date | null

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
