import passport from "passport";
import {
  Strategy as FacebookStrategy,
  Profile as FacebookProfile,
} from "passport-facebook";
import {
  Strategy as GoogleStrategy,
  Profile as GoogleProfile,
} from "passport-google-oauth20";
import prisma from "./prisma-client";
import { User } from "../interfaces/user.i";

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
  profile: GoogleProfile | FacebookProfile
): Promise<User> => {
  console.log(profile);
  const email = (profile.emails?.[0]?.value as string) ?? null;
  const provider = profile.provider;
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
    console.error(err);
    throw new Error(`Unable to find or create user: ${err}`);
  }
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: `/api/user/login/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await findOrCreateUser(profile as GoogleProfile);
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
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await findOrCreateUser(profile as FacebookProfile);
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

export default passport;
