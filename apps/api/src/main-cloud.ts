import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { resolve } from "node:path";
import { CloudAppModule } from "./cloud-app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(CloudAppModule);
  app.enableShutdownHooks();
  const webOrigin = process.env.CLUB_WEB_ORIGIN ?? "http://localhost:5173";
  app.use(
    (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => {
      if (
        req.path.startsWith("/api/") &&
        !req.path.startsWith("/api/v1/integration/") &&
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        req.headers.origin &&
        req.headers.origin !== webOrigin
      ) {
        res.status(403).json({ message: "Origen no permitido." });
        return;
      }
      next();
    },
  );
  if (process.env.CLUB_WEB_DIST_DIR) {
    const directory = resolve(process.env.CLUB_WEB_DIST_DIR);
    app.useStaticAssets(directory);
    app.use(
      (
        req: import("express").Request,
        res: import("express").Response,
        next: import("express").NextFunction,
      ) => {
        if (req.method === "GET" && req.path.startsWith("/club"))
          res.sendFile(resolve(directory, "index.html"));
        else next();
      },
    );
  }
  app.setGlobalPrefix("api/v1");
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });
  await app.listen(process.env.CLOUD_PORT ?? 3200);
}

void bootstrap();
