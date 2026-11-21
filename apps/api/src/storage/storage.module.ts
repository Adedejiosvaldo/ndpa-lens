import { Global, Module } from "@nestjs/common";
import { ObjectStore } from "@ndpa/storage";
import { APP_CONFIG, type AppConfig } from "../config/config.js";

/** One shared ObjectStore (S3 API) for the API. */
@Global()
@Module({
  providers: [
    {
      provide: ObjectStore,
      inject: [APP_CONFIG],
      useFactory: (c: AppConfig) =>
        new ObjectStore({
          endpoint: c.S3_ENDPOINT,
          region: c.S3_REGION,
          bucket: c.S3_BUCKET,
          accessKeyId: c.S3_ACCESS_KEY_ID,
          secretAccessKey: c.S3_SECRET_ACCESS_KEY,
          forcePathStyle: c.S3_FORCE_PATH_STYLE,
        }),
    },
  ],
  exports: [ObjectStore],
})
export class StorageModule {}
