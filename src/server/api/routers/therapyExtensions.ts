/* eslint-disable */
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Helper function: Match therapist based on user's session history
async function matchTherapistForUser(prisma: any, sessions: any[]) {
    // Count topic frequencies to determine primary concern
    const topicCounts: Record<string, number> = {};
    const allTopics = sessions.flatMap(s => s.topics || []);

    allTopics.forEach(topic => {
        const lowerTopic = topic.toLowerCase();
        topicCounts[lowerTopic] = (topicCounts[lowerTopic] || 0) + 1;
    });

    // Check for risk flags indicating trauma/PTSD
    const hasTraumaRisks = sessions.some(s =>
        (s.riskFlags || []).some((flag: string) =>
            flag.toLowerCase().includes('trauma') ||
            flag.toLowerCase().includes('ptsd') ||
            flag.toLowerCase().includes('abuse')
        )
    );

    // Check emotional states for depression indicators
    const hasDepressionIndicators = sessions.some(s =>
        s.emotionalState?.toLowerCase().includes('depressed') ||
        s.emotionalState?.toLowerCase().includes('hopeless') ||
        s.emotionalState?.toLowerCase().includes('sad')
    );

    // Check for anxiety indicators
    const hasAnxietyIndicators = sessions.some(s =>
        s.emotionalState?.toLowerCase().includes('anxious') ||
        s.emotionalState?.toLowerCase().includes('worried') ||
        s.emotionalState?.toLowerCase().includes('stressed')
    );

    // Check for relationship topics
    const hasRelationshipTopics = Object.keys(topicCounts).some(topic =>
        topic.includes('relationship') ||
        topic.includes('marriage') ||
        topic.includes('family') ||
        topic.includes('partner')
    );

    // Match to therapist based on specialization
    let specialization = "General Mental Health & Wellness"; // Default

    if (hasTraumaRisks) {
        specialization = "PTSD & Trauma Recovery";
    } else if (hasDepressionIndicators) {
        specialization = "Depression & Mood Disorders";
    } else if (hasAnxietyIndicators) {
        specialization = "Anxiety & Panic Disorders";
    } else if (hasRelationshipTopics) {
        specialization = "Relationships & Communication";
    }

    // Find therapist with matching specialization
    const parts = specialization.split('&');
    const firstPart = parts[0] || "";

    const therapist = await prisma.therapist.findFirst({
        where: {
            specialization: {
                contains: firstPart.trim()
            }
        },
        orderBy: { rating: 'desc' }
    });

    return therapist || null;
}

export const therapyExtensionsRouter = createTRPCRouter({
    // Get session context for RAG (previous session summaries)
    getSessionContext: protectedProcedure
        .query(async ({ ctx }) => {
            const userId = ctx.session.user.id;

            // Check if user has completed first session
            const user = await ctx.prisma.user.findUnique({
                where: { id: userId },
                select: { hasCompletedFirstSession: true }
            });

            if (!user?.hasCompletedFirstSession) {
                return {
                    hasHistory: false,
                    isFirstTime: true,
                    recentSessions: []
                };
            }

            // Get last 5 sessions for context
            const recentSessions = await ctx.prisma.therapySession.findMany({
                where: { userId },
                orderBy: { startedAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    summary: true,
                    emotionalState: true,
                    topics: true,
                    startedAt: true,
                    generatedTasks: {
                        select: {
                            id: true,
                            description: true,
                            isCompleted: true,
                            completionAskedAt: true,
                            createdAt: true
                        }
                    }
                }
            });

            return {
                hasHistory: recentSessions.length > 0,
                isFirstTime: false,
                recentSessions: recentSessions.map((s: any) => ({
                    id: s.id,
                    date: s.startedAt.toLocaleDateString(),
                    summary: s.summary.substring(0, 300) + (s.summary.length > 300 ? '...' : ''),
                    mood: s.emotionalState,
                    topics: s.topics,
                    tasks: s.generatedTasks
                }))
            };
        }),

    // Check if user needs therapist referral
    checkTherapistReferral: protectedProcedure
        .query(async ({ ctx }) => {
            const userId = ctx.session.user.id;

            // Get tasks from last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const recentTasks = await ctx.prisma.task.findMany({
                where: {
                    userId,
                    createdAt: { gte: sevenDaysAgo }
                }
            });

            if (recentTasks.length === 0) {
                return { shouldRefer: false, taskCount: 0 };
            }

            const completedCount = recentTasks.filter(t => t.isCompleted).length;
            const completionRate = completedCount / recentTasks.length;

            // If less than 30% tasks completed, suggest therapist
            if (completionRate < 0.3) {
                // Get user's session history for matching
                const sessions = await ctx.prisma.therapySession.findMany({
                    where: { userId },
                    select: { topics: true, riskFlags: true, emotionalState: true }
                });

                // Match therapist based on primary concerns
                const matchedTherapist = await matchTherapistForUser(ctx.prisma, sessions);

                return {
                    shouldRefer: true,
                    completionRate,
                    taskCount: recentTasks.length,
                    completedCount,
                    therapist: matchedTherapist
                };
            }

            return { shouldRefer: false, taskCount: recentTasks.length, completionRate };
        }),

    // Get all therapists
    getAllTherapists: protectedProcedure
        .query(async ({ ctx }) => {
            const therapists = await ctx.prisma.therapist.findMany({
                orderBy: { rating: 'desc' }
            });
            return therapists;
        }),

    // Get therapist by ID
    getTherapistById: protectedProcedure
        .input(z.object({ therapistId: z.string() }))
        .query(async ({ ctx, input }) => {
            const therapist = await ctx.prisma.therapist.findUnique({
                where: { id: input.therapistId }
            });

            if (!therapist) {
                throw new Error("Therapist not found");
            }

            return therapist;
        }),

    // Mark first session as complete
    markFirstSessionComplete: protectedProcedure
        .mutation(async ({ ctx }) => {
            const userId = ctx.session.user.id;

            await ctx.prisma.user.update({
                where: { id: userId },
                data: { hasCompletedFirstSession: true }
            });

            return { success: true };
        }),

    // Update task completion
    updateTaskCompletion: protectedProcedure
        .input(z.object({
            taskId: z.string(),
            isCompleted: z.boolean(),
            completionResponse: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            const task = await ctx.prisma.task.update({
                where: { id: input.taskId },
                data: {
                    isCompleted: input.isCompleted,
                    completionAskedAt: new Date(),
                    completionResponse: input.completionResponse
                }
            });

            return task;
        }),

    // Get pending tasks for user
    getPendingTasks: protectedProcedure
        .query(async ({ ctx }) => {
            const userId = ctx.session.user.id;

            const tasks = await ctx.prisma.task.findMany({
                where: {
                    userId,
                    isCompleted: false
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            });

            return tasks;
        }),
});
