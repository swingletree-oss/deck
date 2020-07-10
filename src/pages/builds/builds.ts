import { log } from "@swingletree-oss/harness";
import * as express from "express";
import { HistoryService } from "../../history/history-service";
import { PageRoute } from "../page-routes";

export class BuildsPage implements PageRoute {
  private view: string;
  private historyService: HistoryService;

  constructor(historyService: HistoryService, view: string) {
    this.historyService = historyService;
    this.view = view;
  }

  public handleRoute(): express.RequestHandler {
    return (req: express.Request, res: express.Response) => {
      res.locals.owner = req.params["owner"];
      res.locals.repo = req.params["repo"];
      res.locals.sha = req.params["sha"];
      res.locals.query = req.query.query;

      const page = parseInt(req.query.page as string, 10);
      const queryPage = (isNaN(page)) ? 0 : page;

      const pageSize = 20;
      const fromIndex = pageSize * queryPage;

      Promise.all([
        this.historyService.getFor(res.locals.owner, res.locals.repo, res.locals.sha, res.locals.query, fromIndex, pageSize)
      ]).then((data) => {
        res.locals.builds = data[0];
        res.locals.paging = {
          total: data[0].hits.total.value,
          pages: Math.ceil(data[0].hits.total.value / pageSize),
          pageSize: pageSize,
          current: queryPage
        };

        res.render(this.view);
      }).catch((err: Error) => {
        log.warn("failed to render detail build overview");
        log.warn("%j", err);

        if (process.env.NODE_ENV?.toLowerCase() != "production") {
          res.locals.error = err;
        }
        res.render("error");
      });
    };
  }
}