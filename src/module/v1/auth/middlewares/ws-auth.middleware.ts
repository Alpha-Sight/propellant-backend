import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { UserDocument } from '../../user/schemas/user.schema';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../../user/services/user.service';

export interface AuthenticatedSocket extends Socket {
  user: UserDocument;
}

export const WsAuthMiddleware = (
  jwtService: JwtService,
  userService: UserService,
) => {
  return async (socket: Socket, next) => {
    try {
      let token =
        socket.handshake?.auth?.token ||
        socket.handshake?.headers?.authorization;

      token = token?.split(' ')[1];

      if (!token) {
        throw new UnauthorizedException('Authorization token is missing');
      }

      let payload = null;

      try {
        payload = await jwtService.verifyAsync(token);
      } catch (error) {
        throw new UnauthorizedException('Authorization token is invalid');
      }

      const user = await userService.findOneById(payload._id);

      if (!user) {
        throw new NotFoundException('User does not exist');
      }

      socket = Object.assign(socket, {
        user: user,
      });
      next();
    } catch (error) {
      next(new UnauthorizedException('Unauthorized'));
    }
  };
};
