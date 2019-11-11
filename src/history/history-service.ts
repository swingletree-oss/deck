import { Client, RequestParams,	ApiResponse, RequestEvent } from "@elastic/elasticsearch";
import { injectable, inject } from "inversify";
import { ConfigurationService, DeckConfig } from "../configuration";
import { log, Harness } from "@swingletree-oss/harness";
import NodeCache = require("node-cache");

@injectable()
export abstract class HistoryService {
  abstract getLatest(from: number, size: number): Promise<any>;
  abstract search(query: string, from: number, size: number): Promise<any>;
  abstract getLatestForSender(sender: string, branch: string): Promise<RequestEvent<any, any>>;
  abstract getOrgs(search?: string): Promise<RequestEvent<any, any>>;
  abstract getStats(timespan: string): Promise<BuildStatusBucket[]>;

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
      body: {
        query: {
          simple_query_string: {
            query : query
          }
        }
      }
    });

    return result.body;
  }

  public async getLatest(from = 0, size= 10) {
    log.debug("get latest entries from %s, size %s", from, size);
    const searchParams: RequestParams.Search<any> = {
      index: this.index,
      body: {
        from: from,
        size: size,
        sort: [{
          timestamp: {
            order: "desc"
          }
        }]
      }
    };

    return (await this.client.search(searchParams)).body;
  }

  public async getLatestForSender(sender: string, branch: string) {
    const searchParams: RequestParams.Search<any> = {
      index: this.index,
      body: {
        size: 10,
        query: {
          bool: {
            must: [],
            filter: [{
                bool: {
                  must: [
                    { match: { "sender.keyword": sender }},
                    { match: { "branch.keyword": branch }}
                  ]
                }
            }]
          }
        },
        sort: [{
          timestamp: {
            order: "desc"
          }
        }]
      }
    };

    const result: ApiResponse<SearchResponse<Harness.AnalysisReport>> = await this.client.search(searchParams);

    return result;
  }

  public async getStats(timespan: string = "now-1y"): Promise<BuildStatusBucket[]> {
    const cacheKey = `${ElasticHistoryService.CACHE_BUILD_STATS}-${timespan}`;

    let result = this.cache.get(cacheKey) as BuildStatusBucket[];

    if (result == undefined) {
      const searchParams: RequestParams.Search = {
        index: this.index,
        body: {
          size: 0,
          aggs : {
            results : {
              terms : { field : "checkStatus.keyword" }
            }
          },
          query: {
            range : {
              timestamp : {
                gte: timespan
              }
            }
          }
        }
      };

      const response: ApiResponse = await this.client.search(searchParams);

      result = response.body.aggregations.results.buckets as BuildStatusBucket[];
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  public async getOrgs(search = "*") {
    const searchParams: RequestParams.Search = {
      index: this.index,
      body: {
        size: 0,
        aggs: {
          orgs: {
            terms: {
              field: "org.keyword"
            }
          }
        }
      }
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

  public async getStats(timespan: string = "now-1y"): Promise<BuildStatusBucket[]> {
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