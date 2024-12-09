import { refreshToken } from "./../controllers/userController";
import passport from "passport";
import {
  Strategy as FacebookStrategy,
  Profile as FacebookProfile,
} from "passport-facebook";
import {
  Strategy as GoogleStrategy,
  Profile as GoogleProfile,
} from "passport-google-oauth20";
import AppleStrategy, { Profile as AppleProfile } from "passport-apple";
import prisma from "./prisma-client";
import { User } from "../controllers/userController";

passport.serializeUser((user: any, done) => {
  done(null, user.id);
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
  profile: GoogleProfile | FacebookProfile | AppleProfile
): Promise<User> => {
  console.log(profile);
  const email = profile.emails[0].value;
  const provider = profile.provider;
  try {
    console.log("Finding user");

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ [`${provider}Id`]: profile.id }, { email }],
      },
    });
    console.log(existingUser);
    if (existingUser) {
      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          [`${provider}Id`]: profile.id,
          email,
        },
      });
      return user;
    }

    return prisma.user.create({
      data: {
        email: email as string,
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

// passport.use(
//   new FacebookStrategy(
//     {
//       clientID: process.env.FACEBOOK_CLIENT_ID as string,
//       clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
//       callbackURL: "/api/user/login/facebook/callback",
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       try {
//         const user = await findOrCreateUser(profile as FacebookProfile);
//         const { accessToken: jwtAccessToken, refreshToken: jwtRefreshToken } =
//           generateTokens(user);

//         done(null, {
//           user,
//           jwtAccessToken,
//           jwtRefreshToken,
//         });
//       } catch (err) {
//         done(err);
//       }
//     }
//   )
// );

export default passport;
