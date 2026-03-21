import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // 1. Setup the connection pool using the pg library
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // 2. Wrap it in the Prisma adapter
    const adapter = new PrismaPg(pool as any);

    // 3. Pass the adapter to the parent PrismaClient
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Prisma 7 connected via Driver Adapter');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
