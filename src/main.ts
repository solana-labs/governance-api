import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import AltairFastify from 'altair-fastify-plugin';
import { processRequest } from 'graphql-upload';

import { AppModule } from '@src/app.module';
import { ConfigService } from '@src/config/config.service';

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter();
  const fastifyInstance = fastifyAdapter.getInstance();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyAdapter);
  const configService = app.get(ConfigService);

  app.register(AltairFastify, {
    baseURL: '/playground/',
    initialName: 'Governance API',
    path: '/playground/',
  });

  fastifyInstance.addContentTypeParser('multipart', (request, done) => {
    request.isMultipart = true;
    done();
  });

  fastifyInstance.addHook('preValidation', async function (request: any, reply) {
    if (!request.raw.isMultipart) {
      return;
    }

    request.body = await processRequest(request.raw, reply.raw);
  });

  const port = configService.get('app.port');
  await app.listen(port);
}
bootstrap();
