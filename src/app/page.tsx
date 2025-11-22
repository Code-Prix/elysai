import { TherapySession } from "@/app/_components/TherapySession";
import { auth } from "@/../auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
    const session = await auth();

    if (!session) {
        redirect("/login");
    }

    return <TherapySession />;
}

