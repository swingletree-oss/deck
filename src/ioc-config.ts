import "reflect-metadata";

import { Container } from "inversify";

import { ConfigurationService } from "./configuration";
import { WebServer } from "./webserver";
import PageRoutes from "./pages/page-routes";


const container = new Container();

container.bind<ConfigurationService>(ConfigurationService).toSelf().inSingletonScope();
container.bind<PageRoutes>(PageRoutes).toSelf().inSingletonScope();
container.bind<WebServer>(WebServer).toSelf().inSingletonScope();

export default container;