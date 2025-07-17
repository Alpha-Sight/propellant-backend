import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { SkillLevelEnum } from 'src/common/enums/cv.enum';

export type CVDocument = CV & Document;

@Schema()
export class Experience {
  @Prop({ required: true })
  company: string;

  @Prop({ required: true })
  position: string;

  @Prop({ required: true })
  startDate: string;

  @Prop()
  endDate?: string;

  @Prop()
  description?: string;

  @Prop()
  location?: string;

  @Prop()
  title: string;

  @Prop({ default: false })
  isCurrentRole?: boolean;
}

@Schema()
export class Education {
  @Prop({ required: true })
  institution: string;

  @Prop({ required: true })
  degree: string;

  @Prop({ required: true })
  fieldOfStudy: string;

  @Prop({ required: true })
  startDate: string;

  @Prop()
  endDate?: string;

  @Prop()
  grade?: string;

  @Prop()
  description?: string;
}

@Schema()
export class Skill {
  @Prop({ required: true })
  name: string;

  @Prop({ enum: SkillLevelEnum })
  level?: SkillLevelEnum;

  @Prop()
  category?: string;
}

@Schema()
export class Certification {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  issuer: string;

  @Prop({ required: true })
  dateIssued: string;

  @Prop()
  expiryDate?: string;

  @Prop()
  credentialId?: string;

  @Prop()
  credentialUrl?: string;
}

@Schema()
export class Project {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop()
  startDate?: string;

  @Prop()
  endDate?: string;

  @Prop([String])
  technologies?: string[];

  @Prop()
  project?: string;

  @Prop()
  github?: string;
}

@Schema()
export class Socials {
  @Prop({ default: '' })
  twitter?: string;

  @Prop({ default: '' })
  linkedin?: string;

  @Prop({ default: '' })
  facebook?: string;

  @Prop({ default: '' })
  instagram?: string;
}

@Schema({ timestamps: true })
export class CV {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
  })
  user: UserDocument;

  @Prop({ sparse: true })
  email?: string;

  @Prop({ required: false, default: null, trim: true, index: true })
  firstName: string;

  @Prop({ required: false, default: null, index: true })
  lastName: string;

  @Prop({ required: false })
  phone: string;

  @Prop()
  professionalTitle?: string;

  @Prop()
  professionalSummary?: string;

  @Prop()
  address?: string;

  // @Prop()
  // github?: string;

  // @Prop()
  // portfolio?: string;

  // @Prop()
  // website?: string;

  @Prop([Experience])
  workExperience?: Experience[];

  @Prop([Education])
  education?: Education[];

  @Prop([Skill])
  skills?: Skill[];

  @Prop([Certification])
  certifications?: Certification[];

  @Prop([Project])
  projects?: Project[];

  // @Prop([String])
  // languages?: string[];

  // @Prop([String])
  // hobbies?: string[];

  // @Prop([String])
  // achievements?: string[];

  // @Prop([Socials])
  // socials?: Socials[];

  // @Prop([String])
  // references?: string[];

  @Prop({ default: false })
  isDeleted: boolean;
}

export const CVSchema = SchemaFactory.createForClass(CV);

CVSchema.pre(/^find/, function (next) {
  const preConditions = {
    isDeleted: false,
  };

  const postConditions = this['_conditions'];

  this['_conditions'] = { ...preConditions, ...postConditions };

  next();
});
