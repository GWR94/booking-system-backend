import passport from "passport";
import {
  Strategy as FacebookStrategy,
  Profile as FacebookProfile,
} from "passport-facebook";
import {
  Strategy as GoogleStrategy,
  Profile as GoogleProfile,
} from "passport-google-oauth20";
import {
  Strategy as TwitterStrategy,
  Profile as TwitterProfile,
} from "passport-twitter";
import { User } from "@interfaces";
import prisma from "./prisma.config";
import { findOrCreateUser } from "@utils";

export const configurePassport = () => {
  passport.serializeUser((user, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: parseInt(id, 10) },
      });
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        callbackURL: `/api/user/login/google/callback`,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateUser(req, profile as GoogleProfile);
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );

  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID as string,
        clientSecret: process.env.FACEBOOK_APP_SECRET as string,
        callbackURL: "/api/user/login/facebook/callback",
        enableProof: true,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateUser(req, profile as FacebookProfile);
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );

  passport.use(
    new TwitterStrategy(
      {
        consumerKey: process.env.TWITTER_CONSUMER_KEY as string,
        consumerSecret: process.env.TWITTER_CONSUMER_SECRET as string,
        callbackURL: "/api/user/login/twitter/callback",
        userAuthorizationURL: "https://api.twitter.com/oauth/authorize",
        includeEmail: true,
        passReqToCallback: true,
      },
      async (
        req,
        token: string,
        tokenSecret: string,
        profile: TwitterProfile,
        done: (error: any, user?: any) => void
      ) => {
        try {
          const user = await findOrCreateUser(req, profile);
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
};

export default passport;
