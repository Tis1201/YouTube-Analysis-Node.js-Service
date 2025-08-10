import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnalysisModule } from './analysis/analysis.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';



@Module({
  imports: [
    // Thêm ConfigModule để load file .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    AnalysisModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/static',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}