import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { JobTypeEnum } from 'src/common/enums/organization.enum';
import { User, UserDocument } from '../../user/schemas/user.schema';
import mongoose from 'mongoose';

export type OrganizationPostDocument = OrganizationPost & Document;

@Schema({ timestamps: true })
export class OrganizationPost {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
  })
  organization: UserDocument;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  location: string;

  @Prop({ required: true })
  salaryRange: string;

  @Prop({ enum: JobTypeEnum, required: true })
  jobType: JobTypeEnum;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], required: true })
  requiredSkills: string[];

  @Prop({ default: false })
  isDeleted: boolean;
}

export const OrganizationPostSchema =
  SchemaFactory.createForClass(OrganizationPost);

OrganizationPostSchema.pre(/^find/, function (next) {
  const preConditions = {
    isDeleted: false,
  };

  const postConditions = this['_conditions'];

  this['_conditions'] = { ...preConditions, ...postConditions };

  next();
});
