import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAPP, ICORS, IENV } from './common/config/env.interface';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const { name, apiPrefix, apiVersion, port } = app
    .get(ConfigService<IENV>)
    .getOrThrow<IAPP>('app');

  // setup CORS
  const { origin, credentials } = app
    .get(ConfigService<IENV>)
    .getOrThrow<ICORS>('cors');

  app.enableCors({
    origin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials,
  });

  // setup Swagger
  const config = new DocumentBuilder()
    .setTitle(`${name} API`)
    .setVersion(apiVersion)
    .addServer(`/${apiPrefix}/${apiVersion}`)
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix}/${apiVersion}`, app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.setGlobalPrefix(`${apiPrefix}/${apiVersion}`);

  await app.listen(port);
}
void bootstrap();
