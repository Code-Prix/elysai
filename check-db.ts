import "dotenv/config";
import { PrismaClient } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.therapySession.count();
        console.log(`Total Sessions: ${count}`);

        const sessions = await prisma.therapySession.findMany({
            take: 5,
            orderBy: {
                startedAt: 'desc',
            },
        });

        console.log("Latest 5 Sessions:", JSON.stringify(sessions, null, 2));
    } catch (error) {
        console.error("Error querying database:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
