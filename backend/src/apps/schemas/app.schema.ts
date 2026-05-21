import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AppDocument = HydratedDocument<App>;

@Schema({ timestamps: true })
export class App {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  apiToken: string;

  @Prop()
  description: string;
}

export const AppSchema = SchemaFactory.createForClass(App);

