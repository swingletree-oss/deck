import { RequestParams } from "@elastic/elasticsearch";

export class HistoryQuery {
  public static queryForOwner(owner: string) {
    return this.queryForOwnerAndRepo(owner);
  }

  public static queryForOwnerAndRepo(owner: string, repo?: string) {
    const query: any = {
      aggs: {
        report_types: {
          terms: {
            field: "sender.keyword"
          }
        }
      },
      query: {
        bool: {
          filter: [
            { term:  { "source.owner.keyword": owner }}
          ]
        }
      }
    };

    if (repo) {
      query.query.bool.filter.push({
        term: {
          "source.repo.keyword": repo
        }
      });
    }

    return query;
  }

  public static queryForLatest(from: number, size: number) {
    return {
      from: from,
      size: size,
      sort: [{
        timestamp: {
          order: "desc"
        }
      }]
    };
  }

  public static queryForLatestBySender(sender: string, branch: string): any {
    return {
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
    };
  }

  public static queryStats(timespan: string): any {
    return {
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
    };
  }

  public static queryOwner(): any {
    return {
      size: 0,
      aggs: {
        orgs: {
          terms: {
            field: "source.owner.keyword"
          }
        }
      },
      query: {
        match_all: {}
      }
    };
  }

  public static queryLastActiveOwners(timestamp: string = "now-4h"): any {
    return {
      size: 0,
      aggs: {
        orgs: {
          terms: {
            field: "source.owner.keyword"
          }
        }
      },
      query: {
        range: {
          timestamp: {
            gte: timestamp
          }
        }
      }
    };
  }

  public static querySearch(query: string) {
    return {
      query: {
        simple_query_string: {
          query : query
        }
      }
    };
  }
}