import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: process.env.JSON_BODY_LIMIT || '25mb' }));
  app.use(urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '25mb' }));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true });
  await app.listen(Number(process.env.PORT) || 3001);
}

bootstrap();
