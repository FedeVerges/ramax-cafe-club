import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173", credentials: true });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));

  if (process.env.NODE_ENV !== "production") {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("Ramax Café Club API").setVersion("1.0").build(),
    );
    SwaggerModule.setup("docs", app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
