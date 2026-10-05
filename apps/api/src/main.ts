import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inMaintenance } from "./modules/backups/backup-files";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const tls =
    process.env.TLS_CERT_FILE && process.env.TLS_KEY_FILE
      ? {
          cert: readFileSync(process.env.TLS_CERT_FILE),
          key: readFileSync(process.env.TLS_KEY_FILE),
        }
      : undefined;
  if (process.env.NODE_ENV === "production" && !tls)
    throw new Error(
      "Configurá TLS_CERT_FILE y TLS_KEY_FILE para servir HTTPS local.",
    );
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    httpsOptions: tls,
  });
  app.enableShutdownHooks();
  app.use(
    (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => {
      if (
        req.path.startsWith("/api/") &&
        !["GET", "HEAD", "OPTIONS"].includes(req.method)
      ) {
        if (inMaintenance()) {
          res
            .status(503)
            .json({
              message: "Restauración en curso. Las escrituras están pausadas.",
            });
          return;
        }
        if (
          req.headers.origin &&
          req.headers.origin !==
            (process.env.WEB_ORIGIN ?? "http://localhost:5173")
        ) {
          res.status(403).json({ message: "Origen no permitido." });
          return;
        }
      }
      next();
    },
  );
  if (process.env.WEB_DIST_DIR) {
    const directory = resolve(process.env.WEB_DIST_DIR);
    app.useStaticAssets(directory);
    app.use(
      (
        req: import("express").Request,
        res: import("express").Response,
        next: import("express").NextFunction,
      ) => {
        if (req.method === "GET" && !req.path.startsWith("/api/"))
          res.sendFile(resolve(directory, "index.html"));
        else next();
      },
    );
  }
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (process.env.NODE_ENV !== "production") {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Ramax Café Club API")
        .setVersion("1.0")
        .build(),
    );
    SwaggerModule.setup("docs", app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
