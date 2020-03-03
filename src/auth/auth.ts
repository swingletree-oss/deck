import { Comms, Harness, log } from "@swingletree-oss/harness";
import { NextFunction, Request, Response, Router } from "express";
import { inject, injectable } from "inversify";
import { ConfigurationService, DeckConfig } from "../configuration";
import * as passport from "passport";
import * as jwt from "jsonwebtoken";
import * as request from "request";

@injectable()
export class Authenticator {
  private configurationService: ConfigurationService;

  constructor(
    @inject(ConfigurationService) configurationService: ConfigurationService,
  ) {
    this.configurationService = configurationService;

    const GitHubStrategy = require("passport-github2").Strategy;

    passport.use(new GitHubStrategy(
      this.configurationService.get(DeckConfig.AUTH_OAUTH_GITHUB),
      function(accessToken: string, refreshToken: string, profile: passport.Profile, cb: any) {
        const user = new User(profile);
        const orgUrl = (profile as any)._json.organizations_url;

        log.debug("retrieving additional user information for user %s", profile.username);
        request.get(orgUrl, {
          headers: {
            "User-Agent": "request",
            "Authorization": `token ${accessToken}`
          },
          json: true
        }, function (error, response, body: any[]) {
          if (!error) {
            user.orgs = body.map( item => item.login );
            return cb(null, user);
          } else {
            log.error(`failed to retrieve user information for ${profile.username}`);
          }
        });
      }
    ));

    passport.serializeUser(function(req: Request, user: User, done: any) {
      done(null, user);
    });

    passport.deserializeUser(function(req: Request, id: string, done: any) {
      done(null, req.user);
    });

  }

  public getRouter(): Router {
    const secret = this.configurationService.get(DeckConfig.AUTH_JWT_SECRET);
    const secureCookies = this.configurationService.getBoolean(DeckConfig.COOKIES_SECURE);
    const basePath = this.configurationService.get(DeckConfig.PATH) || "/";

    const router = Router();

    router.use(passport.initialize());

    router.get("/github", passport.authenticate("github", { scope: [ "user:email", "read:org" ] }));
    router.get("/github/callback", passport.authenticate("github", { failureRedirect: "/login" }),
    function(req, res) {
      const token = jwt.sign({ data: req.user }, secret, { expiresIn: "1h" });
      res.cookie("token", token, { secure: secureCookies });
      res.redirect(basePath);
    });

    router.get("/logout", (req: Request, res: Response) => {
      res.clearCookie("token");
      res.redirect(basePath);
    });

    return router;
  }
}

export class User {

  constructor(profile: passport.Profile) {
    this.id = profile.id;
    this.displayName = profile.displayName;
    this.username = profile.username;

    if (profile.photos && profile.photos.length > 0) {
      this.avatar = profile.photos[0].value;
    }
  }

  id: string;
  displayName: string;
  username: string;
  avatar: string;
  orgs: string[];
}