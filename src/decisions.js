const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ---------- Tuning ----------
export const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 30 };
const PERIOD_SHORT = { daily: 'day', weekly: 'wk', monthly: 'mo' };
export const DEFAULT_DAYS_PER_TURN = 1; // each swipe is one day unless a card says otherwise

// Day 1 is a Monday. Weekly flows can land on a set weekday (0 = Mon … 6 = Sun).
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const dayOfWeek = (day) => (day - 1) % 7;
const MON = 0, WED = 2, FRI = 4, SAT = 5;
export const PAYDAY = FRI;
export const STARTING_DEBT = -400;       // you start the game owing this much
export const DEBT_HEALTH_LOSS_PER_WEEK = 2; // health lost each week you're in debt
const COST_OF_LIVING = { label: 'Cost of living', amount: -20, every: 'weekly', weekday: MON };
export const EVENT_CHANCE = 0.25; // chance each turn that a surprise event interrupts the deck

// Sleep & health: SLEEP_THRESHOLD hours of spare time or less means you're under-slept.
export const SLEEP_THRESHOLD = 7;
export const LOW_HEALTH = 50;            // below this: more medical events, worse job odds
const HEALTH_LOSS_PER_WEEK = 2;          // while under-slept
const HEALTH_GAIN_PER_WEEK = 5;          // while rested
const LOW_HEALTH_JOB_PENALTY = 0.15;     // subtracted from job application odds

// Skill-based pay: jobs marked `skillPay` pay base × (PAY_BASE + PAY_PER_SKILL × skills).
// 0 skills = 70% of base, 3 skills = 100%, capped at 150%.
const PAY_BASE = 0.7;
const PAY_PER_SKILL = 0.1;
const PAY_MAX = 1.5;

// Social checks: each social point adds this much to the odds of passing.
const SOCIAL_PER_POINT = 0.08;

export const THERAPY_EVERY = 30; // days between therapy sessions

// Big bills (events marked `big: true`) stay out of the deck for the first
// BIG_EXPENSES_AFTER swipes, so the early game only throws small costs at you.
export const BIG_EXPENSES_AFTER = 20;

export const DOWN_PAYMENT_GOAL = 10000;  // house listings appear once you have this much
const HOUSE_LISTING_CHANCE = 0.5;        // per turn, while saving is done and you're house hunting
export const INCOME_STREAMS_GOAL = 5;
const THIS_YEAR = 2026;

// ---------- Helpers ----------
export const hasJob = (s) => s.flows.some((f) => f.kind === 'job');
export const hasFlag = (s, flag) => s.flags.includes(flag);
export const hasCommitment = (s, id) => s.commitments.some((c) => c.id === id);
export const isUnderSlept = (s) => s.spareTime <= SLEEP_THRESHOLD;
export const isHomeowner = (s) => s.house != null;

// An income stream is a recurring payment from a job, business, investment or side hustle.
// (Allowance and savings like the bike commute don't count.)
export const isIncomeStream = (f) =>
  (f.kind === 'job' || f.kind === 'income') && f.amount > 0 && !f.scheduled;
export const incomeStreams = (s) => s.flows.filter(isIncomeStream).length;
const clampChance = (p) => Math.max(0.05, Math.min(0.95, p));

// Lets a card's `effects` be a plain object or a function of the current stats.
export const resolve = (v, s) => (typeof v === 'function' ? v(s) : v);

export const payMultiplier = (s) => Math.min(PAY_MAX, PAY_BASE + PAY_PER_SKILL * s.skills);
export const skillPay = (amount, s) => Math.round(amount * payMultiplier(s));
export const jobPay = (job, s) => (job.skillPay ? skillPay(job.amount, s) : job.amount);
const socialOdds = (base, s) => clampChance(base + SOCIAL_PER_POINT * s.social);

// Job odds after the low-health penalty. Used for both the card display and the roll.
export function jobChance(apply, s) {
  const penalty = s.health < LOW_HEALTH ? LOW_HEALTH_JOB_PENALTY : 0;
  return clampChance(apply.chance(s) - penalty);
}

// Odds shown on the card's dice for either a job application or a stat check.
export function choiceChance(choice, s) {
  if (choice.apply) return jobChance(choice.apply, s);
  if (choice.check) return clampChance(choice.check.chance(s));
  return null;
}

let flowId = 0;
function makeFlow(def, startDay) {
  // A one-off payment due in N days, e.g. a late bill: { label, amount, inDays: 14 }
  if (def.inDays != null) {
    const due = startDay + def.inDays;
    return { id: ++flowId, label: def.label, kind: null, stat: 'wealth', chance: null, commitmentId: null,
      amount: def.amount, every: 'daily', startDay: due, endDay: due + 1, scheduled: true };
  }
  let start = startDay + (def.afterDays ?? 0);
  // Weekly flows with a weekday wait for the next one, e.g. payday on Friday.
  if (def.every === 'weekly' && def.weekday != null) start += (def.weekday - dayOfWeek(start) + 7) % 7;
  return {
    id: ++flowId,
    label: def.label,
    kind: def.kind ?? null,             // 'job' marks employment
    stat: def.stat ?? 'wealth',         // which stat this flow changes
    chance: def.chance ?? null,         // null = always; otherwise rolled each time it's due
    commitmentId: def.commitmentId ?? null, // removed when that commitment is dropped
    amount: def.amount,                 // + income, - expense
    every: def.every,                   // 'daily' | 'weekly' | 'monthly'
    weekday: def.every === 'weekly' ? dayOfWeek(start) : null,
    startDay: start,
    endDay: def.durationDays ? start + def.durationDays : null, // exclusive
  };
}

// ---------- Starting state ----------
// A random player character: age group, gender and skin tone change every game.
const SKIN_TONES = ['\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];
const CHARACTERS = {
  younger: [
    { base: '🧑', gender: 'person' },
    { base: '👨', gender: 'man' },
    { base: '👩', gender: 'woman' },
  ],
  older: [
    { base: '🧓', gender: 'person' },
    { base: '👴', gender: 'man' },
    { base: '👵', gender: 'woman' },
  ],
};

export function makeCharacter(rng = Math.random) {
  const age = 19 + Math.floor(rng() * 50); // 19–68
  const group = age >= 55 ? CHARACTERS.older : CHARACTERS.younger;
  const c = group[Math.floor(rng() * group.length)];
  const tone = SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)];
  return { emoji: c.base + tone, gender: c.gender, age };
}

export function createInitialStats() {
  const allowance = randomInt(0, 15);
  const flows = [makeFlow(COST_OF_LIVING, 1)];
  if (allowance > 0) {
    flows.unshift(makeFlow({ label: 'Allowance from parents', amount: allowance, every: 'weekly', weekday: WED }, 1));
  }
  return {
    day: 1,
    swipes: 0,          // choices made so far
    wealth: STARTING_DEBT,
    social: randomInt(1, 4),
    spareTime: 24,
    health: 100,
    skills: randomInt(1, 4),
    character: makeCharacter(),
    flows,
    flags: [],          // things the player has learned/unlocked, e.g. 'chainsaw'
    commitments: [],    // ongoing hobbies etc.: { id, label, image, hours, keepPrompt, dropLabel }
    queue: [],          // commitment ids waiting for a "keep or drop?" card (from therapy)
    nextTherapy: null,  // day the next therapy session is due
    house: null,        // the house you bought (see makeHouse)
    usedCards: [],      // one-off cards already seen
    goalsDone: [],
  };
}

// ---------- Goals ----------
// Shown one at a time, in order. Add more here.
export const GOALS = [
  {
    id: 'debt',
    title: 'Pay off your debt',
    hint: `You start ${money(-STARTING_DEBT)} in debt. Every week in debt costs ${DEBT_HEALTH_LOSS_PER_WEEK} health, and you can't recover while you owe money. Get a job and get back to $0.`,
    isDone: (s) => s.wealth >= 0,
    progress: (s) => (s.wealth < 0 ? `${money(-s.wealth)} left` : 'Debt free'),
  },
  {
    id: 'house',
    title: 'Buy a house',
    hint: `Save ${money(DOWN_PAYMENT_GOAL)} for a down payment. Then listings start showing up: cheaper homes cost more each week, pricier ones cost less over time and help your social life.`,
    isDone: (s) => isHomeowner(s),
    progress: (s) => `${money(Math.max(0, s.wealth))} / ${money(DOWN_PAYMENT_GOAL)}`,
  },
  {
    id: 'streams',
    title: `Build ${INCOME_STREAMS_GOAL} income streams`,
    hint: 'Jobs, side hustles, rental income and investments each count as a stream. Watch for opportunities.',
    isDone: (s) => incomeStreams(s) >= INCOME_STREAMS_GOAL,
    progress: (s) => `${incomeStreams(s)} / ${INCOME_STREAMS_GOAL}`,
  },
];

export const currentGoal = (s) => GOALS.find((g) => !s.goalsDone.includes(g.id)) ?? null;

// ---------- Cards ----------
// Card fields:
//   repeatable: can show up more than once (default: one-off)
//   when(stats): only drawn when this returns true
//   days: how many days the turn takes (default 1); a choice can override with its own `days`
//   kicker: label in the card's top-left corner (default: Decision / Job offer / Surprise!)
// Choice fields:
//   effects:   one-time changes, e.g. { wealth: -100, skills: 1 }, or a function of stats
//   recurring: repeating cash flows, e.g. { label: 'Gym', amount: -20, every: 'monthly' }
//   setFlags:  flags to unlock other cards, e.g. ['chainsaw']
//   apply:     a job application; `chance(stats)` is the success probability
//   check:     a dice roll, e.g. a social check:
//              { stat: 'social', chance(stats), success: result | [results], fail: result | [results] }
//              A list of results picks one at random (each may have `when` and `weight`).
//              A result can use any choice field plus `job` (start a job) and `raise` (0.15 = +15% pay).
//   pauseIncome: no job or income-stream payments for the turn (costs still apply)
//   commit:    start an ongoing commitment (hobby, club, pet) that uses spare time every week:
//              { id, label, image, hours, cost: { amount, every }, gains: [{ stat, amount, every,
//                chance?, afterDays? }], keepPrompt?, dropLabel?, dropOutcome? }
//              Therapy sessions let you drop commitments to get the hours back.
const SKIP = { label: 'Skip', outcome: 'You let this one pass.' };

export const DECISIONS = [
  // --- Upskilling ---
  {
    id: 'chainsaw',
    image: '🪚',
    prompt: 'Should I learn how to use a chainsaw?',
    left: {
      label: 'Learn',
      effects: { wealth: -100, skills: 1 },
      setFlags: ['chainsaw'],
      outcome: 'You paid for a safety course. Landscaping jobs are now open to you.',
    },
    right: {
      label: 'Skip',
      effects: { wealth: -10 },
      outcome: 'You skipped it, but the cost of living still ticked on.',
    },
  },
  {
    id: 'study',
    repeatable: true,
    image: '📚',
    prompt: 'Spend this week studying with free online courses?',
    days: 7,
    left: {
      label: 'Study',
      effects: { skills: 1, spareTime: -2 },
      outcome: 'A week of focused study. Your skills went up.',
    },
    right: {
      label: 'Rest',
      effects: { spareTime: 1 },
      outcome: 'You took the week easy.',
    },
  },
  {
    id: 'bootcamp',
    image: '💻',
    prompt: 'Enroll in a 2-week coding bootcamp?',
    when: (s) => !hasJob(s),
    left: {
      label: 'Enroll',
      days: 14,
      effects: { skills: 3, spareTime: -8 },
      recurring: [{ label: 'Coding bootcamp', amount: -25, every: 'daily', durationDays: 14 }],
      setFlags: ['coding'],
      outcome: 'Two intense weeks of code. Developer jobs are now within reach.',
    },
    right: {
      label: 'Skip',
      outcome: 'Too pricey for now.',
    },
  },

  // --- Job applications (only while unemployed) ---
  {
    id: 'apply-supermarket',
    repeatable: true,
    image: '🛒',
    prompt: 'The supermarket is hiring shelf stackers. Apply?',
    when: (s) => !hasJob(s),
    left: {
      label: 'Apply',
      days: 14,
      effects: { wealth: -5 },
      apply: {
        chance: (s) => clampChance(0.3 + 0.1 * s.skills),
        job: { label: 'Supermarket job', amount: 150, every: 'weekly' },
        effects: { spareTime: -10 },
        success: 'You got the supermarket job!',
        fail: 'Two weeks of waiting, then a rejection email.',
      },
    },
    right: SKIP,
  },
  {
    id: 'apply-cafe',
    repeatable: true,
    image: '☕',
    prompt: 'A café down the road needs a barista. Apply?',
    when: (s) => !hasJob(s),
    left: {
      label: 'Apply',
      days: 14,
      effects: { wealth: -5 },
      apply: {
        chance: (s) => clampChance(0.2 + 0.1 * s.skills + 0.05 * s.social),
        job: { label: 'Café job', amount: 120, every: 'weekly' },
        effects: { spareTime: -8, social: 1 },
        success: 'The café hired you. Knowing people helped.',
        fail: 'They went with someone who had more experience.',
      },
    },
    right: SKIP,
  },
  {
    id: 'apply-landscaping',
    repeatable: true,
    image: '🌲',
    prompt: 'A landscaping crew needs someone who can use a chainsaw. Apply?',
    when: (s) => !hasJob(s) && hasFlag(s, 'chainsaw'),
    left: {
      label: 'Apply',
      days: 14,
      effects: { wealth: -5 },
      apply: {
        chance: (s) => clampChance(0.5 + 0.1 * s.skills),
        job: { label: 'Landscaping job', amount: 220, every: 'weekly', skillPay: true },
        effects: { spareTime: -12 },
        success: 'The chainsaw course paid off. You start Monday!',
        fail: 'The crew filled the spot before you heard back.',
      },
    },
    right: SKIP,
  },
  {
    id: 'apply-developer',
    repeatable: true,
    image: '🧑‍💻',
    prompt: 'A startup is hiring a junior developer. Apply?',
    when: (s) => !hasJob(s) && hasFlag(s, 'coding'),
    left: {
      label: 'Apply',
      days: 21,
      effects: { wealth: -5 },
      apply: {
        chance: (s) => clampChance(0.05 + 0.08 * s.skills),
        job: { label: 'Junior developer', amount: 400, every: 'weekly', skillPay: true },
        effects: { spareTime: -12 },
        success: 'You passed the technical interview. Welcome aboard!',
        fail: 'Three rounds of interviews, then a no. More skills would help.',
      },
    },
    right: SKIP,
  },

  // --- Life ---
  {
    id: 'foodbank',
    image: '🥫',
    prompt: 'Sign up for volunteering at the food bank?',
    left: {
      label: 'Yes',
      effects: { social: 2 },
      outcome: 'You met some great people at the food bank.',
    },
    right: {
      label: 'No',
      effects: { spareTime: 1 },
      outcome: 'You kept the evening free for yourself.',
    },
  },
  {
    id: 'gym',
    image: '🏋️',
    prompt: 'Join the local gym, or stay in and subscribe to a streaming service?',
    left: {
      label: 'Gym',
      effects: { social: 1 },
      commit: {
        id: 'gym', label: 'Gym', image: '🏋️', hours: 3,
        cost: { amount: -20, every: 'monthly' },
        gains: [{ stat: 'health', amount: 5, every: 'monthly' }],
        keepPrompt: 'Keep your gym membership?',
      },
      outcome: 'You joined the gym and recognize a few regulars already.',
    },
    right: {
      label: 'Stream',
      effects: { spareTime: 2 },
      recurring: [{ label: 'Streaming service', amount: -15, every: 'monthly' }],
      outcome: 'You signed up for streaming and caught up on a few shows.',
    },
  },
  {
    id: 'bike',
    image: '🚲',
    prompt: 'Sell your old bike for some quick cash?',
    left: {
      label: 'Sell',
      effects: { wealth: 80 },
      outcome: 'Sold! $80 in your pocket.',
    },
    right: {
      label: 'Keep',
      outcome: 'You kept the bike. It might come in handy.',
    },
  },
  {
    id: 'overtime',
    repeatable: true,
    image: '⏰',
    prompt: 'Your manager offers extra shifts this week. Take them?',
    days: 7,
    when: (s) => hasJob(s),
    left: {
      label: 'Take',
      effects: { wealth: 60, spareTime: -4 },
      outcome: 'Long week, but an extra $60.',
    },
    right: {
      label: 'Pass',
      effects: { spareTime: 2 },
      outcome: 'You kept your evenings free.',
    },
  },

  // --- Hobbies & commitments: cost spare time every week, pay off over time ---
  {
    id: 'hobby-guitar',
    kicker: '🎨 Hobby',
    image: '🎸',
    prompt: 'Pick up the guitar? Lessons are $30 a month.',
    left: {
      label: 'Start',
      commit: {
        id: 'guitar', label: 'Guitar', image: '🎸', hours: 3,
        cost: { amount: -30, every: 'monthly' },
        gains: [{ stat: 'skills', amount: 1, every: 'monthly' }],
        keepPrompt: 'Keep up the guitar lessons?',
      },
      outcome: 'Sore fingertips, but you can already play three chords.',
    },
    right: SKIP,
  },
  {
    id: 'hobby-soccer',
    kicker: '🎨 Hobby',
    image: '⚽',
    prompt: 'A pickup soccer group plays every Sunday. Join them?',
    left: {
      label: 'Join',
      commit: {
        id: 'soccer', label: 'Sunday soccer', image: '⚽', hours: 2,
        gains: [
          { stat: 'social', amount: 1, every: 'monthly' },
          { stat: 'health', amount: 5, every: 'monthly' },
        ],
        keepPrompt: 'Keep playing Sunday soccer?',
      },
      outcome: 'You scored once and made a few friends.',
    },
    right: SKIP,
  },
  {
    id: 'hobby-baking',
    kicker: '🎨 Hobby',
    image: '🥖',
    prompt: 'Bake sourdough to sell at the Saturday farmers market?',
    left: {
      label: 'Bake',
      commit: {
        id: 'baking', label: 'Market baking', image: '🥖', hours: 5,
        cost: { amount: -10, every: 'weekly' },
        gains: [{ stat: 'wealth', amount: 35, every: 'weekly', weekday: SAT, kind: 'income' }],
        keepPrompt: 'Keep baking for the market?',
      },
      outcome: 'Your first loaves sold out by 10 a.m.',
    },
    right: SKIP,
  },
  {
    id: 'volunteer-oldfolks',
    image: '👵',
    prompt: 'The old folks home needs weekend volunteers. Sign up?',
    left: {
      label: 'Sign up',
      commit: {
        id: 'oldfolks', label: 'Volunteering', image: '👵', hours: 5,
        gains: [
          { stat: 'social', amount: 1, every: 'weekly', chance: 0.35 },
          { stat: 'wealth', amount: 50, every: 'monthly', chance: 0.3 },
        ],
        keepPrompt: 'Keep volunteering at the old folks home?',
      },
      outcome: 'The residents have great stories, and their families notice who shows up.',
    },
    right: { label: 'No', outcome: 'Maybe another time.' },
  },
  {
    id: 'book-club',
    image: '📖',
    prompt: 'A neighbor invites you to their monthly book club. Join?',
    left: {
      label: 'Join',
      commit: {
        id: 'bookclub', label: 'Book club', image: '📖', hours: 3,
        cost: { amount: -12, every: 'monthly' },
        gains: [
          { stat: 'social', amount: 1, every: 'monthly' },
          { stat: 'skills', amount: 1, every: 'monthly', afterDays: 60 },
        ],
        keepPrompt: 'Stay in the book club?',
      },
      outcome: 'Lots of reading, but the discussions are worth it.',
    },
    right: SKIP,
  },
  {
    id: 'therapy-signup',
    image: '🛋️',
    prompt: 'Your week is filling up. Start seeing a therapist once a month?',
    when: (s) => s.commitments.length >= 2 && !hasCommitment(s, 'therapy'),
    left: {
      label: 'Book it',
      effects: { health: 5 },
      commit: {
        id: 'therapy', label: 'Therapy', image: '🛋️', hours: 1,
        cost: { amount: -40, every: 'monthly' },
        keepPrompt: 'Keep seeing your therapist?',
        dropLabel: 'Stop',
      },
      outcome: 'Good first session. Each month you can review your commitments and drop some.',
    },
    right: { label: 'Not now', outcome: 'You will manage on your own for now.' },
  },
];

// Monthly therapy session: drawn automatically when it's due.
const THERAPY_SESSION = {
  id: 'therapy-session',
  therapy: true,
  repeatable: true,
  kicker: '🛋️ Monthly',
  image: '🛋️',
  days: 1,
  prompt: 'Therapy day. Want to go through your commitments and drop some?',
  left: {
    label: 'Reassess',
    reassess: true,
    outcome: 'You talked through everything on your plate. Time to decide what stays.',
  },
  right: {
    label: 'Just talk',
    effects: { health: 5 },
    outcome: 'A good chat. You feel lighter.',
  },
};

// One "keep or drop?" card per commitment, queued by a therapy session.
export function reassessCard(c) {
  return {
    id: `reassess-${c.id}`,
    queued: true,
    repeatable: true,
    kicker: '🛋️ Reassess',
    image: c.image,
    days: 0,
    prompt: c.keepPrompt ?? `Keep up ${c.label.toLowerCase()}?`,
    left: {
      label: c.dropLabel ?? 'Drop',
      drop: c.id,
      effects: { spareTime: c.hours },
      outcome: c.dropOutcome ?? `You let go of ${c.label.toLowerCase()} and got ${c.hours}h of spare time back.`,
    },
    right: { label: 'Keep', outcome: `${c.label} stays.` },
  };
}

// ---------- Surprise events ----------
// Same shape as cards, but they interrupt the deck at random (EVENT_CHANCE per turn).
// Events are repeatable unless `once: true`. `big: true` events wait until
// BIG_EXPENSES_AFTER swipes have passed.
export const EVENTS = [
  {
    id: 'medical-bill',
    big: true,
    weight: (s) => (s.health < LOW_HEALTH ? 4 : 1), // much likelier when run down
    image: '🏥',
    prompt: 'You sprained your ankle. The clinic sends a $180 bill.',
    left: {
      label: 'Pay now',
      effects: { wealth: -180 },
      outcome: 'Paid in full. Ouch, in more ways than one.',
    },
    right: {
      label: 'Payment plan',
      recurring: [{ label: 'Medical payment plan', amount: -20, every: 'weekly', durationDays: 70 }],
      outcome: 'You set up a payment plan: $20 a week for 10 weeks ($200 in total).',
    },
  },
  {
    id: 'utility-bill',
    image: '💡',
    prompt: 'Your power bill came in much higher than usual: $70.',
    left: {
      label: 'Pay now',
      effects: { wealth: -70 },
      outcome: 'Bill paid. Maybe turn the heater down a bit.',
    },
    right: {
      label: 'Pay late',
      recurring: [{ label: 'Late power bill', amount: -90, inDays: 14 }],
      outcome: 'You pushed it back two weeks. A $20 late fee is coming with it.',
    },
  },
  {
    id: 'phone-broken',
    big: true,
    image: '📱',
    prompt: 'You dropped your phone and the screen shattered.',
    left: {
      label: 'Repair',
      effects: { wealth: -120 },
      outcome: 'Good as new, for $120.',
    },
    right: {
      label: 'Live with it',
      effects: { social: -1 },
      outcome: 'You keep missing messages through the cracks.',
    },
  },
  {
    id: 'dentist',
    big: true,
    image: '🦷',
    prompt: 'A nagging toothache. The dentist quotes $250.',
    left: {
      label: 'Treat it',
      effects: { wealth: -250 },
      outcome: 'Fixed. Expensive, but the pain is gone.',
    },
    right: {
      label: 'Ignore it',
      effects: { spareTime: -3 },
      recurring: [{ label: 'Painkillers', amount: -5, every: 'weekly', durationDays: 56 }],
      outcome: 'Painkillers for now. It is hard to relax.',
    },
  },
  {
    id: 'rent-increase',
    big: true,
    once: true,
    image: '🏠',
    prompt: 'Your landlord is raising the rent by $10 a week.',
    when: (s) => hasJob(s) && !isHomeowner(s),
    left: {
      label: 'Accept',
      recurring: [{ label: 'Rent increase', amount: -10, every: 'weekly' }],
      outcome: 'You signed the new lease.',
    },
    right: {
      label: 'Move out',
      effects: { wealth: -150, spareTime: -4 },
      outcome: 'Moving cost $150 and a weekend, but your rent stays the same.',
    },
  },
  {
    id: 'wedding',
    big: true,
    once: true,
    image: '💍',
    prompt: 'Your cousin is getting married out of state. Travel and a gift come to $150.',
    left: {
      label: 'Go',
      effects: { wealth: -150, social: 2 },
      outcome: 'You danced all night and caught up with the whole family.',
    },
    right: {
      label: 'Send a card',
      effects: { wealth: -20, social: -1 },
      outcome: 'Family noticed you were not there.',
    },
  },

  // --- Small everyday costs (common early on) ---
  {
    id: 'parking-ticket',
    image: '🅿️',
    prompt: 'You got a $30 parking ticket.',
    left: {
      label: 'Pay it',
      effects: { wealth: -30 },
      outcome: 'Paid. Lesson learned about street cleaning day.',
    },
    right: {
      label: 'Contest it',
      check: {
        chance: () => 0.4,
        success: { outcome: 'The sign was hidden behind a tree. Ticket dismissed.' },
        fail: {
          effects: { wealth: -45 },
          outcome: 'Contest denied, with a $15 admin fee on top.',
        },
      },
    },
  },
  {
    id: 'charger',
    image: '🔌',
    prompt: 'Your phone charger died. A new one is $25.',
    left: {
      label: 'Buy one',
      effects: { wealth: -25 },
      outcome: 'Fully charged again.',
    },
    right: {
      label: 'Borrow',
      effects: { social: -1 },
      outcome: 'Your roommate is getting tired of lending theirs.',
    },
  },
  {
    id: 'birthday-gift',
    image: '🎁',
    prompt: 'It is a friend\'s birthday this weekend. Chip in $20 for a group gift?',
    left: {
      label: 'Chip in',
      effects: { wealth: -20, social: 1 },
      outcome: 'They loved it. Your name was on the card.',
    },
    right: {
      label: 'Skip',
      effects: { social: -1 },
      outcome: 'You sent a text instead.',
    },
  },
  {
    id: 'retreat',
    weight: (s) => (s.health < LOW_HEALTH ? 1.5 : 0.5), // occasional; likelier when run down
    kicker: '🧘 Retreat',
    image: '🏕️',
    prompt: 'A week-long wellness retreat has an open spot for $50. Unplug and recharge?',
    left: {
      label: 'Go',
      days: 7,
      effects: { wealth: -50, health: 25 },
      pauseIncome: true,
      outcome: 'A week of hikes, naps and no phone. You came back recharged, but missed a week of pay.',
    },
    right: { label: 'Not now', outcome: 'You kept working.' },
  },
  {
    id: 'tax-refund',
    image: '🧾',
    prompt: 'Good news: a $60 tax refund landed in your account.',
    left: {
      label: 'Save it',
      effects: { wealth: 60 },
      outcome: 'Straight into savings.',
    },
    right: {
      label: 'Treat yourself',
      effects: { wealth: 20, social: 1 },
      outcome: 'You spent $40 on dinner with friends and kept the rest.',
    },
  },

  // --- Social checks ---
  {
    id: 'party',
    image: '🎉',
    prompt: 'A friend invites you to a party across town.',
    left: {
      label: 'Go',
      effects: { wealth: -15 },
      check: {
        stat: 'social',
        chance: (s) => socialOdds(0.2, s),
        success: [
          {
            when: (s) => !hasJob(s),
            job: { label: 'Job from a party contact', amount: 180, every: 'weekly' },
            effects: { spareTime: -10 },
            outcome: 'You hit it off with a manager who is hiring. You start next week!',
          },
          {
            effects: { skills: 1, social: 1 },
            outcome: 'A designer at the party showed you a few tricks. +1 skill.',
          },
          {
            when: (s) => !hasFlag(s, 'gift-bike'),
            setFlags: ['gift-bike'],
            recurring: [{ label: 'Bike commute savings', amount: 10, every: 'weekly' }],
            outcome: 'A new friend gave you their old bike. No more bus fares.',
          },
        ],
        fail: { outcome: 'You spent most of the night by the snack table.' },
      },
    },
    right: { label: 'Stay in', outcome: 'A quiet night in.' },
  },
  {
    id: 'yard-sale',
    image: '🏷️',
    prompt: 'There is a yard sale down the street this weekend. Check it out?',
    left: {
      label: 'Browse',
      check: {
        stat: 'social',
        chance: (s) => socialOdds(0.15, s),
        success: {
          effects: { wealth: 300 },
          outcome: 'You got chatting with the seller, who let you dig through the attic: a crate of rare first-press records. A collector paid $300.',
        },
        fail: {
          effects: { wealth: 15 },
          outcome: 'You found a vintage lamp and flipped it for $15.',
        },
      },
    },
    right: SKIP,
  },
  {
    id: 'stray-cat',
    image: '🐈',
    prompt: 'A stray cat keeps showing up at your door. Take it in?',
    when: (s) => !hasCommitment(s, 'cat'),
    left: {
      label: 'Adopt',
      effects: { wealth: -40 },
      commit: {
        id: 'cat', label: 'Cat', image: '🐈', hours: 2,
        cost: { amount: -12, every: 'weekly' },
        gains: [
          { stat: 'social', amount: 1, every: 'monthly', afterDays: 30 },
          { stat: 'skills', amount: 1, every: 'monthly', afterDays: 60 },
        ],
        keepPrompt: 'Find your cat a loving new home?',
        dropLabel: 'Rehome',
        dropOutcome: 'A friend gave your cat a loving new home. You got 2h of spare time back.',
      },
      outcome: 'A $40 vet checkup, and now you have a roommate who purrs.',
    },
    right: { label: 'Shoo', outcome: 'It wandered off down the street.' },
  },
  {
    id: 'networking-mixer',
    image: '🤝',
    prompt: 'A local industry mixer has $20 tickets. Go?',
    left: {
      label: 'Go',
      effects: { wealth: -20 },
      check: {
        stat: 'social',
        chance: (s) => socialOdds(0.15, s),
        success: [
          {
            when: (s) => !hasJob(s),
            job: { label: 'Job from the mixer', amount: 200, every: 'weekly', skillPay: true },
            effects: { spareTime: -10 },
            outcome: 'A founder liked your pitch and offered you a job. Pay depends on your skills.',
          },
          {
            effects: { skills: 1 },
            outcome: 'A mentor offered to review your work. +1 skill.',
          },
        ],
        fail: { outcome: 'Lots of business cards, no real conversations.' },
      },
    },
    right: SKIP,
  },
  {
    id: 'help-move',
    image: '📦',
    prompt: 'Your neighbor asks for help moving on Saturday.',
    left: {
      label: 'Help',
      check: {
        chance: () => 0.5,
        success: {
          effects: { wealth: 40, social: 1, health: -5 },
          outcome: 'They insisted on paying you $40 and buying pizza.',
        },
        fail: {
          effects: { social: 1, health: -5 },
          outcome: 'A sore back, but a grateful neighbor.',
        },
      },
    },
    right: { label: 'Make excuses', outcome: 'You were suddenly very busy that day.' },
  },
  {
    id: 'found-wallet',
    once: true,
    image: '👛',
    prompt: 'You found a wallet on the sidewalk with $60 cash inside.',
    left: {
      label: 'Return it',
      check: {
        chance: () => 0.5,
        success: {
          effects: { wealth: 40, social: 1 },
          outcome: 'The owner was so relieved they gave you a $40 reward.',
        },
        fail: {
          effects: { social: 1 },
          outcome: 'The owner was thrilled. Good karma.',
        },
      },
    },
    right: {
      label: 'Keep the cash',
      effects: { wealth: 60, social: -1 },
      outcome: '$60 richer, but word gets around.',
    },
  },
  {
    id: 'trivia-night',
    image: '🧠',
    prompt: 'Coworkers invite you to pub trivia. It is $15 to enter.',
    when: (s) => hasJob(s),
    left: {
      label: 'Join',
      effects: { wealth: -15 },
      check: {
        stat: 'skills',
        chance: (s) => clampChance(0.15 + 0.07 * s.skills),
        success: {
          effects: { wealth: 100, social: 1 },
          outcome: 'Your team won! Your share of the prize was $100.',
        },
        fail: {
          effects: { social: 1 },
          outcome: 'Fourth place, but a fun night with the team.',
        },
      },
    },
    right: { label: 'Pass', outcome: 'You headed home instead.' },
  },
  {
    id: 'freelance-gig',
    image: '🧰',
    prompt: 'Someone needs a quick freelance project done. The pay depends on your skills.',
    when: (s) => s.skills >= 2,
    left: {
      label: 'Take it',
      effects: (s) => ({ wealth: skillPay(150, s), health: -5 }),
      outcome: 'Late nights, but the client paid on delivery.',
    },
    right: { label: 'Pass', outcome: 'You kept your week clear.' },
  },
  {
    id: 'performance-review',
    weight: () => 0.5,
    image: '📈',
    prompt: 'It is review season. Ask your manager for a raise?',
    when: (s) => hasJob(s),
    left: {
      label: 'Ask',
      check: {
        stat: 'skills',
        chance: (s) => clampChance(0.15 + 0.07 * s.skills + 0.03 * s.social),
        success: { raise: 0.15, outcome: 'Your manager agreed: a 15% raise!' },
        fail: { outcome: 'Not this year. Build your skills and try again.' },
      },
    },
    right: { label: 'Stay quiet', outcome: 'Maybe next review.' },
  },
  {
    id: 'friend-loan',
    image: '💸',
    prompt: 'An old friend asks to borrow $100 until next month.',
    left: {
      label: 'Lend it',
      effects: { wealth: -100 },
      check: {
        chance: (s) => socialOdds(0.5, s),
        success: {
          recurring: [{ label: 'Loan repaid', amount: 110, inDays: 30 }],
          outcome: 'They promised to pay you back $110 next month, with a thank-you.',
        },
        fail: {
          effects: { social: 1 },
          outcome: 'They went quiet. The money is gone, but they owe you one.',
        },
      },
    },
    right: {
      label: 'Say no',
      effects: { social: -1 },
      outcome: 'Things are a little awkward between you now.',
    },
  },
  {
    id: 'flu',
    weight: (s) => (s.health < LOW_HEALTH ? 3 : 1),
    image: '🤒',
    prompt: 'You have come down with the flu.',
    left: {
      label: 'Rest',
      days: 10,
      effects: { health: 15, social: -1 },
      outcome: 'Ten days in bed. You missed some plans but feel much better.',
    },
    right: {
      label: 'Push through',
      effects: { health: -15 },
      outcome: 'You kept going and feel worse for it.',
    },
  },
  {
    id: 'vet-bill',
    big: true,
    image: '🐾',
    prompt: 'Your cat swallowed a hair tie. The vet bill is $160.',
    when: (s) => hasCommitment(s, 'cat'),
    left: {
      label: 'Pay now',
      effects: { wealth: -160 },
      outcome: 'Your cat is fine, and back to knocking things off shelves.',
    },
    right: {
      label: 'Payment plan',
      recurring: [{ label: 'Vet payment plan', amount: -20, every: 'weekly', durationDays: 63 }],
      outcome: 'The vet set up a plan: $20 a week for 9 weeks ($180 in total).',
    },
  },

  // --- Opportunities: investments and side hustles that open an income stream ---
  {
    id: 'pizza-shop',
    once: true,
    kicker: '💼 Opportunity',
    image: '🍕',
    prompt: 'A friend wants $1,000 to help open a pizza shop, for a cut of the profits.',
    when: (s) => s.wealth >= 1000,
    left: {
      label: 'Invest',
      effects: { wealth: -1000 },
      check: {
        chance: () => 0.45,
        success: {
          recurring: [{ label: 'Pizza shop', amount: 100, every: 'weekly', kind: 'income', afterDays: 30 }],
          outcome: 'Lines around the block on opening night. Your $100/wk cut starts next month.',
        },
        fail: { outcome: 'The shop closed after three months. The $1,000 is gone.' },
      },
    },
    right: { label: 'Pass', outcome: 'You wished them luck.' },
  },
  {
    id: 'index-fund',
    once: true,
    kicker: '💼 Opportunity',
    image: '📊',
    prompt: 'Put $2,000 into a low-cost index fund? Slow, steady dividends.',
    when: (s) => s.wealth >= 2000,
    left: {
      label: 'Invest',
      effects: { wealth: -2000 },
      recurring: [{ label: 'Index fund dividends', amount: 15, every: 'weekly', kind: 'income' }],
      outcome: 'Boring, reliable, and paying you every week.',
    },
    right: { label: 'Not now', outcome: 'You kept your cash on hand.' },
  },
  {
    id: 'vending-machine',
    once: true,
    kicker: '💼 Opportunity',
    image: '🥤',
    prompt: 'A laundromat owner will rent you a corner for a vending machine. It costs $800.',
    when: (s) => s.wealth >= 800,
    left: {
      label: 'Buy one',
      effects: { wealth: -800 },
      check: {
        chance: () => 0.6,
        success: {
          recurring: [{ label: 'Vending machine', amount: 40, every: 'weekly', kind: 'income' }],
          outcome: 'Snacks sell themselves. +$40/wk.',
        },
        fail: { outcome: 'Someone broke into the machine in week two. It is gone.' },
      },
    },
    right: { label: 'Pass', outcome: 'You let someone else have the corner.' },
  },
  {
    id: 'food-truck',
    once: true,
    kicker: '💼 Opportunity',
    image: '🚚',
    prompt: 'Two friends are buying a food truck and need a $3,000 partner.',
    when: (s) => s.wealth >= 3000,
    left: {
      label: 'Partner up',
      effects: { wealth: -3000 },
      check: {
        stat: 'social',
        chance: (s) => socialOdds(0.35, s),
        success: {
          recurring: [{ label: 'Food truck', amount: 180, every: 'weekly', kind: 'income', afterDays: 14 }],
          effects: { social: 1 },
          outcome: 'Your network showed up for launch week. +$180/wk from your share.',
        },
        fail: { outcome: 'Permits and repairs ate the budget. The truck was sold at a loss.' },
      },
    },
    right: { label: 'Pass', outcome: 'You will eat there as a customer instead.' },
  },
  {
    id: 'startup-angel',
    once: true,
    kicker: '💼 Opportunity',
    image: '🚀',
    prompt: 'A former classmate is raising money for an app. Invest $1,500?',
    when: (s) => s.wealth >= 1500,
    left: {
      label: 'Invest',
      effects: { wealth: -1500 },
      check: {
        chance: (s) => clampChance(0.15 + 0.03 * s.skills),
        success: {
          recurring: [{ label: 'Startup profit share', amount: 300, every: 'weekly', kind: 'income', afterDays: 60 }],
          outcome: 'The app took off. Your profit share of $300/wk starts in two months.',
        },
        fail: { outcome: 'The app never found users. The money is gone.' },
      },
    },
    right: { label: 'Pass', outcome: 'Too risky for you.' },
  },
  {
    id: 'rent-room',
    kicker: '💼 Opportunity',
    image: '🛏️',
    prompt: 'A coworker needs a place to stay. Rent them your spare room for $90 a week?',
    when: (s) => isHomeowner(s) && s.house.beds >= 2 && !hasFlag(s, 'roommate'),
    left: {
      label: 'Rent it',
      setFlags: ['roommate'],
      effects: { social: 1 },
      recurring: [{ label: 'Room rental', amount: 90, every: 'weekly', kind: 'income' }],
      outcome: 'Your new roommate is easy to live with, and pays on time.',
    },
    right: { label: 'Keep it', outcome: 'You like having the place to yourself.' },
  },
  {
    id: 'guitar-gigs',
    kicker: '💼 Side hustle',
    image: '🎤',
    prompt: 'A bar heard you play guitar. Want a weekend gig for $50 a night?',
    when: (s) => hasCommitment(s, 'guitar') && s.skills >= 3 && !hasCommitment(s, 'gigs'),
    left: {
      label: 'Play',
      commit: {
        id: 'gigs', label: 'Weekend gigs', image: '🎤', hours: 3,
        gains: [
          { stat: 'wealth', amount: 50, every: 'weekly', weekday: SAT, kind: 'income' },
          { stat: 'social', amount: 1, every: 'monthly' },
        ],
        keepPrompt: 'Keep playing weekend gigs?',
      },
      outcome: 'Your first set went over well. The bar booked you every weekend.',
    },
    right: { label: 'Not yet', outcome: 'You want to practice more first.' },
  },
  {
    id: 'dog-walking',
    kicker: '💼 Side hustle',
    image: '🐕',
    prompt: 'Neighbors keep asking if you can walk their dogs. Make it a side hustle?',
    when: (s) => !hasCommitment(s, 'dogs'),
    left: {
      label: 'Start',
      commit: {
        id: 'dogs', label: 'Dog walking', image: '🐕', hours: 4,
        gains: [
          { stat: 'wealth', amount: 60, every: 'weekly', kind: 'income' },
          { stat: 'health', amount: 5, every: 'monthly' },
        ],
        keepPrompt: 'Keep walking dogs?',
      },
      outcome: 'Five dogs, two leashes each hand. +$60/wk and plenty of fresh air.',
    },
    right: { label: 'No thanks', outcome: 'You are more of a cat person.' },
  },
  {
    id: 'online-course',
    kicker: '💼 Side hustle',
    image: '🎓',
    prompt: 'You know enough to teach. Record an online course and sell it?',
    when: (s) => s.skills >= 5 && !hasCommitment(s, 'course'),
    left: {
      label: 'Record it',
      commit: {
        id: 'course', label: 'Online course', image: '🎓', hours: 3,
        gains: [{ stat: 'wealth', amount: 70, every: 'weekly', kind: 'income' }],
        keepPrompt: 'Keep updating and promoting your course?',
      },
      outcome: 'Your course is live. Students sign up while you sleep.',
    },
    right: { label: 'Not now', outcome: 'Maybe once you know even more.' },
  },

  // --- Homeowner repairs: likelier in old houses with low inspection scores ---
  {
    id: 'water-heater',
    big: true,
    image: '🚿',
    prompt: 'Cold showers: your water heater gave out. A plumber quotes $1,200.',
    when: (s) => isHomeowner(s),
    weight: (s) => houseRepairWeight(s),
    left: {
      label: 'Replace',
      effects: { wealth: -1200 },
      outcome: 'Hot water again, and a newer, more efficient tank.',
    },
    right: {
      label: 'Payment plan',
      recurring: [{ label: 'Water heater plan', amount: -60, every: 'weekly', durationDays: 168 }],
      outcome: 'Financed: $60 a week for 24 weeks ($1,440 in total).',
    },
  },
  {
    id: 'roof-leak',
    big: true,
    image: '🌧️',
    prompt: 'The roof is leaking into the upstairs bedroom. Repairs are $2,500.',
    when: (s) => isHomeowner(s),
    weight: (s) => houseRepairWeight(s),
    left: {
      label: 'Fix it',
      effects: { wealth: -2500 },
      outcome: 'New flashing and shingles. Dry again.',
    },
    right: {
      label: 'Patch it',
      effects: { wealth: -400, health: -5 },
      recurring: [{ label: 'Damp repairs', amount: -25, every: 'weekly', durationDays: 84 }],
      outcome: 'A cheap patch for now. The damp keeps costing you.',
    },
  },
].map((e) => ({ ...e, event: true, repeatable: !e.once }));

// Repairs mostly hit old houses that inspected poorly.
function houseRepairWeight(s) {
  const h = s.house;
  const age = THIS_YEAR - h.year;
  return 0.2 + (100 - h.inspection) / 25 + age / 80;
}

// ---------- Houses ----------
// Listings are generated from these templates. Eras, bedroom counts and heating
// types follow common US housing stock. Heating costs are rough annual US
// averages by fuel (natural gas and heat pumps cheapest, heating oil and
// electric baseboard dearest), divided by 52.
const HEATING = {
  'Natural gas furnace': 16,
  'Gas steam boiler': 21,
  'Heat pump': 14,
  'Heating oil': 38,
  'Electric baseboard': 33,
  Propane: 29,
};

const HOUSE_TYPES = [
  { type: 'Brownstone', image: '🧱', years: [1875, 1910], beds: [3, 4], down: [9000, 10000],
    inspection: [65, 90], heating: ['Gas steam boiler', 'Natural gas furnace'], social: 2,
    blurb: 'walkable street, close to cafés' },
  { type: 'Colonial', image: '🏛️', years: [1900, 1990], beds: [3, 4], down: [8000, 9500],
    inspection: [60, 88], heating: ['Heating oil', 'Natural gas furnace'], social: 1,
    blurb: 'quiet neighborhood with block parties' },
  { type: 'Ranch', image: '🏡', years: [1950, 1978], beds: [2, 3], down: [6500, 8000],
    inspection: [55, 82], heating: ['Natural gas furnace', 'Electric baseboard', 'Propane'], social: 0,
    blurb: 'one floor, big yard, far from town' },
  { type: 'Cape Cod', image: '🏠', years: [1930, 1960], beds: [2, 3], down: [6000, 7500],
    inspection: [48, 75], heating: ['Heating oil', 'Electric baseboard'], social: 0,
    blurb: 'cozy, with a steep roof and small rooms' },
  { type: 'Duplex', image: '🏘️', years: [1910, 1970], beds: [2, 3], down: [7500, 9500],
    inspection: [45, 78], heating: ['Heating oil', 'Natural gas furnace', 'Electric baseboard'], social: 0,
    rent: [90, 130], blurb: 'live in one unit, rent out the other' },
  { type: 'Townhouse', image: '🏙️', years: [1990, 2022], beds: [2, 3], down: [8500, 10000],
    inspection: [85, 98], heating: ['Heat pump', 'Natural gas furnace'], social: 1, hoa: 15,
    blurb: 'shared courtyard, friendly neighbors' },
  { type: 'New build', image: '🏗️', years: [2018, 2025], beds: [3, 4], down: [9500, 10000],
    inspection: [93, 100], heating: ['Heat pump'], social: 1,
    blurb: 'energy efficient, nothing to fix yet' },
];

const between = ([min, max], rng) => min + Math.floor(rng() * (max - min + 1));
const roundTo = (v, step) => Math.round(v / step) * step;

// Builds one random listing. Cheap, old, poorly inspected homes cost more each
// week (heating, upkeep) and break more often; pricier homes cost less over time.
export function makeHouse(rng = Math.random) {
  const t = HOUSE_TYPES[Math.floor(rng() * HOUSE_TYPES.length)];
  const year = between(t.years, rng);
  const beds = between(t.beds, rng);
  const inspection = between(t.inspection, rng);
  const heating = t.heating[Math.floor(rng() * t.heating.length)];
  const down = roundTo(between(t.down, rng), 100);
  const age = THIS_YEAR - year;
  const mortgage = Math.round(down * 0.005);
  const utilities = HEATING[heating] + 25 + 5 * beds;
  const upkeep = Math.round((100 - inspection) * 0.5 + age / 15) + (t.hoa ?? 0);
  return {
    type: t.type,
    image: t.image,
    blurb: t.blurb,
    year,
    beds,
    inspection,
    heating,
    down,
    mortgage,
    utilities,
    upkeep,
    weekly: mortgage + utilities + upkeep,
    social: t.social,
    rent: t.rent ? roundTo(between(t.rent, rng), 5) : 0,
  };
}

// A swipe card for one listing.
export function houseCard(h) {
  const left = {
    label: 'Buy',
    effects: { wealth: -h.down, ...(h.social ? { social: h.social } : {}) },
    recurring: [
      { label: 'Housing costs', amount: -h.weekly, every: 'weekly' },
      ...(h.rent ? [{ label: 'Duplex rent', amount: h.rent, every: 'weekly', kind: 'income' }] : []),
    ],
    house: h,
    outcome: `You got the keys to your ${h.type.toLowerCase()}! ${h.blurb[0].toUpperCase()}${h.blurb.slice(1)}.`,
  };
  return {
    id: 'house-listing',
    repeatable: true,
    kicker: '🏠 For sale',
    image: h.image,
    prompt: `${h.beds}-bed ${h.type.toLowerCase()}, ${h.blurb}. Buy it?`,
    details: [
      ['Type', h.type],
      ['Built', h.year],
      ['Rooms', `${h.beds} bed`],
      ['Heating', h.heating],
      ['Utilities', `$${h.utilities}/wk`],
      ['Inspection', `${h.inspection}%`],
      ['Upkeep', `$${h.upkeep}/wk`],
      ['Mortgage', `$${h.mortgage}/wk`],
    ],
    left,
    right: { label: 'Keep looking', outcome: 'You passed on this one.' },
  };
}


const pick = (list, rng) => list[Math.floor(rng() * list.length)] ?? null;

// Weighted pick; cards without a `weight` function count as 1.
function pickWeighted(list, stats, rng) {
  const weights = list.map((c) => (c.weight ? c.weight(stats) : 1));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r < 0) return list[i];
  }
  return list[list.length - 1] ?? null;
}

// Picks the next card. In priority order: queued "keep or drop?" cards, a due
// therapy session, sometimes a surprise event, otherwise a random deck card.
// Avoids showing the same card twice in a row.
export function drawCard(stats, lastId = null, rng = Math.random) {
  const queued = stats.commitments.find((c) => c.id === stats.queue[0]);
  if (queued) return reassessCard(queued);

  if (hasCommitment(stats, 'therapy') && stats.day >= stats.nextTherapy) return THERAPY_SESSION;

  // House hunting: once the down payment is saved, listings show up often.
  if (!isHomeowner(stats) && stats.wealth >= DOWN_PAYMENT_GOAL && rng() < HOUSE_LISTING_CHANCE) {
    return houseCard(makeHouse(rng));
  }

  const eligible = (list) =>
    list.filter((c) =>
      c.id !== lastId &&
      !stats.usedCards.includes(c.id) &&
      (!c.big || stats.swipes >= BIG_EXPENSES_AFTER) &&
      (!c.when || c.when(stats)));

  if (stats.day > 1 && rng() < EVENT_CHANCE) {
    const event = pickWeighted(eligible(EVENTS), stats, rng);
    if (event) return event;
  }
  const deck = eligible(DECISIONS);
  if (deck.length) return pick(deck, rng);
  // Only the last card is eligible: allow the repeat rather than ending the game.
  return DECISIONS.find((c) => c.id === lastId && (!c.when || c.when(stats))) ?? null;
}

// ---------- Display ----------
export const STAT_META = {
  wealth: { label: 'Wealth', format: (v) => money(v) },
  social: { label: 'Social', format: (v) => `${v}` },
  skills: { label: 'Skills', format: (v) => `${v}` },
  health: { label: 'Health', format: (v) => `${Math.round(v)}` },
  spareTime: { label: 'Spare time', format: (v) => `${v}h` },
};

export function money(v) {
  return `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
}

const PERIOD_PLURAL = { daily: 'days', weekly: 'wks', monthly: 'mos' };

export function formatFlow(flow) {
  const sign = flow.amount > 0 ? '+' : '-';
  const stat = flow.stat ?? 'wealth';
  const amount = stat === 'wealth'
    ? `${sign}$${Math.abs(flow.amount).toLocaleString('en-US')}`
    : `${sign}${Math.abs(flow.amount)} ${STAT_META[stat].label.toLowerCase()}`;
  const odds = flow.chance != null ? `${Math.round(flow.chance * 100)}%: ` : '';
  if (flow.inDays != null) return `${amount} due in ${flow.inDays} days`;
  if (flow.scheduled) return amount;
  const on = flow.weekday != null ? ` ${WEEKDAYS[flow.weekday]}` : '';
  const base = `${odds}${amount}/${PERIOD_SHORT[flow.every]}${on}`;
  if (!flow.durationDays) return base;
  return `${base} for ${flow.durationDays / PERIOD_DAYS[flow.every]} ${PERIOD_PLURAL[flow.every]}`;
}

export function formatDelta(key, delta) {
  const sign = delta > 0 ? '+' : '-';
  const abs = Math.abs(delta);
  if (key === 'wealth') return `${sign}$${abs.toLocaleString('en-US')}`;
  if (key === 'spareTime') return `${sign}${abs}h`;
  return `${sign}${abs}`;
}

// Net recurring cash flow, normalised to a weekly figure for the HUD.
// Leaves out stat gains and chance-based payouts.
export function weeklyNet(flows) {
  return flows
    .filter((f) => !f.scheduled && f.stat === 'wealth' && f.chance == null)
    .reduce((sum, f) => sum + (f.amount * 7) / PERIOD_DAYS[f.every], 0);
}

// ---------- Turn logic ----------
function isDue(flow, day) {
  if (day < flow.startDay) return false;
  if (flow.endDay !== null && day >= flow.endDay) return false;
  return (day - flow.startDay) % PERIOD_DAYS[flow.every] === 0;
}

function addEffects(stats, effects = {}) {
  for (const [key, delta] of Object.entries(effects)) {
    stats[key] = (stats[key] ?? 0) + delta;
  }
}

function startCommitment(next, c) {
  if (next.commitments.some((x) => x.id === c.id)) return;
  next.commitments.push({
    id: c.id, label: c.label, image: c.image, hours: c.hours,
    keepPrompt: c.keepPrompt, dropLabel: c.dropLabel, dropOutcome: c.dropOutcome,
  });
  next.spareTime -= c.hours;
  if (c.cost) next.flows.push(makeFlow({ label: c.label, ...c.cost, commitmentId: c.id }, next.day));
  for (const g of c.gains ?? []) {
    // Gains start after one period by default (no +1 social on the day you join).
    const afterDays = g.afterDays ?? PERIOD_DAYS[g.every];
    next.flows.push(makeFlow({ label: c.label, ...g, afterDays, commitmentId: c.id }, next.day));
  }
  if (c.id === 'therapy') next.nextTherapy = next.day + THERAPY_EVERY;
}

function dropCommitment(next, id) {
  next.commitments = next.commitments.filter((c) => c.id !== id);
  next.flows = next.flows.filter((f) => f.commitmentId !== id);
}

// Applies a choice, or one result of a check. `before` is the stats before the
// turn, used for anything that scales with stats (pay, effects functions).
function applyResult(next, result, before, ledger) {
  if (!result) return;
  const effects = resolve(result.effects, before);
  addEffects(next, effects);
  if (effects?.wealth) ledger['One-time'] = (ledger['One-time'] ?? 0) + effects.wealth;
  for (const def of result.recurring ?? []) next.flows.push(makeFlow(def, next.day));
  for (const flag of result.setFlags ?? []) if (!next.flags.includes(flag)) next.flags.push(flag);
  if (result.job) {
    const job = { weekday: PAYDAY, ...result.job, amount: jobPay(result.job, before), kind: 'job' };
    next.flows.push(makeFlow(job, next.day + (result.startsIn ?? 0)));
  }
  if (result.raise) {
    next.flows = next.flows.map((f) =>
      f.kind === 'job' ? { ...f, amount: Math.round(f.amount * (1 + result.raise)) } : f);
  }
  if (result.commit) startCommitment(next, result.commit);
  if (result.drop) dropCommitment(next, result.drop);
  if (result.reassess) next.queue = next.commitments.map((c) => c.id);
  if (result.house) next.house = result.house;
}

// Picks one result from a check branch: a single result, or a list to choose from.
function pickResult(branch, stats, rng) {
  if (!Array.isArray(branch)) return branch;
  const options = branch.filter((r) => !r.when || r.when(stats));
  return pickWeighted(options, stats, rng);
}

// Applies the chosen side of a card, then advances time day by day.
// Returns { stats, ledger, gains, outcome, newGoals, healthDelta, healthCauses, gameOver }.
export function applyChoice(stats, card, side, rng = Math.random) {
  const choice = card[side];
  const next = {
    ...stats,
    flows: [...stats.flows],
    flags: [...stats.flags],
    commitments: [...stats.commitments],
    queue: card.queued ? stats.queue.slice(1) : [...stats.queue],
    usedCards: card.repeatable ? stats.usedCards : [...stats.usedCards, card.id],
    goalsDone: [...stats.goalsDone],
    swipes: stats.swipes + 1,
  };
  const ledger = {}; // money in/out this turn, by label
  const gains = {};  // stat changes from commitments this turn: { label: { social: 1 } }
  let outcome = choice.outcome ?? '';

  applyResult(next, choice, stats, ledger);

  const days = choice.days ?? card.days ?? DEFAULT_DAYS_PER_TURN;

  if (choice.apply) {
    const hired = rng() < jobChance(choice.apply, stats);
    // The job starts once the application wait is over, so no pay during it.
    const job = { job: choice.apply.job, effects: choice.apply.effects, startsIn: days };
    if (hired) applyResult(next, job, stats, ledger);
    outcome = hired ? choice.apply.success : choice.apply.fail;
  }

  if (choice.check) {
    const passed = rng() < choiceChance(choice, stats);
    const result = pickResult(passed ? choice.check.success : choice.check.fail, stats, rng);
    applyResult(next, result, stats, ledger);
    const label = choice.check.stat ? `${STAT_META[choice.check.stat].label} check` : 'Roll';
    outcome = `${passed ? '✅' : '❌'} ${label} ${passed ? 'passed' : 'failed'}. ${result?.outcome ?? ''}`;
  }

  for (let d = next.day; d < next.day + days; d++) {
    for (const flow of next.flows) {
      if (!isDue(flow, d)) continue;
      if (flow.chance != null && rng() >= flow.chance) continue;
      if (choice.pauseIncome && isIncomeStream(flow)) continue;
      if (flow.stat === 'wealth') {
        next.wealth += flow.amount;
        ledger[flow.label] = (ledger[flow.label] ?? 0) + flow.amount;
      } else {
        next[flow.stat] += flow.amount;
        gains[flow.label] = gains[flow.label] ?? {};
        gains[flow.label][flow.stat] = (gains[flow.label][flow.stat] ?? 0) + flow.amount;
      }
    }
  }
  next.day += days;
  next.flows = next.flows.filter((f) => f.endDay === null || f.endDay > next.day);
  next.spareTime = Math.max(0, next.spareTime);
  next.social = Math.max(0, next.social);
  next.skills = Math.max(0, next.skills);
  if (card.therapy) next.nextTherapy = next.day + THERAPY_EVERY;

  // Health: drains while under-slept and while in debt; recovers only when
  // you're rested and debt free.
  const weeks = days / 7;
  next.health = Math.max(0, Math.min(100, next.health));
  const healthBefore = next.health;
  const healthCauses = [];
  let rate = 0;
  if (isUnderSlept(next)) { rate -= HEALTH_LOSS_PER_WEEK; healthCauses.push('😴 Under-slept'); }
  if (next.wealth < 0) { rate -= DEBT_HEALTH_LOSS_PER_WEEK; healthCauses.push('💳 In debt'); }
  if (rate === 0) rate = HEALTH_GAIN_PER_WEEK;
  // Kept fractional so a daily -2/wk drain adds up; shown rounded.
  next.health = Math.max(0, Math.min(100, +(next.health + rate * weeks).toFixed(3)));
  const healthDelta = Math.round(next.health) - Math.round(healthBefore);

  const newGoals = GOALS.filter((g) => !next.goalsDone.includes(g.id) && g.isDone(next));
  next.goalsDone.push(...newGoals.map((g) => g.id));

  // The only way to lose: health hits 0 (from debt, lack of sleep, or both).
  const gameOver = next.health < 0.5 ? 'health' : null;

  return { stats: next, ledger, gains, outcome, newGoals, healthDelta, healthCauses, gameOver };
}
