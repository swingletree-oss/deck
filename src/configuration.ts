import * as yaml from "js-yaml";
import { injectable } from "inversify";
import * as nconf from "nconf";
import { log } from "@swingletree-oss/harness";

@injectable()
export class ConfigurationService {
  private config: nconf.Provider;

  constructor(file = "./swingletree.conf.yaml") {
    log.info("loading configuration from file %s", file);

    this.config = new nconf.Provider()
      .env({
        lowerCase: true,
        separator: "_",
        match: /((DECK|LOG)_.*)|(PORT)$/i
      })
      .file({
        file: file,
        format: {
          parse: yaml.safeLoad,
          stringify: yaml.safeDump
        }
      });
  }

  public checkRequired(keys: string[]) {
    this.config.required(keys);
  }

  public get(key: string): string {
    const value: string = this.config.get(key);

    if (!value || value.toString().trim() == "") {
      return null;
    }

    return value;
  }

  public set(key: string, value: any) {
    log.info("performing configuration overwrite for %s", key);
    this.config.set(key, value);
  }

  public getObject(key: string): any {
    return this.config.get(key);
  }

  public getConfig() {
    return this.config.get();
  }

  public getNumber(key: string): number {
    return Number(this.get(key));
  }

  public getBoolean(key: string): boolean {
    return String(this.get(key)) == "true";
  }
}


export enum DeckConfig {
  PORT = "deck:port",
  ELASTIC_ENABLED = "deck:elastic:enabled",
  ELASTIC_NODE = "deck:elastic:node",
  ELASTIC_AUTH = "deck:elastic:auth",
  ELASTIC_INDEX = "deck:elastic:index",
  GITHUB_PAGE = "deck:github:page",
  FEATURES = "deck:features",
  FEATURES_LOGIN = "deck:features:login",
  PATH = "deck:path",
  AUTH_JWT_SECRET = "deck:auth:jwt:secret",
  AUTH_OAUTH_GITHUB = "deck:auth:github",
  COOKIES_SECURE = "deck:cookies:secure"
}