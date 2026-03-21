import { Module } from '@nestjs/common';
import { RabbitMQService } from 'messaging/rabbitmq.service';

@Module({
  imports: [],
  controllers: [],
  providers: [RabbitMQService],
})
export class AppModule {}
