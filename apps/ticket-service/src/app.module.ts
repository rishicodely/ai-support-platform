import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { RabbitMQService } from './messaging/rabbitmq.service';
import { PrismaService } from './prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [RabbitMQService, PrismaService],
})
export class AppModule {}
