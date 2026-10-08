// DEMO DATA — every record here is fictional and clearly labeled in the UI.
// No national statistics are invented; economic figures shown are computed only from these demo records.

export const PROVINCES: Record<string, string[]> = {
  "Kigali City": ["Gasabo", "Kicukiro", "Nyarugenge"],
  Northern: ["Musanze", "Burera", "Gakenke", "Gicumbi", "Rulindo"],
  Southern: [
    "Huye",
    "Muhanga",
    "Nyanza",
    "Kamonyi",
    "Ruhango",
    "Nyamagabe",
    "Nyaruguru",
    "Gisagara",
  ],
  Eastern: ["Rwamagana", "Kayonza", "Nyagatare", "Bugesera", "Gatsibo", "Kirehe", "Ngoma"],
  Western: ["Rubavu", "Karongi", "Rusizi", "Nyamasheke", "Rutsiro", "Ngororero", "Nyabihu"],
};
export const DISTRICTS = Object.values(PROVINCES).flat();

export const SECTORS = [
  "Agriculture",
  "Construction",
  "Manufacturing",
  "Technology",
  "Transport",
  "Tourism",
  "Hospitality",
  "Creative",
  "Finance",
  "Retail",
  "Healthcare",
  "Education",
  "Energy",
  "Mining",
  "Automotive",
  "Professional services",
  "Domestic services",
] as const;
export type Sector = (typeof SECTORS)[number];

export type SkillLevel = "Beginner" | "Intermediate" | "Advanced" | "Expert";
export type Verification = "Self-declared" | "Certificate" | "Assessment" | "Employer" | "Platform";

export const SKILLS: { name: string; sector: Sector }[] = [
  { name: "Masonry", sector: "Construction" },
  { name: "Plumbing", sector: "Construction" },
  { name: "Electrical wiring", sector: "Construction" },
  { name: "Carpentry", sector: "Construction" },
  { name: "Solar installation", sector: "Energy" },
  { name: "Coffee harvesting", sector: "Agriculture" },
  { name: "Greenhouse management", sector: "Agriculture" },
  { name: "Dairy handling", sector: "Agriculture" },
  { name: "React development", sector: "Technology" },
  { name: "Data analysis", sector: "Technology" },
  { name: "Tailoring", sector: "Creative" },
  { name: "Photography", sector: "Creative" },
  { name: "Tour guiding", sector: "Tourism" },
  { name: "Food service", sector: "Hospitality" },
  { name: "Motorcycle mechanics", sector: "Automotive" },
  { name: "Bookkeeping", sector: "Finance" },
  { name: "Truck driving", sector: "Transport" },
  { name: "Nursing assistance", sector: "Healthcare" },
];

export type Rep = {
  completion: number;
  onTime: number;
  repeat: number;
  verifiedProjects: number;
  skillsVerified: number;
  recommendations: number;
  response: number;
};

export type Worker = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarUrl?: string | null;
  title: string;
  district: string;
  sector: Sector;
  rateRwf: number;
  rateUnit: "day" | "hour" | "project";
  available: boolean;
  years: number;
  rating: number;
  reviews: number;
  verified: boolean;
  initials: string;
  avatarUrl?: string | null;
  skills: { name: string; level: SkillLevel; verification: Verification }[];
  bio: string;
  rep: Rep;
  teamIds: string[];
  knownBy?: string;
};

export const WORKERS: Worker[] = [
  {
    id: "w1",
    name: "Jean Bosco Habimana",
    title: "Master mason & site foreman",
    district: "Gasabo",
    sector: "Construction",
    rateRwf: 15000,
    rateUnit: "day",
    available: true,
    years: 11,
    rating: 4.9,
    reviews: 38,
    verified: true,
    initials: "JH",
    skills: [
      { name: "Masonry", level: "Expert", verification: "Employer" },
      { name: "Carpentry", level: "Advanced", verification: "Certificate" },
    ],
    bio: "Leads small crews on residential builds across Kigali. Known for clean finishing and on-time handover.",
    rep: {
      completion: 97,
      onTime: 92,
      repeat: 14,
      verifiedProjects: 31,
      skillsVerified: 2,
      recommendations: 12,
      response: 95,
    },
    teamIds: ["t1"],
    knownBy: "Worked with Aline U.",
  },
  {
    id: "w2",
    name: "Aline Uwase",
    title: "Solar PV technician",
    district: "Rwamagana",
    sector: "Energy",
    rateRwf: 20000,
    rateUnit: "day",
    available: true,
    years: 5,
    rating: 4.8,
    reviews: 21,
    verified: true,
    initials: "AU",
    skills: [
      { name: "Solar installation", level: "Advanced", verification: "Assessment" },
      { name: "Electrical wiring", level: "Advanced", verification: "Certificate" },
    ],
    bio: "Installs off-grid and mini-grid systems for homes, schools and health posts in the Eastern Province.",
    rep: {
      completion: 100,
      onTime: 95,
      repeat: 8,
      verifiedProjects: 19,
      skillsVerified: 2,
      recommendations: 9,
      response: 98,
    },
    teamIds: ["t2"],
  },
  {
    id: "w3",
    name: "Eric Niyonzima",
    title: "Frontend developer",
    district: "Kicukiro",
    sector: "Technology",
    rateRwf: 12000,
    rateUnit: "hour",
    available: false,
    years: 4,
    rating: 4.7,
    reviews: 15,
    verified: true,
    initials: "EN",
    skills: [
      { name: "React development", level: "Advanced", verification: "Assessment" },
      { name: "Data analysis", level: "Intermediate", verification: "Self-declared" },
    ],
    bio: "Builds fast, low-bandwidth web apps for cooperatives and SMEs.",
    rep: {
      completion: 93,
      onTime: 88,
      repeat: 5,
      verifiedProjects: 12,
      skillsVerified: 1,
      recommendations: 6,
      response: 90,
    },
    teamIds: [],
    knownBy: "Recommended by Kigali Digital Hub",
  },
  {
    id: "w4",
    name: "Claudine Mukamana",
    title: "Tailor & fashion designer",
    district: "Huye",
    sector: "Creative",
    rateRwf: 45000,
    rateUnit: "project",
    available: true,
    years: 8,
    rating: 4.9,
    reviews: 44,
    verified: true,
    initials: "CM",
    skills: [{ name: "Tailoring", level: "Expert", verification: "Platform" }],
    bio: "Made-in-Rwanda garments and school uniforms; runs a 4-person workshop.",
    rep: {
      completion: 98,
      onTime: 94,
      repeat: 22,
      verifiedProjects: 40,
      skillsVerified: 1,
      recommendations: 15,
      response: 87,
    },
    teamIds: ["t3"],
  },
  {
    id: "w5",
    name: "Patrick Mugisha",
    title: "Coffee farm supervisor",
    district: "Nyamasheke",
    sector: "Agriculture",
    rateRwf: 6000,
    rateUnit: "day",
    available: true,
    years: 9,
    rating: 4.6,
    reviews: 27,
    verified: false,
    initials: "PM",
    skills: [
      { name: "Coffee harvesting", level: "Expert", verification: "Employer" },
      { name: "Greenhouse management", level: "Beginner", verification: "Self-declared" },
    ],
    bio: "Coordinates seasonal picking crews near Lake Kivu washing stations.",
    rep: {
      completion: 95,
      onTime: 90,
      repeat: 11,
      verifiedProjects: 24,
      skillsVerified: 1,
      recommendations: 7,
      response: 76,
    },
    teamIds: ["t4"],
    knownBy: "Worked with 3 people you know",
  },
  {
    id: "w6",
    name: "Diane Ingabire",
    title: "Tour guide (EN/FR/Kinyarwanda)",
    district: "Musanze",
    sector: "Tourism",
    rateRwf: 30000,
    rateUnit: "day",
    available: true,
    years: 6,
    rating: 4.9,
    reviews: 52,
    verified: true,
    initials: "DI",
    skills: [
      { name: "Tour guiding", level: "Expert", verification: "Certificate" },
      { name: "Photography", level: "Intermediate", verification: "Self-declared" },
    ],
    bio: "Volcanoes region guide, community tourism and birding specialist.",
    rep: {
      completion: 99,
      onTime: 97,
      repeat: 18,
      verifiedProjects: 46,
      skillsVerified: 1,
      recommendations: 20,
      response: 96,
    },
    teamIds: [],
  },
  {
    id: "w7",
    name: "Olivier Hakizimana",
    title: "Motorcycle mechanic",
    district: "Rubavu",
    sector: "Automotive",
    rateRwf: 8000,
    rateUnit: "day",
    available: true,
    years: 7,
    rating: 4.5,
    reviews: 19,
    verified: false,
    initials: "OH",
    skills: [{ name: "Motorcycle mechanics", level: "Advanced", verification: "Self-declared" }],
    bio: "Moto and e-moto maintenance; training apprentices in Gisenyi.",
    rep: {
      completion: 90,
      onTime: 85,
      repeat: 9,
      verifiedProjects: 10,
      skillsVerified: 0,
      recommendations: 4,
      response: 82,
    },
    teamIds: [],
  },
  {
    id: "w8",
    name: "Grace Umutoni",
    title: "Bookkeeper for MSMEs",
    district: "Nyarugenge",
    sector: "Finance",
    rateRwf: 60000,
    rateUnit: "project",
    available: true,
    years: 5,
    rating: 4.8,
    reviews: 23,
    verified: true,
    initials: "GU",
    skills: [
      { name: "Bookkeeping", level: "Advanced", verification: "Certificate" },
      { name: "Data analysis", level: "Intermediate", verification: "Assessment" },
    ],
    bio: "Monthly books, payroll and tax filing support for small businesses.",
    rep: {
      completion: 96,
      onTime: 93,
      repeat: 16,
      verifiedProjects: 28,
      skillsVerified: 2,
      recommendations: 10,
      response: 94,
    },
    teamIds: [],
  },
];

export type Team = {
  id: string;
  name: string;
  leadId: string;
  memberIds: string[];
  sector: Sector;
  areas: string[];
  rating: number;
  projects: number;
  available: boolean;
  summary: string;
  skills: string[];
};
export const TEAMS: Team[] = [
  {
    id: "t1",
    name: "Ubumwe Builders Crew",
    leadId: "w1",
    memberIds: ["w1", "w2"],
    sector: "Construction",
    areas: ["Gasabo", "Kicukiro", "Bugesera"],
    rating: 4.9,
    projects: 23,
    available: true,
    summary: "Six-person residential crew: foundations to finishing, with in-house electrical.",
    skills: ["Masonry", "Carpentry", "Electrical wiring"],
  },
  {
    id: "t2",
    name: "Izuba Solar Team",
    leadId: "w2",
    memberIds: ["w2"],
    sector: "Energy",
    areas: ["Rwamagana", "Kayonza", "Ngoma"],
    rating: 4.8,
    projects: 15,
    available: true,
    summary: "Off-grid installs for schools and health posts.",
    skills: ["Solar installation", "Electrical wiring"],
  },
  {
    id: "t3",
    name: "Huye Stitch Collective",
    leadId: "w4",
    memberIds: ["w4"],
    sector: "Creative",
    areas: ["Huye", "Nyanza", "Gisagara"],
    rating: 4.9,
    projects: 31,
    available: false,
    summary: "Uniform and garment production up to 500 units per month.",
    skills: ["Tailoring"],
  },
  {
    id: "t4",
    name: "Kivu Harvest Crew",
    leadId: "w5",
    memberIds: ["w5"],
    sector: "Agriculture",
    areas: ["Nyamasheke", "Rusizi", "Karongi"],
    rating: 4.6,
    projects: 18,
    available: true,
    summary: "Seasonal coffee picking and sorting crews of 10–40.",
    skills: ["Coffee harvesting"],
  },
];

export type Business = {
  id: string;
  name: string;
  sector: Sector;
  district: string;
  verified: boolean;
  hiring: number;
  rating: number;
  about: string;
  services: string[];
};
export const BUSINESSES: Business[] = [
  {
    id: "b1",
    name: "Inzira Homes Ltd (demo)",
    sector: "Construction",
    district: "Gasabo",
    verified: true,
    hiring: 3,
    rating: 4.7,
    about: "Affordable housing developer.",
    services: ["Residential builds", "Renovation"],
  },
  {
    id: "b2",
    name: "Kivu Hills Coffee Coop (demo)",
    sector: "Agriculture",
    district: "Nyamasheke",
    verified: true,
    hiring: 2,
    rating: 4.8,
    about: "Smallholder cooperative with a washing station.",
    services: ["Washed arabica", "Seasonal work"],
  },
  {
    id: "b3",
    name: "Akagera Lodge Partners (demo)",
    sector: "Hospitality",
    district: "Kayonza",
    verified: true,
    hiring: 1,
    rating: 4.6,
    about: "Eco-lodge near the national park.",
    services: ["Hospitality", "Guided tours"],
  },
  {
    id: "b4",
    name: "Agaciro Digital (demo)",
    sector: "Technology",
    district: "Kicukiro",
    verified: false,
    hiring: 1,
    rating: 4.4,
    about: "Software studio for SMEs.",
    services: ["Web apps", "Data"],
  },
];

export type Opportunity = {
  id: string;
  title: string;
  businessId: string;
  authorType?: "user" | "business";
  createdBy?: string;
  authorName?: string;
  authorAvatarUrl?: string | null;
  sector: Sector;
  district: string;
  type: "Job" | "Project" | "Gig" | "Apprenticeship" | "Seasonal";
  payRwf: number;
  payUnit: "day" | "month" | "project";
  mode: "On-site" | "Remote" | "Hybrid";
  duration: string;
  deadline: string;
  teamAllowed: boolean;
  teamSize?: number;
  skills: string[];
  summary: string;
  responsibilities: string[];
  requirements: string[];
  featured?: boolean;
  posted: string;
};

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: "o1",
    title: "Masonry crew for 4-unit housing block",
    businessId: "b1",
    sector: "Construction",
    district: "Gasabo",
    type: "Project",
    payRwf: 4800000,
    payUnit: "project",
    mode: "On-site",
    duration: "10 weeks",
    deadline: "2026-10-28",
    teamAllowed: true,
    teamSize: 6,
    skills: ["Masonry", "Carpentry"],
    featured: true,
    posted: "2d",
    summary: "Build walls and slabs for a 4-unit affordable block in Kinyinya sector.",
    responsibilities: ["Foundation and wall works", "Daily site reporting", "Safety compliance"],
    requirements: ["3+ years masonry", "Own basic tools", "Team lead with references"],
  },
  {
    id: "o2",
    title: "Seasonal coffee pickers (40 people)",
    businessId: "b2",
    sector: "Agriculture",
    district: "Nyamasheke",
    type: "Seasonal",
    payRwf: 3500,
    payUnit: "day",
    mode: "On-site",
    duration: "8 weeks",
    deadline: "2026-10-20",
    teamAllowed: true,
    teamSize: 40,
    skills: ["Coffee harvesting"],
    featured: true,
    posted: "1d",
    summary:
      "Selective red-cherry picking during main harvest. Paid weekly via mobile money (when available).",
    responsibilities: ["Selective picking", "Sorting at collection point"],
    requirements: ["Ages 18+", "Available full season"],
  },
  {
    id: "o3",
    title: "Solar install for 3 rural schools",
    businessId: "b3",
    sector: "Energy",
    district: "Kayonza",
    type: "Project",
    payRwf: 2100000,
    payUnit: "project",
    mode: "On-site",
    duration: "3 weeks",
    deadline: "2026-11-02",
    teamAllowed: true,
    teamSize: 3,
    skills: ["Solar installation", "Electrical wiring"],
    posted: "4d",
    summary: "Install 5kW systems with battery storage.",
    responsibilities: ["Mounting and wiring", "Commissioning", "User training"],
    requirements: ["Verified solar skill", "Safety certificate"],
  },
  {
    id: "o4",
    title: "React developer – cooperative dashboard",
    businessId: "b4",
    sector: "Technology",
    district: "Kicukiro",
    type: "Job",
    payRwf: 650000,
    payUnit: "month",
    mode: "Hybrid",
    duration: "6 months",
    deadline: "2026-10-25",
    teamAllowed: false,
    skills: ["React development"],
    posted: "3d",
    summary: "Build an offline-friendly dashboard for farmer cooperatives.",
    responsibilities: ["Build UI", "Work with field team"],
    requirements: ["2+ years React", "Portfolio"],
  },
  {
    id: "o5",
    title: "Bilingual tour guide – peak season",
    businessId: "b3",
    sector: "Tourism",
    district: "Kayonza",
    type: "Gig",
    payRwf: 35000,
    payUnit: "day",
    mode: "On-site",
    duration: "6 weeks",
    deadline: "2026-10-30",
    teamAllowed: false,
    skills: ["Tour guiding"],
    posted: "5d",
    summary: "Lead game drives and community walks.",
    responsibilities: ["Guest briefings", "Guided drives"],
    requirements: ["EN + FR", "Guide certificate"],
  },
  {
    id: "o6",
    title: "Tailoring apprenticeship (6 places)",
    businessId: "b1",
    sector: "Creative",
    district: "Huye",
    type: "Apprenticeship",
    payRwf: 40000,
    payUnit: "month",
    mode: "On-site",
    duration: "4 months",
    deadline: "2026-11-10",
    teamAllowed: false,
    skills: ["Tailoring"],
    posted: "1w",
    summary: "Learn garment production with a master tailor. Stipend provided.",
    responsibilities: ["Attend workshop daily", "Complete assessments"],
    requirements: ["Ages 16–30", "No experience needed"],
  },
];

export const COURSES = [
  {
    id: "c1",
    title: "Solar PV Installation Fundamentals",
    provider: "Demo TVET Partner",
    sector: "Energy" as Sector,
    weeks: 6,
    level: "Beginner" as SkillLevel,
    free: true,
    steps: 5,
  },
  {
    id: "c2",
    title: "Safe Site Practices for Construction",
    provider: "Demo Industry Association",
    sector: "Construction" as Sector,
    weeks: 2,
    level: "Beginner" as SkillLevel,
    free: true,
    steps: 4,
  },
  {
    id: "c3",
    title: "Bookkeeping for Small Businesses",
    provider: "Demo Business Academy",
    sector: "Finance" as Sector,
    weeks: 4,
    level: "Intermediate" as SkillLevel,
    free: false,
    steps: 6,
  },
  {
    id: "c4",
    title: "Coffee Quality & Post-Harvest Handling",
    provider: "Demo Coffee Coop",
    sector: "Agriculture" as Sector,
    weeks: 3,
    level: "Beginner" as SkillLevel,
    free: true,
    steps: 4,
  },
];

export const AGRI = {
  supply: [
    {
      id: "s1",
      item: "Irish potatoes",
      qtyKg: 12000,
      district: "Musanze",
      seller: "Demo Musanze Growers Coop",
      priceRwf: 280,
    },
    {
      id: "s2",
      item: "Washed arabica coffee",
      qtyKg: 3000,
      district: "Nyamasheke",
      seller: "Kivu Hills Coffee Coop (demo)",
      priceRwf: 5200,
    },
    {
      id: "s3",
      item: "Maize (dry)",
      qtyKg: 20000,
      district: "Nyagatare",
      seller: "Demo Nyagatare Farmers",
      priceRwf: 350,
    },
  ],
  demand: [
    {
      id: "d1",
      item: "Tomatoes",
      qtyKg: 2000,
      district: "Kigali (Nyarugenge)",
      buyer: "Demo Hotel Group",
      weekly: true,
    },
    {
      id: "d2",
      item: "Fresh milk",
      qtyKg: 5000,
      district: "Gicumbi",
      buyer: "Demo Dairy Processor",
      weekly: true,
    },
    {
      id: "d3",
      item: "Transport: 10t truck",
      qtyKg: 10000,
      district: "Nyagatare → Kigali",
      buyer: "Demo Aggregator",
      weekly: false,
    },
  ],
};

export const rwf = (n: number) => `RWF ${n.toLocaleString("en-US")}`;
export const getWorker = (id: string) => WORKERS.find((w) => w.id === id);
export const getTeam = (id: string) => TEAMS.find((t) => t.id === id);
export const getBusiness = (id: string) => BUSINESSES.find((b) => b.id === id);

export function trustScore(r: Rep) {
  // Weighted composite — rating is intentionally NOT included.
  return Math.round(
    r.completion * 0.25 +
      r.onTime * 0.2 +
      Math.min(r.repeat * 4, 100) * 0.15 +
      Math.min(r.verifiedProjects * 3, 100) * 0.15 +
      Math.min(r.skillsVerified * 40, 100) * 0.1 +
      Math.min(r.recommendations * 6, 100) * 0.1 +
      r.response * 0.05,
  );
}
