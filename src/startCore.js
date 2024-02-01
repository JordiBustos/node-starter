import { join } from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import limiter from "./constants/limiter.js";
import "dotenv/config";
import createRedisClient from "./utils/connectRedis.js";
import session from "express-session";
import RedisStore from "connect-redis";
import indexRouter from "./routes/index.js";
import authRouter from "./routes/auth.router.js";
import rolesRouter from "./routes/role.router.js";
import express, { json, urlencoded } from "express";
import db from "./db.js";
import cors from "cors";

import { fileURLToPath } from "url";
import { dirname } from "path";

async function startCore(app, port) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const client = await createRedisClient();
  app.locals.client = client;
  let redisStore = new RedisStore({
    client: client,
    prefix: "node-starter-redis",
  });
  app.use(
    session({
      store: redisStore,
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: true,
        httpOnly: true,
        maxAge: 1000 * 60 * 10,
      },
    }),
  );

  // enable this if you run behind a proxy (e.g. nginx)
  // app.set('trust proxy', 1);

  app.use(limiter);
  app.use(cors());
  app.use(logger("dev"));
  app.use(json());
  app.use(urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use(express.static(join(__dirname, "public")));

  app.use("/", indexRouter);
  app.use("/auth", authRouter);
  app.use("/roles", rolesRouter);

  app.get("/health", (_, res) => {
    res.send("Server is running...");
  });

  app.get("/redis-health", async (req, res) => {
    try {
      const client = req.app.locals.client;
      await client.set("key", "value");
      const value = await client.get("key");
      if (value === "value") {
        await client.del("key");
        return res.status(200).send(`Redis is running (${value})`);
      }
    } catch (err) {
      res.status(500).send(`Redis is not running: ${err}`);
    }
  });

  db.authenticate();
  db.sync();

  const server = app.listen(port || process.env.PORT, async () => {
    try {
      console.log("Server is running on port:", server.address().port);
    } catch (err) {
      console.log(`Redis was not connect due to: ${err}`);
    }
  });

  return server;
}

export default startCore;
