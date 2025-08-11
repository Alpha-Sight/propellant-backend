import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ROLES_KEY } from '../../../../common/decorators/role.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const user = request?.user;
    // Debug log: print user and roles
    // eslint-disable-next-line no-console
    console.log('[RoleGuard] user:', user, 'roles required:', roles);
    if (user && roles.includes(user.role)) {
      return true;
    }
    // Custom forbidden message for organization endpoints
    if (roles.includes('ORGANIZATION') || roles.includes('ORG_ADMIN')) {
      throw new (require('@nestjs/common').ForbiddenException)(
        'This is an organization endpoint'
      );
    }
    // Default admin-only message
    throw new (require('@nestjs/common').ForbiddenException)(
      'Only an admin can access this resource'
    );
  }
}
