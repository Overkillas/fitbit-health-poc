import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from 'typeorm';

export enum UserRole {
  DOCTOR = 'DOCTOR',
  PATIENT = 'PATIENT',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  phone: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Index('idx_doctor_id')
  @Column({ nullable: true })
  doctorId: number;

  @ManyToOne(() => User, (user) => user.patients, { nullable: true })
  @JoinColumn({ name: 'doctorId' })
  doctor: User;

  @OneToMany(() => User, (user) => user.doctor)
  patients: User[];

  @Column({ nullable: true, unique: true })
  fitbitUserId: string;

  @Column({ nullable: true })
  fitbitAccessToken: string;

  @Column({ nullable: true })
  fitbitRefreshToken: string;

  @Column({ type: 'timestamp', nullable: true })
  fitbitTokenExpiresAt: Date;
}
