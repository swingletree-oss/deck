"use strict";

import { Router, Request, Response, NextFunction } from "express";
import * as express from "express";
import { injectable } from "inversify";
import { inject } from "inversify";
import { ConfigurationService, DeckConfig } from "../configuration";
import { HistoryService } from "../history/history-service";
import { SwingletreeUtil } from "../util";
import { log } from "@swingletree-oss/harness";
import { SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION } from "constants";

@injectable()
class PageRoutes {
  private historyService: HistoryService;

  private readonly isBuildHistoryEnabled: boolean;

  private publicPageUrl: string;
  private readonly features: object;

  constructor(
    @inject(ConfigurationService) configService: ConfigurationService,
    @inject(HistoryService) historyService: HistoryService
    ) {
      this.publicPageUrl = configService.get(DeckConfig.GITHUB_PAGE);
      this.historyService = historyService;

      this.isBuildHistoryEnabled = historyService.isEnabled();
      this.features = configService.getObject(DeckConfig.FEATURES);
  }

  public filters(): any {
    return {
      "code": function (text: string, options: any) {
        return `<pre><code class="language-${options.lang}">${require("pug").runtime.escape(text)}</code></pre>`;
      }
    };
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

      res.locals.basePath = "..";

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
        .catch((err) => {
          log.warn("failed to render build overview");
          log.warn(err);
        });
    });
  }

  private enableCodeSnippetPage(router: Router) {
    router.get("/code/", (req, res) => {
      res.locals.basePath = "..";

      res.render("code");
    });
  }

  private flatten(object: any, preserveArrays: boolean) {
    const result = SwingletreeUtil.flattenObject(object, preserveArrays);
    return result;
  }

  public getRoute(): Router {
    const router = Router();

    // set locals for all pages
    router.use("/", (req: Request, res: Response, next: NextFunction) => {
      res.locals.appPublicPage = this.publicPageUrl;
      res.locals.isBuildHistoryEnabled = this.isBuildHistoryEnabled;
      res.locals.path = req.path;
      res.locals.flatten = this.flatten;
      res.locals.features = this.features;

      res.locals.componentIcon = this.componentIcon;
      res.locals.moment = require("moment");
      next();
    });

    // index page route
    router.get("/", async (req, res) => {
      res.locals.basePath = ".";

      if (this.isBuildHistoryEnabled) {
        const buildStats = await this.historyService.getStats("now-1y");
        res.locals.buildStats = buildStats.reduce((agg: any, curr) => {
          agg[curr.key] = curr.doc_count;
          return agg;
        }, {});
      } else {
        res.locals.buildStats = {};
      }

      res.render("index");
    });

    this.enableCodeSnippetPage(router);

    if (this.historyService.isEnabled()) {
      this.enableHistoryService(router);
    }

    router.use("/static", express.static("static"));

    return router;
  }

}

export default PageRoutes;