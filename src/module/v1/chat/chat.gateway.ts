// import { Inject, Logger, forwardRef } from '@nestjs/common';
// import { ChatService } from './services/chat.service';
// import { JwtService } from '@nestjs/jwt';
// import { ActiveUserService } from './services/chat-active-user.service';
// import { UserService } from '../user/services/user.service';
// import { Server, Socket } from 'socket.io';
// import {
//   AuthenticatedSocket,
//   WsAuthMiddleware,
// } from '../auth/middlewares/ws-auth.middleware';
// import {
//   OnGatewayConnection,
//   OnGatewayDisconnect,
//   OnGatewayInit,
//   SubscribeMessage,
//   WebSocketGateway,
//   WebSocketServer,
// } from '@nestjs/websockets';

// @WebSocketGateway({ namespace: 'chat' })
// export class ChatGateway
//   implements OnGatewayInit, OnGatewayDisconnect, OnGatewayConnection
// {
//   @WebSocketServer() server: Server;
//   private logger: Logger = new Logger('ChatGateway');

//   constructor(
//     @Inject(forwardRef(() => ChatService))
//     private readonly chatService: ChatService,
//     private jwtService: JwtService,
//     private userService: UserService,
//     private activeUserService: ActiveUserService,
//   ) {}

//   afterInit(socket: Socket) {
//     console.log('chat gateway initialized');
//     this.logger.log('chat gateway initialized');

//     socket.use(WsAuthMiddleware(this.jwtService, this.userService) as any);
//   }

//   handleConnection(client: any, ...args: any[]) {
//     console.log(`Client connected: ${client.id}`, args);
//     this.logger.log(`Client connected: ${client.id}`, args);
//   }

//   handleDisconnect(client: any) {
//     this.logger.log(`Client disconnected: ${client.id}`);
//   }

//   @SubscribeMessage('user-connect')
//   async handleRegister(client: AuthenticatedSocket, userId: string) {
//     const user = await this.userService.findOneById(userId);
//     if (!user) return;

//     await this.updateActiveUserStatus({
//       userId,
//       socketId: client.user._id.toString(),
//       isActive: true,
//     });
//     this.logger.log(
//       `User registered: ${userId} with socket id: ${client.user._id.toString()}`,
//     );
//     this.server.emit('user-is-online', { userId });
//   }
//   @SubscribeMessage('user-disconnect')
//   async handleUnregister(client: AuthenticatedSocket, userId: string) {
//     await this.activeUserService.removeActiveUser(userId);
//     this.logger.log(`User unregistered: ${userId}`);
//     this.server.emit('user-is-offline', client?.user);
//   }

//   @SubscribeMessage('typing')
//   async handleUserTyping(
//     client: AuthenticatedSocket,
//     {
//       isTyping,
//       chatId,
//     }: {
//       isTyping: boolean;
//       chatId: string;
//     },
//   ) {
//     console.log('new typing event', { isTyping, chatId });
//     const chat = await this.chatService.findOneQuery({ _id: chatId });

//     if (!chat) return;

//     const otherChatUser = chat.participants.find(
//       (participant) =>
//         participant._id.toString() !== client?.user._id.toString(),
//     );

//     console.log('otherChatUser', otherChatUser);

//     if (!otherChatUser) return;

//     const otherUserSocketData = await this.getUserSocketDataById(
//       otherChatUser?._id.toString(),
//     );

//     console.log('otherUserSocketData', otherUserSocketData);

//     if (!otherUserSocketData) return;

//     const typingPayload = {
//       user: client?.user,
//       isTyping,
//       chatId,
//       ...(isTyping
//         ? {
//             message: `${
//               client?.user?.username ?? client?.user?.firstName
//             } is typing`,
//           }
//         : {}),
//     };

//     this.server.emit('typing', typingPayload); // TODO: REMOVE THIS WHEN DONE TESTING
//     this.server.to(otherUserSocketData?.socketId).emit('typing', typingPayload);
//   }

//   async updateActiveUserStatus({
//     userId,
//     socketId,
//     isActive,
//   }: {
//     userId: string;
//     socketId: string;
//     isActive: boolean;
//   }) {
//     try {
//       console.log('saved in cache', userId);
//       return await this.activeUserService.updateActiveUser(
//         userId,
//         socketId,
//         isActive,
//       );
//     } catch (error) {
//       this.logger.error('Error updating active user status', error);
//       return null;
//     }
//   }

//   async getUserBySocketId(socketId: string) {
//     try {
//       return await this.activeUserService.getActiveUser(socketId);
//     } catch (error) {
//       this.logger.error(`Error fetching user by socket id`, error);
//       return null;
//     }
//   }

//   async getUserSocketDataById(userId: string) {
//     try {
//       return await this.activeUserService.getActiveUser(userId);
//     } catch (error) {
//       this.logger.error(`Error fetching user by user id`, error);
//       return null;
//     }
//   }

//   async broadcastEvent(recipientId: string, event: string, data: any) {
//     console.log('broadcastEvent', { recipientId, event, data });
//     const recipientSocketData = await this.getUserSocketDataById(recipientId);

//     console.log('recipientSocketData', recipientSocketData);

//     if (!recipientSocketData) return;

//     this.server.emit(event, data); // TODO: remove this when done testing
//     this.server.to(recipientSocketData?.socketId).emit(event, data);
//   }
// }
