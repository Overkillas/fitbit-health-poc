import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('sync_history')
export class SyncHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_sync_user_id')
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'timestamp' })
  syncTime: Date;

  @Column({ nullable: true })
  deviceId: string;

  @Column({ nullable: true })
  deviceName: string;

  @Column({ nullable: true })
  deviceType: string;

  @Column({ nullable: true })
  battery: string;

  @Column({ nullable: true })
  batteryLevel: number;

  @CreateDateColumn()
  createdAt: Date;
}
