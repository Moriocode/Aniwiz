export interface AnimePreset {
  id: number | string;
  title: string;
  romaji: string;
  description: string;
  coverImage: string;
  bannerImage: string;
  format: string;
  season: string;
  year: number;
  totalEpisodes: number;
  genres: string[];
  episodes: {
    number: number;
    title: string;
    runtimeSeconds: number;
    aired: string;
    thumbnail: string;
    synopsis: string;
  }[];
}

export const ANIME_PRESETS: AnimePreset[] = [
  {
    id: 154587,
    title: "Frieren: Beyond Journey's End",
    romaji: "Sousou no Frieren",
    description: "The adventure is over, but life goes on for an elf mage beginning to learn what living is all about. Elf mage Frieren and her fellow heroes defeated the Demon King, bringing peace to the land.",
    coverImage: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80",
    format: "TV Series",
    season: "Fall",
    year: 2023,
    totalEpisodes: 28,
    genres: ["Fantasy", "Adventure", "Drama"],
    episodes: [
      {
        number: 1,
        title: "The Journey's End",
        runtimeSeconds: 1440,
        aired: "Sep 29, 2023",
        thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=80",
        synopsis: "After a ten-year quest, the Hero Party defeats the Demon King and returns to the royal capital to watch the Era Meteor shower."
      },
      {
        number: 2,
        title: "It Didn't Have to Be Magic...",
        runtimeSeconds: 1420,
        aired: "Sep 29, 2023",
        thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80",
        synopsis: "Frieren visits Heiter in the Holy City of the Strahl region and takes on a stubborn young apprentice named Fern."
      },
      {
        number: 3,
        title: "Killing Magic",
        runtimeSeconds: 1435,
        aired: "Sep 29, 2023",
        thumbnail: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80",
        synopsis: "Frieren and Fern travel to a village where Qual, the Elder Sage of Corruption, remains sealed."
      },
      {
        number: 4,
        title: "The Land Where Souls Rest",
        runtimeSeconds: 1410,
        aired: "Sep 29, 2023",
        thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop&q=80",
        synopsis: "Frieren and Fern stop at Eisen's home in the Breg Mountains, where Eisen asks for assistance searching for Flamme's grimoire."
      },
      {
        number: 5,
        title: "Phantoms of the Dead",
        runtimeSeconds: 1450,
        aired: "Oct 6, 2023",
        thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=500&auto=format&fit=crop&q=80",
        synopsis: "In the Riegel Canyon, the pair encounter Einspänner illusions manifesting the forms of those they hold dearest."
      },
      {
        number: 6,
        title: "The Hero of the Village",
        runtimeSeconds: 1430,
        aired: "Oct 13, 2023",
        thumbnail: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&auto=format&fit=crop&q=80",
        synopsis: "Arriving at the fortress city of Wall, Frieren and Fern meet Stark, Eisen's courageous young warrior apprentice."
      }
    ]
  },
  {
    id: 113415,
    title: "Jujutsu Kaisen",
    romaji: "Jujutsu Kaisen",
    description: "A boy swallows a cursed talisman - the finger of a demon - and becomes cursed himself. He enters a shaman's school to be able to locate the demon's other body parts and exorcise himself.",
    coverImage: "https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1600&auto=format&fit=crop&q=80",
    format: "TV Series",
    season: "Fall",
    year: 2020,
    totalEpisodes: 24,
    genres: ["Action", "Supernatural", "Fantasy"],
    episodes: [
      {
        number: 1,
        title: "Ryomen Sukuna",
        runtimeSeconds: 1430,
        aired: "Oct 3, 2020",
        thumbnail: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=500&auto=format&fit=crop&q=80",
        synopsis: "Yuji Itadori is a high schooler who visits his grandfather in the hospital before fateful cursed occurrences strike his high school."
      },
      {
        number: 2,
        title: "For Myself",
        runtimeSeconds: 1420,
        aired: "Oct 10, 2020",
        thumbnail: "https://images.unsplash.com/photo-1563089145-599997674d42?w=500&auto=format&fit=crop&q=80",
        synopsis: "Yuji awakens in a room surrounded by talismans facing Satoru Gojo, who presents him with a grave choice."
      },
      {
        number: 3,
        title: "Girl of Steel",
        runtimeSeconds: 1440,
        aired: "Oct 17, 2020",
        thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=80",
        synopsis: "Yuji and Megumi head to Harajuku to meet up with the third first-year student, Nobara Kugisaki."
      },
      {
        number: 4,
        title: "Curse Womb Must Die",
        runtimeSeconds: 1410,
        aired: "Oct 24, 2020",
        thumbnail: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80",
        synopsis: "The trio is dispatched to a juvenile detention center where a Special Grade cursed womb has materialized."
      }
    ]
  },
  {
    id: 101922,
    title: "Demon Slayer: Kimetsu no Yaiba",
    romaji: "Kimetsu no Yaiba",
    description: "Tanjiro Kamado sets out on a perilous path to avenge his slaughtered family and find a cure for his sister Nezuko, who was transformed into a demon.",
    coverImage: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=80",
    format: "TV Series",
    season: "Spring",
    year: 2019,
    totalEpisodes: 26,
    genres: ["Action", "Historical", "Supernatural"],
    episodes: [
      {
        number: 1,
        title: "Cruelty",
        runtimeSeconds: 1420,
        aired: "Apr 6, 2019",
        thumbnail: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&auto=format&fit=crop&q=80",
        synopsis: "Tanjiro descends the snowy mountain to sell charcoal in town, returning the next morning to tragedy."
      },
      {
        number: 2,
        title: "Trainer Sakonji Urokodaki",
        runtimeSeconds: 1430,
        aired: "Apr 13, 2019",
        thumbnail: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=500&auto=format&fit=crop&q=80",
        synopsis: "Following Giyu Tomioka's advice, Tanjiro and Nezuko head toward Mt. Sagiri to seek out master Urokodaki."
      },
      {
        number: 3,
        title: "Sabito and Makomo",
        runtimeSeconds: 1415,
        aired: "Apr 20, 2019",
        thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80",
        synopsis: "Tanjiro trains relentlessly for over a year until Urokodaki gives him the ultimate test: slicing a massive boulder in two."
      }
    ]
  },
  {
    id: 151807,
    title: "Solo Leveling",
    romaji: "Ore dake Level Up na Ken",
    description: "In a world where hunters must battle deadly monsters to protect humanity, Sung Jinwoo, notoriously known as the weakest hunter of all mankind, finds himself in a mysterious double dungeon.",
    coverImage: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1563089145-599997674d42?w=1600&auto=format&fit=crop&q=80",
    format: "TV Series",
    season: "Winter",
    year: 2024,
    totalEpisodes: 12,
    genres: ["Action", "Adventure", "Fantasy"],
    episodes: [
      {
        number: 1,
        title: "I'm Used to It",
        runtimeSeconds: 1420,
        aired: "Jan 7, 2024",
        thumbnail: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=500&auto=format&fit=crop&q=80",
        synopsis: "Sung Jinwoo accompanies a raid into a D-rank dungeon, where the party stumbles upon an ominous hidden inner sanctuary."
      },
      {
        number: 2,
        title: "If I Had One More Chance",
        runtimeSeconds: 1435,
        aired: "Jan 14, 2024",
        thumbnail: "https://images.unsplash.com/photo-1563089145-599997674d42?w=500&auto=format&fit=crop&q=80",
        synopsis: "Trapped in the Cartenon Temple, the hunters face the brutal commandments of the towering statues."
      },
      {
        number: 3,
        title: "It's Like a Game",
        runtimeSeconds: 1425,
        aired: "Jan 21, 2024",
        thumbnail: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80",
        synopsis: "Jinwoo wakes up in a hospital bed to discover a floating quest notification system visible only to his eyes."
      }
    ]
  }
];
