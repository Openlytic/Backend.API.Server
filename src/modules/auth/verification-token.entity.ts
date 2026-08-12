import { randomUUID } from 'node:crypto'

import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm'

@Entity({ name: 'verification_token' })
@Index(['email', 'token', 'user_id'])
export class VerificationTokenEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ type: 'varchar', nullable: true })
  email: string | null

  @Column({ type: 'varchar' })
  token: string

  @Column({ type: 'varchar' })
  type: string

  @Column({ type: 'varchar', default: 'unverified' })
  status: string

  @Column({ type: 'timestamptz', default: () => "NOW() + INTERVAL '5 minutes'" })
  expired_at: Date

  @Column({ type: 'varchar', nullable: true })
  user_id: string | null

  @Index()
  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date

  @Index()
  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  updated_at: Date

  @BeforeInsert()
  generateId() {
    this.id = randomUUID()
  }
}
