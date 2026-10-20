import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

// Content Service es prácticamente independiente del resto (sección 5.7
// del documento): no publica ni consume eventos de RabbitMQ, solo expone
// REST y hace llamadas SÍNCRONAS salientes hacia Session/Booking/Catalog
// para resolver quién puede ver cada archivo.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api/v1");

  const port = process.env.PORT || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[content-service] listening on port ${port}`);
}
bootstrap();
