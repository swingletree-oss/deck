import { Client, RequestParams,	ApiResponse, RequestEvent } from "@elastic/elasticsearch";
import { injectable, inject } from "inversify";
import { ConfigurationService, DeckConfig } from "../configuration";
import { log, Harness } from "@swingletree-oss/harness";
import NodeCache = require("node-cache");
import { HistoryQuery } from "./query";

@injectable()
export abstract class HistoryService {
  abstract getLatest(from: number, size: number): Promise<any>;
  abstract getLatestForSender(sender: string, branch: string): Promise<RequestEvent<any, any>>;
  abstract getOrgs(search?: string): Promise<RequestEvent<any, any>>;
  abstract getFor(owner: string, repo: string, sha: string, queryString: string, from: number, size: number): Promise<any>;

  abstract isEnabled(): boolean;
}

@injectable()
export class ElasticHistoryService implements HistoryService {
  private readonly client: Client;
  private readonly index: string;

  private cache: NodeCache;

  public static readonly CACHE_BUILD_STATS = "build_stats";

  constructor(
    @inject(ConfigurationService) configService: ConfigurationService,
  ) {
    this.client = new Client({
      node: configService.get(DeckConfig.ELASTIC_NODE),
      auth: configService.getObject(DeckConfig.ELASTIC_AUTH)
    });

    this.index = configService.get(DeckConfig.ELASTIC_INDEX);
    this.cache = new NodeCache({
      stdTTL: 120
    });

  }

  public isEnabled() {
    return true;
  }

  public async search(query: string, from = 0, size = 10) {

    const result: ApiResponse<SearchResponse<Harness.AnalysisReport>> = await this.client.search({
      index: this.index,
      from: from,
      size: size,
      body: HistoryQuery.querySearch(query)
    });

    return result.body;
  }

  public async getFor(owner: string, repo?: string, sha?: string, queryString?: string, from = 0, size = 10) {
    log.debug("search owner:%s repo:%s sha:%s query:%s", owner, repo, sha, queryString);
    const searchParams: RequestParams.Search<any> = {
      index: this.index,
      from: from,
      size: size,
      body: HistoryQuery.queryForOwnerAndRepo(owner, repo, sha, queryString)
    };

    return (await this.client.search(searchParams)).body;
  }

  public async getLatest(from = 0, size= 10) {
    log.debug("get latest entries from %s, size %s", from, size);
    const searchParams: RequestParams.Search<any> = {
      index: this.index,
      body: HistoryQuery.queryForLatest(from, size)
    };

    return (await this.client.search(searchParams)).body;
  }

  public async getLatestForSender(sender: string, branch: string) {
    const searchParams: RequestParams.Search<any> = {
      index: this.index,
      body: HistoryQuery.queryForLatestBySender(sender, branch)
    };

    const result: ApiResponse<SearchResponse<Harness.AnalysisReport>> = await this.client.search(searchParams);

    return result;
  }

  public async getOrgs() {
    const searchParams: RequestParams.Search = {
      index: this.index,
      body: HistoryQuery.queryOwner()
    };

    const result: ApiResponse = await this.client.search(searchParams);

    return result.body.aggregations.orgs.buckets.map((item: any) => {
      return item.key;
    });
  }

}

@injectable()
export class NoopHistoryService implements HistoryService {
  constructor() {
    log.info("NOOP History Service registered.");
  }

  public isEnabled() {
    return false;
  }

  public async getFor(owner: string, repo?: string) {
    return Promise.resolve(null);
  }

  public async getLatest(from: number, size: number) {
    return Promise.resolve(null);
  }

  public async search(query: string, from: number, size: number) {
    return Promise.resolve(null);
  }

  public async getLatestForSender(sender: string, branch: string) {
    return Promise.resolve(null);
  }

  public async getOrgs(search: string) {
    return Promise.resolve(null);
  }

}

interface BuildStatusBucket {
  key: Harness.Conclusion;
  doc_count: number;
}

interface SearchBody {
  from?: number;
  size?: number;
  query: {
    match?: {
      sender?: string;
      org?: string;
      repo?: string;
      sha?: string;
    },
    term?: {
      sender?: string;
      org?: string;
      repo?: string;
      sha?: string;
    }
  };
  sort?: any;
}

interface SearchResponse<T> {
  took: number;
  timed_out: boolean;
  hits: {
    total: {
      value: number;
    };
    max_score: number;
    hits: Array<{
      _index: string;
      _type: string;
      _id: string;
      _score: number;
      _source: T;
      _version?: number;
      fields?: any;
      sort?: string[];
    }>;
  };
  aggregations?: any;
}