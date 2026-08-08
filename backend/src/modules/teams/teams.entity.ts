import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'teams' })
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ name: 'lead_id', type: 'uuid', nullable: true })
  leadId!: string | null;
}
