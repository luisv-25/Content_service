import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

// Mismo JWT_SECRET que User Service usa para firmar el access token
// (sección 11.2 del documento): permite que cada microservicio valide el
// token sin tener que llamar de vuelta a User Service en cada petición.
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev_secret_change_me",
    }),
  ],
  exports: [JwtModule],
})
export class JwtConfigModule {}
