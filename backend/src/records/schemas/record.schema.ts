import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RecordDocument = HydratedDocument<DataRecord>;

@Schema()
export class DataRecord {
  @Prop({ required: true, index: true })
  id: string;

  @Prop({ required: true, index: true })
  appId: string;

  @Prop({ required: true, index: true })
  tableId: string;

  @Prop({ type: Object, required: true })
  json: Record<string, any>;

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ required: true })
  createdBy: string;
}

export const RecordSchema = SchemaFactory.createForClass(DataRecord);

// Record id is the primary key within an app.
RecordSchema.index({ appId: 1, id: 1 }, { unique: true });

