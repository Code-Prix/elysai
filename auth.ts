// auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/server/db";
import { loginSchema } from "@/lib/validators/auth";
import bcrypt from "bcryptjs";
import { ZodError } from "zod";

function verifyPassword(password: string, hashedPassword?: string | null) {
  if (!hashedPassword) return false;
  return bcrypt.compareSync(password, hashedPassword);
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  // 🔁 change THIS:
  session: {
    strategy: "jwt",        // <-- use JWT sessions
  },

  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID!,
      clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),

    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        try {
          const { email, password } = await loginSchema.parseAsync(credentials);

          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user || !user.password) {
            return null;
          }

          const isValid = verifyPassword(password, user.password);
          if (!isValid) return null;

          // Must return an object with id
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          };
        } catch (error) {
          if (error instanceof ZodError) return null;
          throw error;
        }
      },
    }),
  ],

  callbacks: {
    // For JWT strategy, auth() uses the JWT callback
    async jwt({ token, user }) {
      if (user) {
        // first time after signIn
        token.id = (user as any).id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        // @ts-expect-error extending default
        session.user.id = token.id as string | undefined;
      }
      return session;
    },

    authorized: async ({ auth }) => {
      // middleware protection, fine as is
      return !!auth;
    },
  },

  secret: process.env.AUTH_SECRET,
  trustHost: true,
});
  