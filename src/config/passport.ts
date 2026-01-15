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
import { User, UserPayload } from "../interfaces/user.i";
import { AuthenticatedRequest } from "../interfaces/common.i";
import prisma from "./prisma-client";

// FIXME : test removal
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

const findOrCreateUser = async (
  req: AuthenticatedRequest,
  profile: GoogleProfile | FacebookProfile | TwitterProfile
): Promise<User> => {
  const email = (profile.emails?.[0]?.value as string) ?? null;
  const provider = profile.provider;

  // If user is already authenticated (Account Linking)
  if (req.currentUser) {
    const currentUserId = (req.currentUser as UserPayload).id;

    // Check if this social account is already linked to ANOTHER user
    const existingLink = await prisma.user.findFirst({
      where: { [`${provider}Id`]: profile.id },
    });

    if (existingLink) {
      if (existingLink.id === currentUserId) {
        return existingLink;
      } else {
        throw new Error(
          "This social account is already linked to another user."
        );
      }
    }

    // Link the account
    const updatedUser = await prisma.user.update({
      where: { id: currentUserId },
      data: {
        [`${provider}Id`]: profile.id,
      },
    });
    return updatedUser;
  }

  // Normal Login / Register Flow
  try {
    const whereFilter = email
      ? {
          OR: [{ [`${provider}Id`]: profile.id }, { email }],
        }
      : {
          [`${provider}Id`]: profile.id,
        };

    const existingUser = await prisma.user.findFirst({
      where: whereFilter,
    });

    if (existingUser) {
      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          [`${provider}Id`]: profile.id,
        },
      });
      return user;
    }

    return prisma.user.create({
      data: {
        email,
        [`${provider}Id`]: profile.id,
        name: profile.displayName,
      },
    });
  } catch (err) {
    console.error("Error in findOrCreateUser:", err);
    throw new Error(`Unable to find or create user: ${err}`);
  }
};

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

export default passport;
