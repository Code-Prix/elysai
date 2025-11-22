import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

const therapists = [
    {
        name: "Dr. Sarah Chen",
        title: "Licensed Clinical Psychologist",
        specialization: "Anxiety & Panic Disorders",
        bio: "Specializing in Cognitive Behavioral Therapy (CBT) for anxiety disorders with 12+ years of experience. Expertise in panic attacks, social anxiety, and generalized anxiety disorder. Dr. Chen uses evidence-based approaches to help clients develop coping strategies and overcome anxiety.",
        yearsExperience: 12,
        rating: 4.9,
        email: "sarah.chen@therapyclinic.com",
        phone: "+1 (555) 234-5678",
        imageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
    },
    {
        name: "Dr. Michael Rodriguez",
        title: "Psychiatrist & Psychotherapist",
        specialization: "Depression & Mood Disorders",
        bio: "Board-certified psychiatrist focusing on treatment-resistant depression, bipolar disorder, and seasonal affective disorder. Combines medication management with therapeutic approaches. Dr. Rodriguez has helped hundreds of patients regain their quality of life through personalized treatment plans.",
        yearsExperience: 15,
        rating: 4.8,
        email: "m.rodriguez@mindwellness.com",
        phone: "+1 (555) 345-6789",
        imageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael"
    },
    {
        name: "Dr. Emily Washington",
        title: "Trauma Specialist & EMDR Therapist",
        specialization: "PTSD & Trauma Recovery",
        bio: "Certified EMDR therapist specializing in complex trauma, PTSD, and childhood adversity. Uses evidence-based approaches for trauma processing and healing. Dr. Washington creates a safe, supportive environment for clients to process difficult experiences and move forward.",
        yearsExperience: 10,
        rating: 5.0,
        email: "e.washington@traumahealing.com",
        phone: "+1 (555) 456-7890",
        imageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily"
    },
    {
        name: "Dr. James Park",
        title: "Marriage & Family Therapist",
        specialization: "Relationships & Communication",
        bio: "Specializing in couples therapy, family dynamics, and communication skills. Helps clients build healthier relationships and resolve conflicts constructively. Dr. Park uses the Gottman Method and other evidence-based approaches to strengthen relationships.",
        yearsExperience: 8,
        rating: 4.7,
        email: "james.park@relationshipcenter.com",
        phone: "+1 (555) 567-8901",
        imageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=James"
    },
    {
        name: "Dr. Priya Patel",
        title: "Licensed Professional Counselor",
        specialization: "General Mental Health & Wellness",
        bio: "Holistic approach to mental health covering stress management, life transitions, self-esteem, and personal growth. Integrates mindfulness, positive psychology, and solution-focused therapy. Dr. Patel helps clients develop resilience and find balance in their lives.",
        yearsExperience: 9,
        rating: 4.9,
        email: "priya.patel@holisticwellness.com",
        phone: "+1 (555) 678-9012",
        imageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya"
    }
];

async function main() {
    console.log('🌱 Seeding therapists...');

    await prisma.therapist.deleteMany({});

    await prisma.therapist.createMany({
        data: therapists,
        skipDuplicates: true,
    });

    console.log(`✅ Created ${therapists.length} therapists!`);
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
