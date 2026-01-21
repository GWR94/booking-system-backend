import { Profile as FacebookProfile } from "passport-facebook";
import { Profile as GoogleProfile } from "passport-google-oauth20";
import { Profile as TwitterProfile } from "passport-twitter";
import { User, UserPayload, AuthenticatedRequest } from "@interfaces";
import prisma from "../config/prisma.config";
import { logger } from "./logger";

export const findOrCreateUser = async (
  req: AuthenticatedRequest,
  profile: GoogleProfile | FacebookProfile | TwitterProfile,
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
          "This social account is already linked to another user.",
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
    logger.error(`Error in findOrCreateUser: ${err}`);
    throw new Error(`Unable to find or create user: ${err}`);
  }
};
