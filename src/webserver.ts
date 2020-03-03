import { injectable, inject } from "inversify";
import * as express from "express";
import bodyParser = require("body-parser");
import * as compression from "compression";
import { ConfigurationService, DeckConfig } from "./configuration";
import { log } from "@swingletree-oss/harness";
import * as jwtMiddleware from "express-jwt";

@injectable()
export class WebServer {
  private app: express.Express;

  private port: number;
  private jwtSecret: any;
  private basePath: string;

  constructor(
    @inject(ConfigurationService) configService: ConfigurationService
  ) {
    this.app = express();

    this.port = configService.getNumber(DeckConfig.PORT);
    this.jwtSecret = configService.get(DeckConfig.AUTH_JWT_SECRET);
    this.basePath = configService.get(DeckConfig.PATH) || "/";

    this.initialize();
  }

  private initialize() {
    const redirectPath = this.basePath;


    // express configuration
    this.app.set("port", this.port);
    this.app.use(compression());
    this.app.use(require("cookie-parser")());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));

    this.app.use(jwtMiddleware({
      credentialsRequired: false,
      secret: this.jwtSecret,
      getToken: (req: express.Request) => {
        return req.cookies.token;
      }
    }).unless({path: ["/static", "/modules"]}));

    this.app.use(function (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) {
      if (err.name === "UnauthorizedError") {
        res.clearCookie("token");
        res.redirect(redirectPath);
      } else {
        next(err);
      }
    });

    this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.log(req.user);
      next();
    });

    // set common headers
    this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.header("X-Frame-Options", "DENY");
      res.header("X-XSS-Protection", "1");
      res.header("X-Content-Type-Options", "nosniff");
      next();
    });

    // disable server reveal
    this.app.disable("x-powered-by");

    // set rendering engine
    this.app.set("view engine", "pug");

    // health endpoint
    this.app.get("/health", (request: express.Request, response: express.Response) => {
      response.sendStatus(200);
    });

    // error handling
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      // only provide error details in development mode
      const visibleError = req.app.get("env") === "development" ? err : {};

      res.status(err.status || 500);
      res.send(visibleError);
    });

    // kickstart everything
    this.app.listen(this.app.get("port"), () => {
      log.info("listening on http://localhost:%d in %s mode", this.app.get("port"), this.app.get("env"));
    });
  }

  public addRouter(path: string, router: express.Router) {
    log.debug("adding http endpoint %s", path);
    this.app.use(path, router);
  }

  public setLocale(key: string, data: any) {
    log.debug("adding locals entry for key %s", key);
    this.app.locals[key] = data;
  }
}