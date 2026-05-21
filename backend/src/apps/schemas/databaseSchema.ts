import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DatabaseDocument = HydratedDocument<Database>;

@Schema({ timestamps: true })
export class Database {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, select: false })
  apiTokenCurrent: string;

  @Prop({ default: null, select: false })
  apiTokenPrevious?: string | null;

  @Prop({ default: null, select: false })
  tokenRotatedAt?: Date | null;

  // Backward compatibility for pre-rolling-token documents.
  @Prop({ select: false })
  apiToken?: string;

  @Prop()
  description: string;
}

export const DatabaseSchema = SchemaFactory.createForClass(Database);

