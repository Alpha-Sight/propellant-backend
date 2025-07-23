import { UserRoleEnum } from '../enums/user.enum';

export interface LoggedInUser {
  _id: string;
  email: string;
  role: UserRoleEnum;
}
