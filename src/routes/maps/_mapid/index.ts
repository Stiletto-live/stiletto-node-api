import { MapInfo, MapSchema } from '@customtypes/maps';
import { EditMapRequest, GetMapRequest } from '@customtypes/requests/maps';
import { Type } from '@sinclair/typebox';
import { FastifyPluginAsync } from 'fastify';

const routes: FastifyPluginAsync = async (server) => {
  server.get<GetMapRequest, { Reply: MapInfo }>(
    '/',
    {
      schema: {
        description: 'Returns map information',
        summary: 'getMap',
        operationId: 'getMap',
        tags: ['maps'],
        params: {
          type: 'object',
          properties: {
            mapid: { type: 'integer' },
          },
        },
        querystring: {
          type: 'object',
          required: ['mappass'],
          properties: {
            mappass: {
              type: 'string',
              description: 'Pass for the map',
            },
          },
        },
        response: {
          200: MapSchema,
        },
      },
    },
    (request, reply) => {
      if (!request.params.mapid || !request.query.mappass) {
        return reply.code(400).send();
      }

      server.mysql.query(
        'select mapid, typemap, discordID as discordid, name, dateofburning, pass, allowedit from clanmaps where mapid=? and pass=?',
        [request.params.mapid, request.query.mappass],
        (err, result) => {
          if (result && result[0]) {
            return reply.code(200).send(result[0] as MapInfo);
          } else if (err) {
            return reply.code(503).send();
          } else {
            return reply.code(404).send();
          }
        },
      );
    },
  );
  server.put<EditMapRequest>(
    '/',
    {
      onRequest: [server.authenticate],
      schema: {
        description: 'Edit map data',
        summary: 'editMap',
        operationId: 'editMap',
        tags: ['maps'],
        params: {
          type: 'object',
          properties: {
            mapid: { type: 'integer' },
          },
        },
        querystring: {
          type: 'object',
          required: ['mappass', 'mapname'],
          properties: {
            mappass: {
              type: 'string',
              description: 'Password to view the map without login',
            },
            mapname: {
              type: 'string',
              description: 'Map name',
            },
            mapdate: {
              type: 'string',
              description: 'Date of the day the map was burned. aaaa-mm-dd',
            },
            allowediting: {
              type: 'boolean',
              description: 'Shows whether the map can be edited with the password or not',
            },
          },
        },
        security: [
          {
            token: [],
          },
        ],
        response: {
          202: Type.Object({
            message: Type.String(),
          }),
        },
      },
    },
    (request, reply) => {
      if (!request?.dbuser) {
        reply.code(401);
        return new Error('Invalid token JWT');
      }

      const mapName: string = request.query?.mapname ?? 'Default Name';
      const mapDate: string = request.query?.mapdate ?? new Date().toISOString().split('T')[0];
      const mapPass: string = request.query?.mappass;
      const allowEditing: boolean = request.query?.allowediting ?? false;

      if (!mapPass) {
        return reply.code(400).send();
      }

      server.mysql.query(
        'update clanmaps set name=?, dateofburning=?, allowedit=?, pass=? where mapid=? and discordID=?',
        [mapName, mapDate, allowEditing, mapPass, request.params.mapid, request.dbuser.discordid],
        (err, result) => {
          if (result) {
            return reply.code(202).send({
              message: 'Map edited',
            });
          } else if (err) {
            return reply.code(503).send();
          }
        },
      );
    },
  );
};

export default routes;