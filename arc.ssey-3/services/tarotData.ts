

import type { TarotCard } from '../types';

const TAROT_BASE_URL = "https://archive.org/download/tarot-de-marseille-noblet-flornoy/";

export const MARSEILLE_DECK: TarotCard[] = [
    { name: "The Fool", imageUrl: `${TAROT_BASE_URL}00-Fool.jpg`, description: "beginnings, innocence, and spontaneity." },
    { name: "The Magician", imageUrl: `${TAROT_BASE_URL}01-Magician.jpg`, description: "willpower, creation, and manifestation." },
    { name: "The High Priestess", imageUrl: `${TAROT_BASE_URL}02-Popess.jpg`, description: "intuition, unconscious knowledge, and mystery." },
    { name: "The Empress", imageUrl: `${TAROT_BASE_URL}03-Empress.jpg`, description: "femininity, beauty, and abundance." },
    { name: "The Emperor", imageUrl: `${TAROT_BASE_URL}04-Emperor.jpg`, description: "authority, structure, and control." },
    { name: "The Pope", imageUrl: `${TAROT_BASE_URL}05-Pope.jpg`, description: "tradition, conformity, and morality." },
    { name: "The Lovers", imageUrl: `${TAROT_BASE_URL}06-Lovers.jpg`, description: "partnerships, duality, and choice." },
    { name: "The Chariot", imageUrl: `${TAROT_BASE_URL}07-Chariot.jpg`, description: "control, willpower, and victory." },
    { name: "Justice", imageUrl: `${TAROT_BASE_URL}08-Justice.jpg`, description: "fairness, truth, and cause and effect." },
    { name: "The Hermit", imageUrl: `${TAROT_BASE_URL}09-Hermit.jpg`, description: "soul-searching, introspection, and guidance." },
    { name: "The Wheel of Fortune", imageUrl: `${TAROT_BASE_URL}10-WheelOfFortune.jpg`, description: "cycles, fate, and turning points." },
    { name: "Strength", imageUrl: `${TAROT_BASE_URL}11-Strength.jpg`, description: "courage, compassion, and focus." },
    { name: "The Hanged Man", imageUrl: `${TAROT_BASE_URL}12-HangedMan.jpg`, description: "suspension, restriction, and new perspectives." },
    { name: "Death", imageUrl: `${TAROT_BASE_URL}13-NamelessArcana.jpg`, description: "endings, change, and transformation." },
    { name: "Temperance", imageUrl: `${TAROT_BASE_URL}14-Temperance.jpg`, description: "balance, moderation, and patience." },
    { name: "The Devil", imageUrl: `${TAROT_BASE_URL}15-Devil.jpg`, description: "addiction, materialism, and bondage." },
    { name: "The Tower", imageUrl: `${TAROT_BASE_URL}16-Tower.jpg`, description: "sudden change, upheaval, and revelation." },
    { name: "The Star", imageUrl: `${TAROT_BASE_URL}17-Star.jpg`, description: "hope, faith, and rejuvenation." },
    { name: "The Moon", imageUrl: `${TAROT_BASE_URL}18-Moon.jpg`, description: "illusion, fear, and the subconscious." },
    { name: "The Sun", imageUrl: `${TAROT_BASE_URL}19-Sun.jpg`, description: "positivity, fun, and success." },
    { name: "Judgement", imageUrl: `${TAROT_BASE_URL}20-Judgement.jpg`, description: "rebirth, inner calling, and absolution." },
    { name: "The World", imageUrl: `${TAROT_BASE_URL}21-World.jpg`, description: "completion, integration, and travel." }
];

export const TAROT_SPREADS = [
    {
        name: "Past, Present, Future",
        positions: [
            { meaning: "The Past" },
            { meaning: "The Present" },
            { meaning: "The Future" }
        ]
    }
];
