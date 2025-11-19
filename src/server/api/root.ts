import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { therapyRouter } from "~/server/api/routers/therapy";
 // Remove if you deleted the example router

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  therapy: therapyRouter,
   // Remove if you deleted the example router
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 * ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);