// types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** DB id from your User model */
      id: string;
    } & DefaultSession["user"];
  }

  // optionally augment User if you store DB-only fields
  interface User {
    id: string;
    // role?: string;
  }
}
