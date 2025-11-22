import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

async function main() {
    console.log("🔍 Verifying latest therapy session...");

    try {
        const session = await prisma.therapySession.findFirst({
            orderBy: { startedAt: 'desc' },
            include: { user: true }
        });

        if (!session) {
            console.log("❌ No sessions found in the database.");
            return;
        }

        console.log("\n✅ Latest Session Found:");
        console.log("------------------------------------------------");
        console.log(`ID: ${session.id}`);
        console.log(`Date: ${session.startedAt.toLocaleString()}`);
        console.log(`Summary: ${session.summary}`);
        console.log(`Emotional State: ${session.emotionalState}`);
        console.log(`Topics: ${session.topics.join(", ")}`);
        console.log(`Risk Flags: ${session.riskFlags.join(", ")}`);

        console.log("\n👤 User Info:");
        if (session.user) {
            console.log(`Linked User: ${session.user.name} (${session.user.email})`);
        } else {
            console.log("Linked User: Guest (No DB User linked)");
        }

        console.log("\n📝 Transcript Preview (First 500 chars):");
        console.log(session.transcript.substring(0, 500) + "...");

        // Check for name in transcript
        console.log("\n🔎 Checking for User Name in Transcript:");
        // This is a heuristic check
        if (session.transcript.includes("Lydell") || session.transcript.includes("lydell")) {
            console.log("✅ Found 'Lydell' in the transcript!");
        } else {
            console.log("⚠️ 'Lydell' not found in the first check. (Might be okay if not mentioned explicitly)");
        }

    } catch (error) {
        console.error("❌ Error fetching data:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
