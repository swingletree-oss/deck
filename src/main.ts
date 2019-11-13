import container from "./ioc-config";
import PageRoutes from "./pages/page-routes";
import { WebServer } from "./webserver";
import { HistoryService, ElasticHistoryService, NoopHistoryService } from "./history/history-service";
import { ConfigurationService, DeckConfig } from "./configuration";
import { log } from "@swingletree-oss/harness";


process.on("unhandledRejection", error => {
  log.error("Unhandled Promise rejection: %j", error);
});

class Deck {
  private webserver: WebServer;
  private pageRoutes: PageRoutes;

  constructor() {

    const configService = container.get<ConfigurationService>(ConfigurationService);
    if (configService.getBoolean(DeckConfig.ELASTIC_ENABLED)) {
      log.info("Registering Elastic Storage Service");
      container.bind<HistoryService>(HistoryService).to(ElasticHistoryService).inSingletonScope();
    } else {
      log.info("Elastic is disabled. Will not write any Notification Events to Elastic.");
      container.bind<HistoryService>(HistoryService).to(NoopHistoryService).inSingletonScope();
    }
    container.get<HistoryService>(HistoryService);

    this.webserver = container.get<WebServer>(WebServer);
    this.pageRoutes = container.get<PageRoutes>(PageRoutes);
  }

  public run() {
    this.webserver.addRouter("/", this.pageRoutes.getRoute());
    this.webserver.setLocale("filters", this.pageRoutes.filters());
  }

}

new Deck().run();
