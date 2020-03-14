"use strict";

import { Router, Request, Response, NextFunction } from "express";
import * as express from "express";
import { injectable } from "inversify";
import { inject } from "inversify";
import { ConfigurationService, DeckConfig } from "../configuration";
import { HistoryService } from "../history/history-service";
import { SwingletreeUtil } from "../util";
import { log } from "@swingletree-oss/harness";
import { BuildsPage } from "./builds/builds";

@injectable()
class PageRoutes {
  private historyService: HistoryService;

  private readonly isBuildHistoryEnabled: boolean;

  private publicPageUrl: string;
  private readonly features: any;
  private readonly basePath: string;

  constructor(
    @inject(ConfigurationService) configService: ConfigurationService,
    @inject(HistoryService) historyService: HistoryService
    ) {
      this.publicPageUrl = configService.get(DeckConfig.GITHUB_PAGE);
      this.historyService = historyService;

      this.isBuildHistoryEnabled = historyService.isEnabled();
      this.features = configService.getObject(DeckConfig.FEATURES);
      this.basePath = configService.get(DeckConfig.PATH) || "/";

      this.features.login = configService.getBoolean(DeckConfig.FEATURES_LOGIN);
  }

  private componentIcon(componentId: string) {
    switch (componentId) {
      case "security/twistlock": return "shield-alt";
      case "security/zap": return "crosshairs";
      case "sonarqube": return "bug";
      case "gradle/nebula": return "toolbox";
    }

    return "question";
  }

  private enableHistoryService(router: Router) {
    const buildsPage = new BuildsPage(this.historyService, "builds");
    router.get("/builds", buildsPage.handleRoute());
    router.get("/builds/:owner", buildsPage.handleRoute());
    router.get("/builds/:owner/:repo", buildsPage.handleRoute());
    router.get("/builds/:owner/:repo/:sha", buildsPage.handleRoute());
  }

  private flatten(object: any, preserveArrays: boolean) {
    const result = SwingletreeUtil.flattenObject(object, preserveArrays);
    return result;
  }

  private basePathTransformer(path: string) {
    return `${ this.basePath }${ path }`.replace(/\/+/, "/");
  }

  private setBaseLocals(req: Request, res: Response, next: NextFunction) {
    res.locals.appPublicPage = this.publicPageUrl;
    res.locals.isBuildHistoryEnabled = this.isBuildHistoryEnabled;
    res.locals.path = req.path;
    res.locals.basePath = this.basePathTransformer.bind(this);
    res.locals.flatten = this.flatten;
    res.locals.features = this.features;
    res.locals.user = req.user;
    res.locals.isAuthenticated = !!req.user;

    res.locals.componentIcon = this.componentIcon;
    res.locals.moment = require("moment");

    next();
  }

  public getRoute(): Router {
    const router = Router();

    // set locals for all pages
    router.use("/", this.setBaseLocals.bind(this));

    // index page route
    router.get("/", async (req, res) => {
      res.render("index");
    });

    if (this.historyService.isEnabled()) {
      this.enableHistoryService(router);
    }

    router.use("/static", express.static("static"));
    router.use("/modules/d3/", express.static("node_modules/d3/dist/"));
    router.use("/modules/jdenticon/", express.static("node_modules/jdenticon/dist/"));

    return router;
  }

}

export abstract class PageRoute {
  abstract handleRoute(): express.RequestHandler;
}

export default PageRoutes;