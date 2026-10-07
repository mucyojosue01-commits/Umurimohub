# UmurimoHub Connect

Build UmurimoHub as a production-quality, premium Rwanda-focused economic opportunity platform, not a simple job board. Core loop: Demand → Opportunity → Trusted People/Teams → Work → Payment → Verified Experience → Reputation → More Opportunities → Business Growth → More Jobs.

Use a premium fintech + modern SaaS + African/Rwandan visual language: deep forest green, charcoal, warm white, restrained accents, spacious layouts, subtle borders/shadows, 16–32px radii, modern sans-serif, Lucide icons, mobile-first, low-bandwidth friendly, accessible, polished enough for government and enterprise but simple enough for farmers, artisans, students and informal workers. Do not copy Bank of Kigali or use its branding/assets.

Build a complete responsive app with public, authentication/onboarding, worker, team, business, training, agriculture, messaging, notifications, payments architecture, admin, and economic-intelligence experiences.

Core features:

- Landing page with “Turn opportunity into work.”, opportunity search, nearby opportunities, trusted networks, teams, skills/training, business opportunities, agriculture, youth/apprenticeships, MSME growth, economic-impact placeholders sourced only from real data later.
- Discover/search across workers, teams, jobs, projects, businesses, services, training and apprenticeships; filters for location, district, sector, skill, price, availability, experience, rating, verification, individual/team, remote/on-site, duration.
- Worker profiles with skills, experience, projects, teams, recommendations, availability, rates, certifications, training, reviews and trust indicators.
- Team profiles with members, combined skills, previous projects, ratings, availability, service areas, portfolio and team history; “Hire Team”.
- Business profiles with verification, services, opportunities, projects, reviews, hiring activity.
- Opportunity pages with requirements, skills, responsibilities, location, payment, schedule, team requirements, deadline, employer reputation, network context, Apply and Apply as Team.
- Project system with timelines, milestones, tasks, assigned workers/teams, payments, documents, progress and reviews.
- Applications: individual, team, referral, direct invitation, previous-worker rehire.
- Powerful referrals/trusted network: worked together, recommended by trusted people, verified professional; privacy-respecting.
- Skills taxonomy across agriculture, construction, manufacturing, technology, transport, tourism, hospitality, creative industries, finance, retail, healthcare, education, energy, mining, automotive, professional/domestic services. Skill levels beginner/intermediate/advanced/expert with self-declared, certificate, assessment, employer/platform verification.
- Training/apprenticeship flow: Learn → Practice → Assessment → Verification → Work.
- First-class agriculture module for farmers, cooperatives, buyers, seasonal workers, transporters, aggregators, processors, input suppliers, including supply offers and market demand.
- Worker dashboard, team leader dashboard, business/MSME dashboard with personalized recommendations.
- Payment architecture: contracts, milestones, payment history, invoices/receipts, future licensed mobile-money/escrow integration; never pretend to be a bank.
- Reputation engine using completion rate, on-time rate, repeat employers, verified projects, skills verified, recommendations, response rate—not rating alone.
- Rwanda geography: province/district/sector/cell, RWF, Rwanda-local conventions; map only where useful.
- Realtime messaging: 1:1, employer-worker, team-employer, project group, file sharing, opportunity/payment references; voice notes later.
- Notifications: matching opportunity, application viewed, invitation, acceptance, milestone payment, certification, recommendation, deadline.
- Security UX: identity/phone/email verification, suspicious activity, sessions, password, 2FA, recovery.
- Admin: users, worker/business/team verification, opportunities, projects, payments, disputes, fraud, analytics, reports, settings.
- Economic intelligence: skills demand/supply, district and sector activity, worker availability, project creation, training demand; use verified platform/authoritative data only.
- Institutional view with strict permissions for workforce planning, skills gaps, youth employment, training demand and MSME support; neutral/data-driven.
- Personalization by role and network. Include “People you know”, “My usual team”, referral graph and recommendation engine based on skills, location, availability, experience, past success, network, team compatibility, employer/worker preferences, pay expectations and project requirements.
- Economic impact metrics per completed project: workers engaged, worker-days, project value, district, sector, completion status, anonymized in aggregate.
- Business model surfaces for business subscriptions, hiring/project tools, enterprise, featured opportunities, partnerships, service/payment fees where appropriate, API/institutional analytics; strong free worker tier.

Create a coherent reusable design system: Button, Input, Select, Search, Modal, Drawer, Card, Badge, Avatar/AvatarGroup, Tabs, Dropdown, Tooltip, Toast, Alert, Table/DataTable, Pagination, Breadcrumb, Timeline, Stepper, Chart, Map, FileUploader, Chat, Rating, ProfileHeader, OpportunityCard, WorkerCard, TeamCard, BusinessCard, ProjectCard. Use tokens for colors, spacing, radius, typography, consistent iconography.

Required routes/screens include at least: landing, about, how-it-works, opportunities, workers, teams, businesses, projects, skills/training, apprenticeships, agriculture, help, pricing/business plans, contact, terms/privacy; login/register/role selection/onboarding/verification/password recovery/2FA; worker dashboard/profile/edit/skills/applications/recommendations/saved/projects/work history/recommendations/teams/messages/notifications/payments/settings; team dashboard/profile/members/opportunities/applications/projects/earnings/settings; business dashboard/profile/workers/opportunities/create opportunity/applications/projects/project management/payments/analytics/settings; training marketplace/course/apprenticeships/assessment/certificates; admin dashboard/users/verifications/opportunity moderation/projects/payments/disputes/fraud/reports/economic intelligence/settings.

Technology: Next.js/React/TypeScript, Tailwind, shadcn/ui or carefully customized components, Lucide, Recharts, Mapbox or suitable maps, React Hook Form, Zod, TanStack Query where appropriate. Modular feature-oriented architecture. Use Supabase for auth/database/storage/realtime if available. Include loading, skeleton, empty, error/retry, accessibility, reduced motion, responsive mobile/desktop layouts and low-bandwidth optimizations.

Seed only clearly labeled demo data using realistic Rwanda locations/names/business examples; NEVER present invented national statistics as real. Make the main flows genuinely usable in the prototype: registration/onboarding, browsing/searching, profiles, opportunity creation/application, team workflow, messaging, notifications, project milestones and dashboard interactions.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8b99dc79-6b45-4b07-829e-148b215e51d7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
