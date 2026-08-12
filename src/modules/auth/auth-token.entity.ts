import { randomUUID } from 'node:crypto'

import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm'

@Entity({ name: 'auth_token' })
@Index(['access_token', 'contact_id'], { unique: true })
@Index(['access_token', 'user_id'], { unique: true })
export class AuthTokenEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string

  @Column({ type: 'varchar' })
  access_token: string

  @Index()
  @Column({ type: 'varchar', nullable: true })
  refresh_token: string | null

  @Column({ type: 'varchar', nullable: true })
  contact_id: string | null

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
