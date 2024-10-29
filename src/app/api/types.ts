import { z } from "zod";

import { UserSchema } from "@/db/schema";

export const PostUserRequestSchema = z.object({
  user: UserSchema,
});

export type PostUserRequest = z.infer<typeof PostUserRequestSchema>;

export const PostUserResponseSchema = z.union([
  z.object({
    error: z.literal(true),
    message: z.string(),
  }),
  z.object({
    error: z.literal(false),
    data: UserSchema,
  }),
]);

export type PostUserResponse = z.infer<typeof PostUserResponseSchema>;

export const GetUserResponseSchema = z.union([
  z.object({
    error: z.literal(true),
    message: z.string(),
  }),
  z.object({
    error: z.literal(false),
    data: UserSchema,
  }),
]);

export type GetUserResponse = z.infer<typeof GetUserResponseSchema>;
