import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const tasksRouter = createTRPCRouter({
    getTasks: protectedProcedure.query(async ({ ctx }) => {
        return ctx.prisma.task.findMany({
            where: {
                userId: ctx.session.user.id,
                isCompleted: false,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }),

    toggleTask: protectedProcedure
        .input(z.object({ taskId: z.string(), isCompleted: z.boolean() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.prisma.task.update({
                where: {
                    id: input.taskId,
                    userId: ctx.session.user.id,
                },
                data: {
                    isCompleted: input.isCompleted,
                },
            });
        }),
});
