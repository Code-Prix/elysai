import { PrismaClient } from "@prisma/client";

// Use the Railway URL directly
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:Lydell12@elysai-production.up.railway.app:5432/ElysAI?sslmode=require",
        },
    },
});

async function main() {
    console.log("Testing Railway database connection...");
    try {
        await prisma.$connect();
        console.log("✅ Successfully connected to Railway database!");

        // Try a simple query
        const count = await prisma.therapySession.count();
        console.log(`Found ${count} therapy sessions in the database.`);

    } catch (error) {
        console.error("❌ Failed to connect to Railway:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
