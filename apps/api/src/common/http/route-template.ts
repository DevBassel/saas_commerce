import type { ExecutionContext } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

const METHOD_NAMES: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.ALL]: 'ALL',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
  [RequestMethod.SEARCH]: 'SEARCH',
};

export type RouteTarget = { prototype: object };
export type RouteHandler = (...args: never[]) => unknown;

export interface RouteTemplate {
  method: string;
  path: string;
  key: string;
}

export interface ControllerRouteHandler extends RouteTemplate {
  name: string;
  handler: RouteHandler;
}

const stripSlashes = (value: string): string =>
  value.replace(/^\/+/, '').replace(/\/+$/, '');

const firstPath = (value: string | string[] | undefined): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw : '';
};

export const joinRoutePath = (...parts: Array<string | undefined>): string => {
  const joined = parts
    .map((part) => stripSlashes(part ?? ''))
    .filter((part) => part.length > 0)
    .join('/');
  return `/${joined}`;
};

export const buildRouteTemplate = (
  controller: RouteTarget,
  handler: RouteHandler,
): RouteTemplate => {
  const controllerPath = Reflect.getMetadata(PATH_METADATA, controller) as
    string | string[] | undefined;
  const handlerPath = Reflect.getMetadata(PATH_METADATA, handler) as
    string | string[] | undefined;
  const methodNumber = Reflect.getMetadata(METHOD_METADATA, handler) as
    number | undefined;
  const method = METHOD_NAMES[methodNumber ?? -1] ?? 'ALL';
  const path = joinRoutePath(firstPath(controllerPath), firstPath(handlerPath));
  return { method, path, key: `${method} ${path}` };
};

export const getRouteTemplate = (context: ExecutionContext): RouteTemplate =>
  buildRouteTemplate(
    context.getClass() as RouteTarget,
    context.getHandler() as RouteHandler,
  );

export const listControllerRoutes = (
  controller: RouteTarget,
): RouteTemplate[] =>
  listControllerRouteHandlers(controller).map(({ method, path, key }) => ({
    method,
    path,
    key,
  }));

export const listControllerRouteHandlers = (
  controller: RouteTarget,
): ControllerRouteHandler[] => {
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => {
      if (name === 'constructor') return false;
      const handler = prototype[name];
      return (
        typeof handler === 'function' &&
        Reflect.hasMetadata(METHOD_METADATA, handler)
      );
    })
    .map((name) => {
      const handler = prototype[name] as RouteHandler;
      return { name, handler, ...buildRouteTemplate(controller, handler) };
    });
};
