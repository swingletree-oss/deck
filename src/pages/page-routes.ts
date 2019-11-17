"use strict";

import { Router, Request, Response, NextFunction } from "express";
import * as express from "express";
import { injectable } from "inversify";
import { inject } from "inversify";
import { ConfigurationService, DeckConfig } from "../configuration";
import { HistoryService } from "../history/history-service";
import { SwingletreeUtil } from "../util";
import { log } from "@swingletree-oss/harness";

@injectable()
class PageRoutes {
  private historyService: HistoryService;

  private readonly isBuildHistoryEnabled: boolean;

  private publicPageUrl: string;
  private readonly features: object;
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
    router.get("/builds", (req, res) => {
      req.query.page = parseInt(req.query.page, 10);
      const queryPage = (isNaN(req.query.page)) ? 0 : req.query.page;

      const pageSize = 20;
      const fromIndex = pageSize * queryPage;

      Promise.all([
        this.historyService.getOrgs(),
        (req.query.query) ? this.historyService.search(req.query.query, fromIndex, pageSize) : this.historyService.getLatest(fromIndex, pageSize)
      ]).then((data) => {
          res.locals.orgs = data[0];
          res.locals.builds = data[1];

          res.locals.paging = {
            total: data[1].hits.total.value,
            pages: Math.ceil(data[1].hits.total.value / pageSize),
            pageSize: pageSize,
            current: queryPage
          };

          res.locals.query = req.query.query;

          res.render("builds");
        })
        .catch((err: Error) => {
          log.warn("failed to render build overview");
          log.warn(err);

          res.locals.error = err.message;
          res.render("error");
        });
    });
  }

  private flatten(object: any, preserveArrays: boolean) {
    const result = SwingletreeUtil.flattenObject(object, preserveArrays);
    return result;
  }

  private basePathTransformer(path: string) {
    return `${ this.basePath }${ path }`.replace(/\/+/, "/");
  }

  public getRoute(): Router {
    const router = Router();

    // set locals for all pages
    router.use("/", (req: Request, res: Response, next: NextFunction) => {
      res.locals.appPublicPage = this.publicPageUrl;
      res.locals.isBuildHistoryEnabled = this.isBuildHistoryEnabled;
      res.locals.path = req.path;
      res.locals.basePath = this.basePathTransformer.bind(this);
      res.locals.flatten = this.flatten;
      res.locals.features = this.features;

      res.locals.componentIcon = this.componentIcon;
      res.locals.moment = require("moment");
      next();
    });

    // index page route
    router.get("/", async (req, res) => {
      if (this.isBuildHistoryEnabled) {
        try {
          const buildStats = await this.historyService.getStats("now-1y");
          res.locals.buildStats = buildStats.reduce((agg: any, curr) => {
            agg[curr.key] = curr.doc_count;
            return agg;
          }, {});
        } catch (err) {
          log.warn("Failed to retrieve information from elastic. Caused by: %s", err);
        }
      } else {
        res.locals.buildStats = {};
      }

      res.render("index");
    });

    if (this.historyService.isEnabled()) {
      this.enableHistoryService(router);
    }

    router.use("/static", express.static("static"));
    router.use("/modules/d3/", express.static("node_modules/d3/dist/"));

    return router;
  }

}

export default PageRoutes;