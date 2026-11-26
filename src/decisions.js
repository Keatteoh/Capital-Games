const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ---------- Tuning ----------
export const PERIOD_DAYS = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
const PERIOD_SHORT = { daily: 'day', weekly: 'wk', biweekly: '2 wks', monthly: 'mo' };
export const DEFAULT_DAYS_PER_TURN = 1; // each swipe is one day unless a card says otherwise

// Day 1 is a Monday. Weekly flows can land on a set weekday (0 = Mon … 6 = Sun).
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const dayOfWeek = (day) => (day - 1) % 7;
const MON = 0, WED = 2, FRI = 4, SAT = 5;
export const PAYDAY = FRI;
export const STARTING_DEBT = -400;       // you start the game owing this much
export const DEBT_HEALTH_LOSS_PER_WEEK = 2; // health lost each week you're in debt
const COST_OF_LIVING = { label: 'Cost of living', amount: -20, every: 'weekly', weekday: MON };
// Surprise events: each week rolls 0–2 of them, on random days of that week.
export const EVENTS_PER_WEEK = [0, 2]; // [min, max]
const weekOf = (day) => Math.floor((day - 1) / 7);

// Picks which days of `day`'s week get a surprise event (only days from `day` on).
function planEvents(day, rng = Math.random) {
  const [min, max] = EVENTS_PER_WEEK;
  const count = min + Math.floor(rng() * (max - min + 1));
  const week = weekOf(day);
  const open = [];
  for (let d = Math.max(day, 2); d <= week * 7 + 7; d++) open.push(d); // never on day 1
  const days = [];
  while (days.length < count && open.length) days.push(open.splice(Math.floor(rng() * open.length), 1)[0]);
  return { week, days };
}

// Time: a day has 24 hours. Essentials (meals, chores, getting around) take 8,
// leaving 16 available. Jobs take hours on workdays (Mon–Fri) and commitments on
// their own schedule. Whatever is left is for sleep: under 8 hours is the health
// hazard zone, and each hour short costs more.
export const HOURS_PER_DAY = 24;
export const ESSENTIAL_HOURS = 8;
export const SLEEP_HOURS = 8;
const WORKDAYS = [0, 1, 2, 3, 4];
export const LOW_HEALTH = 50;            // below this: more medical events, worse job odds
export const HEALTH_LOSS_PER_OVERCOMMITTED_DAY = 5; // the first hour of lost sleep
const HEALTH_LOSS_PER_EXTRA_SLEEP_HOUR = 2;         // each hour short after that
const SOCIAL_LOSS_PER_OVERCOMMITTED_DAY = 1;
// Health lost on a day with `free` hours left (0 if you get your 8 hours).
export const sleepPenalty = (free) =>
  free >= SLEEP_HOURS ? 0
    : HEALTH_LOSS_PER_OVERCOMMITTED_DAY + HEALTH_LOSS_PER_EXTRA_SLEEP_HOUR * Math.ceil(SLEEP_HOURS - free - 1);
// Stretched thin: this many overcommitted days within a week prompts a check-in
// on every commitment (keep or drop), at most once per CHECKIN_COOLDOWN days.
const STRETCHED_DAYS = 3;
const CHECKIN_COOLDOWN = 14;
const HEALTH_GAIN_PER_WEEK = 5;          // per week of rested, debt-free days
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

// Easing in: the first 10–12 swipes only draw low-stakes everyday cards (each
// game picks its own number), and surprise events start around swipe 13–16.
export const LOW_STAKES_SWIPES = [10, 12];
export const EVENTS_FROM_SWIPE = [13, 16];
const LOW_STAKES = new Set([
  'gym', 'bike', 'hobby-guitar', 'hobby-soccer', 'hobby-baking', 'book-club', 'volunteer-oldfolks',
  'foodbank', 'food-stop', 'meal-prep', 'family-dinner', 'sell-clothes', 'coupons', 'library-book',
  'spare-ticket', 'sneaker-sale', 'budget-app', 'phone-plan',
  'morning-run', 'yoga', 'meal-prep-habit', 'language-app', 'deep-clean',
]);

export const DOWN_PAYMENT_GOAL = 10000;  // house listings appear once you have this much
const HOUSE_LISTING_CHANCE = 0.5;        // per turn, while saving is done and you're house hunting

// Renting: listings show up once you've had income and cleared your debt once.
const RENTAL_LISTING_CHANCE = 0.12;      // per turn, while you live with your parents
export const EVICTION_MONTHS = 3;        // rent days in a row you can't cover before eviction
export const EVICTION_HEALTH_LOSS = 40;
const EVICTION_COOLDOWN = 60;            // days before landlords will look at you again
const JOB_LEAD_BONUS = 0.15;             // a job lead adds this to your next application
export const INCOME_STREAMS_GOAL = 7;

// Side-quest cards are drawn less often than everyday cards (1 = same odds).
const SIDE_QUEST_WEIGHT = 0.3;
const THIS_YEAR = 2026;

// ---------- Helpers ----------
export const hasJob = (s) => s.flows.some((f) => f.kind === 'job');
const jobIncome = (s) => s.flows.filter((f) => f.kind === 'job').reduce((sum, f) => sum + f.amount, 0);
export const hasFlag = (s, flag) => s.flags.includes(flag);
export const hasCommitment = (s, id) => s.commitments.some((c) => c.id === id);
// Hours a job takes on `day` (workdays only, once the job has started).
const jobHoursOn = (s, day) =>
  WORKDAYS.includes(dayOfWeek(day))
    ? s.flows.filter((f) => f.kind === 'job' && day >= f.activeFrom).reduce((h, f) => h + (f.hours ?? 0), 0)
    : 0;
// Hours your commitments take on `day`.
const commitmentHoursOn = (s, day) =>
  s.commitments.filter((c) => commitmentOn(c, day)).reduce((h, c) => h + c.hours, 0);

// How often a commitment repeats (`cadence` on a commit; weekly by default).
// Weekly ones land on set weekdays; the others count from their first day.
export const CADENCES = { daily: 1, '2days': 2, '3days': 3, weekly: 7, biweekly: 14, monthly: 30 };

// Is commitment `c` (as stored, or as planned) happening on `day`?
export function commitmentOn(c, day) {
  if (!c.every || c.every === 7) return c.weekdays.includes(dayOfWeek(day));
  return day >= c.anchor && (day - c.anchor) % c.every === 0;
}

// When a new commitment would happen: { every, weekdays, anchor }. Daily and
// every-few-days ones start tomorrow; every-other-week and monthly ones start on
// the next free-est weekday.
export function planCommitment(c, s) {
  const every = CADENCES[c.cadence ?? 'weekly'];
  if (every === 7) return { every, weekdays: commitmentDays(c, s), anchor: null };
  if (every < 7) return { every, weekdays: [], anchor: s.day + 1 };
  const [wd] = commitmentDays(c, s);
  return { every, weekdays: [wd], anchor: s.day + 1 + ((wd - dayOfWeek(s.day + 1) + 7) % 7) };
}

// "every day", "every 3 days", "every Sat", "every other Thu", "once a month".
export function scheduleText(c) {
  const days = (c.weekdays ?? []).map((d) => WEEKDAYS[d]).join(', ');
  switch (c.every ?? 7) {
    case 1: return 'every day';
    case 14: return `every other ${days}`;
    case 30: return 'once a month';
    case 7: return `every ${days}`;
    default: return `every ${c.every} days`;
  }
}
const timesPerWeek = (c) => (c.every && c.every !== 7 ? 7 / c.every : c.weekdays.length);
// Free hours on `day`, minus any hours a card keeps you busy (`busy`).
export const freeHours = (s, day = s.day, busy = 0) =>
  HOURS_PER_DAY - ESSENTIAL_HOURS - jobHoursOn(s, day) - commitmentHoursOn(s, day) - busy;
// Short on sleep today: fewer than 8 hours left.
export const isUnderSlept = (s) => freeHours(s) < SLEEP_HOURS;

// Warns before a choice overcommits you. Returns { days, health, sleep, ongoing }:
//   days:    how many days of this turn would be short on sleep
//   health:  the health those days would cost
//   sleep:   the fewest hours of sleep on those days
//   ongoing: true if a new commitment or job would overcommit the days it lands on
export function overcommitPreview(s, card, choice) {
  const length = choice.days ?? card.days ?? DEFAULT_DAYS_PER_TURN;
  let days = 0, health = 0, sleep = SLEEP_HOURS;
  for (let d = s.day; d < s.day + length; d++) {
    const free = freeHours(s, d, choice.busy ?? 0);
    if (free < SLEEP_HOURS) { days++; health += sleepPenalty(free); sleep = Math.min(sleep, Math.max(0, free)); }
  }
  let ongoing = false;
  if (choice.commit) {
    // Check the next four weeks (from next Monday, when jobs have started).
    const plan = planCommitment(choice.commit, s);
    const monday = Math.floor((s.day - 1) / 7) * 7 + 8;
    for (let d = monday; d < monday + 28 && !ongoing; d++) {
      if (commitmentOn(plan, d) && freeHours(s, d) - choice.commit.hours < SLEEP_HOURS) ongoing = true;
    }
  }
  // A new job's hours on top of your routines (checked over the first month of work).
  const jobHours = choice.apply?.job.hours ?? 0;
  if (jobHours) {
    const start = s.day + length;
    for (let d = start; d < start + 28 && !ongoing; d++) {
      if (WORKDAYS.includes(dayOfWeek(d)) && freeHours(s, d) - jobHours < SLEEP_HOURS) ongoing = true;
    }
  }
  return { days, health, sleep, ongoing };
}

// Which weekday a new commitment lands on: its own `weekday` if set, otherwise
// a weeknight (Mon–Fri) — the least busy one, with ties spread out by the
// commitment's id so they don't all pile onto Monday.
export function commitmentDays(c, s) {
  if (c.weekdays) return c.weekdays;
  if (c.weekday != null) return [c.weekday];
  const week = Math.floor((s.day - 1) / 7) * 7 + 1; // Monday of this week
  const load = (wd) => jobHoursOn(s, week + wd + 7) + commitmentHoursOn(s, week + wd + 7);
  const shift = [...c.id].reduce((h, ch) => h + ch.charCodeAt(0), 0) % 5;
  const order = [0, 1, 2, 3, 4].map((i) => (i + shift) % 5);
  return [order.reduce((best, wd) => (load(wd) < load(best) ? wd : best), order[0])];
}
export const isHomeowner = (s) => s.house != null;
export const isRenting = (s) => s.rental != null;
export const livesWithParents = (s) => !isRenting(s) && !isHomeowner(s) && !s.lodging;
// After an eviction you might be on a friend's couch or in a shelter.
export const isCouchSurfing = (s) => s.lodging?.kind === 'couch';
export const inShelter = (s) => s.lodging?.kind === 'shelter';
// Rentals: you need some income, and to have cleared your debt at least once
// (going back into debt later doesn't hide them again).
export const rentalsUnlocked = (s) =>
  s.goalsDone.includes('debt') &&
  (hasJob(s) || incomeStreams(s) > 0) &&
  !isRenting(s) && !isHomeowner(s) &&
  !(s.since.evicted != null && s.day - s.since.evicted < EVICTION_COOLDOWN);
// Weekly net cash flow if you signed this rental: rent and utilities in, allowance out.
export function netAfterRental(s, r) {
  const flows = s.flows.filter((f) => f.tag !== 'allowance' && f.tag !== 'lodging');
  return weeklyNet(flows) - ((r.rent + r.utilities) * 7) / 30;
}

// Hours a week taken by jobs (Mon–Fri) and commitments.
export const committedHoursPerWeek = (s) =>
  s.flows.filter((f) => f.kind === 'job').reduce((h, f) => h + (f.hours ?? 0) * 5, 0) +
  s.commitments.reduce((h, c) => h + c.hours * timesPerWeek(c), 0);

// What fills a day: job, commitments, one-off busy hours, and what's left.
export function timeBreakdown(s, day = s.day) {
  const job = jobHoursOn(s, day);
  const commit = commitmentHoursOn(s, day);
  return { essentials: ESSENTIAL_HOURS, job, commit, free: HOURS_PER_DAY - ESSENTIAL_HOURS - job - commit };
}

// How a choice changes your time, before you make it. Returns { hours, text } or null.
// hours < 0 spends time, > 0 frees it up.
export function timePreview(s, card, choice) {
  const parts = [];
  let hours = 0;
  const days = choice.days ?? card.days ?? DEFAULT_DAYS_PER_TURN;
  if (choice.busy) {
    hours -= choice.busy;
    const sign = choice.busy > 0 ? '-' : '+';
    parts.push(`${sign}${Math.abs(choice.busy)}h ${days > 1 ? 'a day' : 'today'}`);
  }
  if (choice.commit) {
    hours -= choice.commit.hours;
    parts.push(`-${choice.commit.hours}h ${scheduleText(planCommitment(choice.commit, s))}`);
  }
  if (choice.drop) {
    const c = s.commitments.find((x) => x.id === choice.drop);
    if (c) { hours += c.hours; parts.push(`+${c.hours}h ${scheduleText(c)}`); }
  }
  if (choice.apply?.job.hours) {
    hours -= choice.apply.job.hours;
    parts.push(`-${choice.apply.job.hours}h a day if hired`);
  }
  // today: hours this choice takes (or frees) today, for the sleep forecast
  return parts.length ? { hours, today: -(choice.busy ?? 0), text: parts.join(' · ') } : null;
}

// Health a choice costs or gives right away (its effects plus any overcommitted days).
export function healthPreview(s, card, choice) {
  const fx = resolve(choice.effects, s) ?? {};
  const over = overcommitPreview(s, card, choice).health;
  return (fx.health ?? 0) - over;
}
// Days since a flag was set or a commitment started (-1 if never).
export const daysSince = (s, key) => (s.since[key] == null ? -1 : s.day - s.since[key]);

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
  const lead = hasFlag(s, 'job-lead') ? JOB_LEAD_BONUS : 0;
  return clampChance(apply.chance(s) - penalty + lead);
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
  const activeFrom = start;
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
    activeFrom,
    hours: def.hours ?? null,           // jobs: hours per workday
    tag: def.tag ?? null,               // 'allowance', 'rent' (rent day), 'home' (other renting costs)
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
  const age = 16 + Math.floor(rng() * 40); // 16–55
  const group = age >= 50 ? CHARACTERS.older : CHARACTERS.younger;
  const c = group[Math.floor(rng() * group.length)];
  const tone = SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)];
  return { emoji: c.base + tone, gender: c.gender, age };
}

// Who you live with at the start. A single parent can't give you an allowance,
// and sometimes needs help with the bills.
export function makeHousehold(rng = Math.random) {
  const single = rng() < 0.5;
  const parent = rng() < 0.5 ? 'Mom' : 'Dad';
  return { single, parent: single ? parent : 'your parents', label: single ? `${parent} (single parent)` : 'Both parents' };
}

export function createInitialStats() {
  const household = makeHousehold();
  const allowance = household.single ? 0 : randomInt(5, 15);
  const flows = [makeFlow(COST_OF_LIVING, 1)];
  if (allowance > 0) {
    flows.unshift(makeFlow({ label: 'Allowance from parents', amount: allowance, every: 'weekly', weekday: WED, tag: 'allowance' }, 1));
  }
  return {
    day: 1,
    swipes: 0,          // choices made so far
    wealth: STARTING_DEBT,
    social: randomInt(1, 4),
    health: 100,
    skills: randomInt(1, 4),
    character: makeCharacter(),
    household,
    rental: null,       // the place you rent (see makeRental), with `behind`: rent days you couldn't cover
    lodging: null,      // after an eviction: { kind: 'couch' | 'shelter', host, next } (next = day of the weekly check-in)
    housingPrompt: null, // where-to-stay card waiting to be shown: 'evicted' or a pair of options
    flows,
    flags: [],          // things the player has learned/unlocked, e.g. 'power-tools'
    commitments: [],    // ongoing hobbies etc.: { id, label, image, hours, keepPrompt, dropLabel }
    queue: [],          // commitment ids waiting for a "keep or drop?" card (from therapy)
    nextTherapy: null,  // day the next therapy session is due
    house: null,        // the house you bought (see makeHouse)
    items: [],          // collectibles you're holding: { id, label, image, value, since }
    since: {},          // day each flag was set / commitment started, for side-quest timing
    eventPlan: planEvents(1), // { week, days }: which days this week get a surprise event
    lowStakesUntil: randomInt(...LOW_STAKES_SWIPES), // swipes of everyday cards only
    eventsFrom: randomInt(...EVENTS_FROM_SWIPE),     // swipe when surprise events can start
    hadEvent: false,    // the first surprise is guaranteed on swipe `eventsFrom`
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
    id: 'move-out',
    title: 'Move out',
    hint: 'Rentals show up once you have income and have cleared your debt. Rent is a big monthly bill, so line up enough income to cover it first. A roommate makes it cheaper, if they pick you. Fall behind on rent 3 months in a row and you are evicted (-40 health).',
    isDone: (s) => !livesWithParents(s),
    progress: (s) => (s.goalsDone.includes('debt') && (hasJob(s) || incomeStreams(s) > 0)
      ? `Income ${money(weeklyNet(s.flows))}/wk`
      : 'Need income, debt-free'),
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
//   setFlags:  flags to unlock other cards, e.g. ['power-tools']
//   apply:     a job application; `chance(stats)` is the success probability
//   check:     a dice roll, e.g. a social check:
//              { stat: 'social', chance(stats), success: result | [results], fail: result | [results] }
//              A list of results picks one at random (each may have `when` and `weight`).
//              A result can use any choice field plus `job` (start a job) and `raise` (0.15 = +15% pay).
//   fire:      lose your job (its pay stops)
//   pay:       a random one-off payment, { min, max } or a function of stats returning one
//   item:      add a collectible, { label, image, value }; it may gain value each month
//   sell:      sell the collectible with this id (pair with an effects payment)
//   pauseIncome: no job or income-stream payments for the turn (costs still apply)
//   busy:      hours a day this card keeps you busy while it lasts (e.g. a week of study)
//   commit:    start an ongoing commitment (hobby, club, pet) that takes hours one day a week:
//              { id, label, image, hours, cost: { amount, every }, gains: [{ stat, amount, every,
//                chance?, afterDays? }], keepPrompt?, dropLabel?, dropOutcome? }
//              Lands on `weekday` (or `weekdays`) if set, else your freest day.
//              `cadence`: 'daily', '2days', '3days', 'weekly' (default), 'biweekly' or 'monthly'.
//              Therapy sessions let you drop commitments to get the hours back.
const SKIP = { label: 'Skip', outcome: 'You let this one pass.' };

// ---------- Food and drink ----------
// One food stop card, a different option each time: each has its own cost and
// health effect, and a small chance of a run-in that pays off.
const FOODS = [
  { name: 'latte', image: '☕', cost: 6, health: 0, prompt: 'The corner café smells amazing. Grab a $6 latte?',
    yes: 'Oat milk, extra shot. Worth it.', skip: 'Brew at home', no: 'Not as fancy, but free.' },
  { name: 'bubble tea', image: '🧋', cost: 7, health: -1, prompt: 'Brown sugar bubble tea for $7?',
    yes: 'Delicious. The sugar crash comes later.', skip: 'Water', no: 'Hydrated and $7 richer.' },
  { name: 'green smoothie', image: '🥤', cost: 9, health: 2, prompt: 'A $9 green smoothie: kale, mango, ginger?',
    yes: 'Tastes like a lawn, feels like a reset.', skip: 'Skip it', no: 'Maybe tomorrow.' },
  { name: 'tacos', image: '🌮', cost: 12, health: 0, prompt: 'The taco truck is parked outside. Three tacos for $12?',
    yes: 'Al pastor, extra salsa. No regrets.', skip: 'Keep walking', no: 'The smell follows you for a block.' },
  { name: 'croissant', image: '🥐', cost: 5, health: -1, prompt: 'Fresh croissants at the bakery, $5 each.',
    yes: 'Flaky, buttery, gone in four bites.', skip: 'Resist', no: 'Willpower: strong.' },
  { name: 'poke bowl', image: '🍣', cost: 14, health: 2, prompt: 'A $14 poke bowl for lunch?',
    yes: 'Fresh, filling, and you feel great after.', skip: 'Leftovers', no: 'Leftovers again. Thrifty.' },
  { name: 'hot dog', image: '🌭', cost: 3, health: -3, prompt: 'A gas station hot dog for $3. Tempting?',
    yes: 'You regret it within the hour.', skip: 'No way', no: 'Your stomach thanks you.' },
  { name: 'energy drink', image: '⚡', cost: 4, health: -2, saves: 1, prompt: 'Long day ahead. Crack a $4 energy drink?',
    yes: 'Wired. You squeeze an extra hour out of the day, but sleep badly.', skip: 'Nap instead', no: 'A 20-minute nap. Not bad.' },
  { name: 'ramen', image: '🍜', cost: 15, health: 1, prompt: 'The ramen shop has no line for once. $15 bowl?',
    yes: 'Rich broth, soft egg. Restorative.', skip: 'Cook at home', no: 'Instant noodles. Close enough.' },
  { name: 'fruit', image: '🍓', cost: 8, health: 3, prompt: 'Strawberries and peaches at the farmers market, $8?',
    yes: 'Sweet, in season, and good for you.', skip: 'Skip it', no: 'You walk past the stalls.' },
];

// What you make and could sell to a stranger, based on your hobbies.
const PRODUCTS = [
  { id: 'pottery', thing: 'a vase', pay: { min: 80, max: 160 } },
  { id: 'photo', thing: 'a framed print', pay: { min: 60, max: 140 } },
  { id: 'garden', thing: 'a potted bonsai', pay: { min: 50, max: 120 } },
  { id: 'bikes', thing: 'a refurbished bike', pay: { min: 120, max: 220 } },
  { id: 'baking', thing: 'a box of pastries', pay: { min: 30, max: 60 } },
];
const productsFor = (s) => PRODUCTS.filter((p) => hasCommitment(s, p.id));

function foodStop(s, rng = Math.random) {
  const f = FOODS[Math.floor(rng() * FOODS.length)];
  const product = pick(productsFor(s), rng);
  return {
    image: f.image,
    prompt: f.prompt,
    left: {
      label: 'Buy',
      effects: { wealth: -f.cost, ...(f.health ? { health: f.health } : {}) },
      ...(f.saves ? { busy: -f.saves } : {}),
      outcome: f.yes,
      // A rare run-in while you're out. Better odds with more social points.
      check: {
        rare: true,
        label: 'chance of a run-in',
        chance: (st) => Math.min(0.15, 0.05 + 0.01 * Math.max(0, st.social)),
        success: [
          { effects: { social: 1 }, outcome: `${f.yes} And you bump into an old friend in line. +1 social.` },
          { when: (st) => !hasFlag(st, 'job-lead'), setFlags: ['job-lead'],
            outcome: `${f.yes} A job board by the door has a fresh listing: +15% odds on your next job application.` },
          ...(product ? [{ weight: () => 2, pay: product.pay,
            outcome: `${f.yes} The person next to you loves your work and buys ${product.thing}.` }] : []),
        ],
        fail: { outcome: f.yes },
      },
    },
    right: { label: f.skip, outcome: f.no },
  };
}

export const DECISIONS = [
  // --- Upskilling ---
  {
    id: 'power-tools',
    image: '🧰',
    prompt: 'The hardware store runs a $100 power tools workshop this week. Sign up?',
    left: {
      label: 'Sign up',
      effects: { wealth: -100, skills: 1 },
      setFlags: ['power-tools'],
      outcome: 'You finished the workshop and earned your safety certificate. Landscaping jobs are now open to you.',
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
      effects: { skills: 1 },
      busy: 3,
      outcome: 'A week of focused study. Your skills went up.',
    },
    right: {
      label: 'Rest',
      effects: { health: 3 },
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
      effects: { skills: 3 },
      busy: 8,
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
        job: { label: 'Supermarket job', amount: 150, every: 'weekly', hours: 5 },
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
        job: { label: 'Café job', amount: 120, every: 'weekly', hours: 4 },
        effects: { social: 1 },
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
    prompt: 'A landscaping crew needs someone who can handle power tools. Apply?',
    when: (s) => !hasJob(s) && hasFlag(s, 'power-tools'),
    left: {
      label: 'Apply',
      days: 14,
      effects: { wealth: -5 },
      apply: {
        chance: (s) => clampChance(0.5 + 0.1 * s.skills),
        job: { label: 'Landscaping job', amount: 220, every: 'weekly', skillPay: true, hours: 7 },
        success: 'The power tools workshop paid off. You start Monday!',
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
        job: { label: 'Junior developer', amount: 400, every: 'weekly', skillPay: true, hours: 8 },
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
      effects: { health: 2 },
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
      effects: { wealth: 60 },
      busy: 4,
      outcome: 'Long week, but an extra $60.',
    },
    right: {
      label: 'Pass',
      effects: { health: 3 },
      outcome: 'You kept your evenings free.',
    },
  },

  // --- Hobbies & commitments: take a few hours one day a week, pay off over time ---
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
        id: 'soccer', label: 'Sunday soccer', image: '⚽', hours: 2, weekday: 6,
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
        id: 'baking', label: 'Market baking', image: '🥖', hours: 5, weekday: SAT,
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

  // --- Everyday life: small daily choices between jobs and side quests ---
  {
    id: 'team-lunch',
    repeatable: true,
    image: '🥗',
    prompt: 'Coworkers are heading out for lunch. Join them for $15?',
    when: (s) => hasJob(s),
    left: {
      label: 'Join',
      effects: { wealth: -15 },
      check: {
        chance: () => 0.4,
        success: { effects: { social: 1 }, outcome: 'Great conversation. You are getting closer with the team.' },
        fail: { outcome: 'Nice lunch, mostly shop talk.' },
      },
    },
    right: { label: 'Brown bag', outcome: 'Leftovers at your desk. Thrifty.' },
  },
  {
    id: 'meal-prep',
    repeatable: true,
    image: '🍱',
    prompt: 'Spend a couple of hours meal prepping, or just order takeout tonight?',
    left: { label: 'Meal prep', busy: 2, effects: { wealth: -10, health: 1 }, outcome: 'Five lunches in the fridge for $10.' },
    right: { label: 'Takeout', effects: { wealth: -25 }, outcome: 'Delicious, and $25 gone.' },
  },
  {
    id: 'food-stop',
    repeatable: true,
    weight: () => 0.8,
    kicker: '🍽️ Food & drink',
    image: '☕',
    prompt: 'Grab something on the way?',
    build: foodStop,
    left: { label: 'Buy', outcome: '' },
    right: { label: 'Skip', outcome: '' },
  },
  {
    id: 'sneaker-sale',
    image: '👟',
    prompt: 'The sneakers you have wanted are 40% off: $90. Buy them?',
    left: { label: 'Buy', effects: { wealth: -90, social: 1 }, outcome: 'Fresh kicks. People noticed.' },
    right: { label: 'Skip', outcome: 'Your old pair still works.' },
  },
  {
    id: 'family-dinner',
    repeatable: true,
    image: '🍝',
    prompt: 'Your aunt invites you over for dinner tonight.',
    left: { label: 'Go', busy: 3, effects: { social: 1, wealth: 10 }, outcome: 'Good food, and they sent you home with leftovers.' },
    right: { label: 'Too tired', outcome: 'You promised to come next time.' },
  },
  {
    id: 'sell-clothes',
    repeatable: true,
    image: '👕',
    prompt: 'Your closet is overflowing. List some old clothes online?',
    left: { label: 'List them', busy: 2, pay: { min: 20, max: 60 }, outcome: 'A few pieces sold right away.' },
    right: { label: 'Later', outcome: 'The pile can wait.' },
  },
  {
    id: 'phone-plan',
    image: '📶',
    prompt: 'A cheaper phone plan would save you $10 a month. Spend an hour switching?',
    left: {
      label: 'Switch',
      busy: 1,
      recurring: [{ label: 'Phone plan savings', amount: 10, every: 'monthly' }],
      outcome: 'Same coverage, lower bill.',
    },
    right: { label: 'Not worth it', outcome: 'You stayed on your old plan.' },
  },
  {
    id: 'cover-shift',
    repeatable: true,
    image: '🧾',
    prompt: 'A friend\'s café needs someone to cover a shift today. $70 cash.',
    left: { label: 'Cover it', busy: 6, effects: { wealth: 70, social: 1 }, outcome: 'Busy shift, free pastries, and $70.' },
    right: { label: 'Can\'t today', outcome: 'They found someone else.' },
  },
  {
    id: 'spare-ticket',
    image: '🎤',
    prompt: 'A friend has a spare concert ticket tonight for $45.',
    left: { label: 'Go', busy: 4, effects: { wealth: -45, social: 1, health: 2 }, outcome: 'Loud, sweaty and the best night in weeks.' },
    right: { label: 'Pass', outcome: 'You watched clips online instead.' },
  },
  {
    id: 'library-book',
    repeatable: true,
    image: '📕',
    prompt: 'The library has a popular book on personal finance. Read it this week?',
    when: (s) => !hasFlag(s, 'finance-book'),
    left: { label: 'Read it', busy: 2, days: 3, effects: { skills: 1 }, setFlags: ['finance-book'], outcome: 'You finally get compound interest. +1 skill.' },
    right: { label: 'Not now', outcome: 'You put it on hold for later.' },
  },
  {
    id: 'coupons',
    repeatable: true,
    image: '🏷️',
    prompt: 'Spend an hour stacking grocery coupons and store deals?',
    left: { label: 'Clip away', busy: 1, effects: { wealth: 15 }, outcome: 'Saved $15 on groceries.' },
    right: { label: 'Skip', outcome: 'Full price it is.' },
  },
  {
    id: 'budget-app',
    image: '📱',
    prompt: 'Set up a budgeting app and track every dollar?',
    left: {
      label: 'Set it up',
      busy: 2,
      recurring: [{ label: 'Budgeting savings', amount: 5, every: 'weekly' }],
      outcome: 'Turns out you spend a lot on snacks. Now you save $5 a week.',
    },
    right: { label: 'Not for me', outcome: 'You will keep it all in your head.' },
  },

  // --- Routines: commitments on different rhythms, from daily to monthly ---
  {
    id: 'morning-run',
    image: '🏃',
    prompt: 'Start running for an hour every morning?',
    left: {
      label: 'Start running',
      commit: {
        id: 'running', label: 'Morning run', image: '🏃', hours: 1, cadence: 'daily',
        gains: [{ stat: 'health', amount: 2, every: 'weekly' }],
        keepPrompt: 'Keep up the morning runs?',
      },
      outcome: 'Two miles and sore calves. By next week it gets easier.',
    },
    right: { label: 'Sleep in', outcome: 'The snooze button wins again.' },
  },
  {
    id: 'language-app',
    image: '🗣️',
    prompt: 'Learn Spanish with an hour of practice every day?',
    left: {
      label: 'Start',
      commit: {
        id: 'spanish', label: 'Spanish practice', image: '🗣️', hours: 1, cadence: 'daily',
        gains: [{ stat: 'skills', amount: 1, every: 'monthly', afterDays: 30 }],
        keepPrompt: 'Keep practicing Spanish every day?',
      },
      outcome: '¡Hola! Your streak starts today.',
    },
    right: { label: 'Maybe later', outcome: 'Mañana, maybe.' },
  },
  {
    id: 'neighbor-cat',
    image: '🐱',
    prompt: "Your neighbor travels for work. Feed their cat every other day for $20 a week?",
    left: {
      label: 'Deal',
      commit: {
        id: 'neighbor-cat', label: "Neighbor's cat", image: '🐱', hours: 1, cadence: '2days',
        gains: [{ stat: 'wealth', amount: 20, every: 'weekly' }],
        keepPrompt: "Keep feeding the neighbor's cat?",
      },
      outcome: 'The cat ignores you. The $20 a week does not.',
    },
    right: { label: 'Not a cat person', outcome: 'They found a pet sitter instead.' },
  },
  {
    id: 'yoga',
    image: '🧘',
    prompt: 'A yoga studio runs a class every 3 days for $35 a month. Sign up?',
    left: {
      label: 'Sign up',
      commit: {
        id: 'yoga', label: 'Yoga', image: '🧘', hours: 1, cadence: '3days',
        cost: { amount: -35, every: 'monthly' },
        gains: [{ stat: 'health', amount: 3, every: 'weekly' }],
        keepPrompt: 'Keep going to yoga?',
      },
      outcome: 'You can almost touch your toes.',
    },
    right: SKIP,
  },
  {
    id: 'meal-prep-habit',
    image: '🥡',
    prompt: 'Make meal prep a Sunday habit? Two hours a week saves about $15.',
    left: {
      label: 'Every Sunday',
      commit: {
        id: 'mealprep', label: 'Sunday meal prep', image: '🥡', hours: 2, weekday: 6,
        gains: [{ stat: 'wealth', amount: 15, every: 'weekly' }, { stat: 'health', amount: 1, every: 'weekly' }],
        keepPrompt: 'Keep meal prepping on Sundays?',
      },
      outcome: 'Five labeled containers in the fridge. Very adult.',
    },
    right: { label: 'Wing it', outcome: 'Cereal for dinner it is.' },
  },
  {
    id: 'grandma-visits',
    image: '🫖',
    prompt: 'Your grandma would love a visit every other week. Commit to it?',
    left: {
      label: 'Visit her',
      commit: {
        id: 'grandma', label: 'Visiting grandma', image: '🫖', hours: 3, cadence: 'biweekly',
        gains: [{ stat: 'social', amount: 1, every: 'biweekly' }],
        keepPrompt: 'Keep visiting grandma every other week?',
      },
      outcome: 'Tea, cookies and stories you have heard before. She lights up when you arrive.',
    },
    right: { label: 'Call instead', outcome: 'A quick call. She says she understands.' },
  },
  {
    id: 'deep-clean',
    image: '🧽',
    prompt: 'Deep clean your space every other week?',
    left: {
      label: 'Scrub',
      commit: {
        id: 'cleaning', label: 'Deep clean', image: '🧽', hours: 2, cadence: 'biweekly',
        gains: [{ stat: 'health', amount: 1, every: 'biweekly' }],
        keepPrompt: 'Keep up the deep cleans?',
      },
      outcome: 'You found a missing sock and a $5 bill. Spotless.',
    },
    right: { label: 'Later', outcome: 'The dust bunnies multiply.' },
  },
  {
    id: 'blood-drive',
    image: '🩸',
    prompt: 'Donate blood once a month at the community center?',
    left: {
      label: 'Donate',
      commit: {
        id: 'blood', label: 'Blood donation', image: '🩸', hours: 2, cadence: 'monthly',
        gains: [{ stat: 'social', amount: 1, every: 'monthly' }],
        keepPrompt: 'Keep donating blood every month?',
      },
      outcome: 'A cookie, a juice box and a sticker. You feel good about it.',
    },
    right: { label: 'Not for me', outcome: 'Needles are not your thing.' },
  },
  {
    id: 'waterfront-cleanup',
    image: '🏖️',
    prompt: 'Join a volunteer crew that cleans up the waterfront once a month?',
    left: {
      label: 'Join',
      commit: {
        id: 'cleanup', label: 'Waterfront cleanup', image: '🏖️', hours: 4, cadence: 'monthly',
        gains: [{ stat: 'social', amount: 1, every: 'monthly' }],
        keepPrompt: 'Stay on the waterfront cleanup crew?',
      },
      outcome: 'Four hours, six bags of trash and a new group chat.',
    },
    right: SKIP,
  },

  // --- Side quests: hobbies that can grow into gigs, collectibles and income streams ---

  // Pottery → artisan markets → kiln upgrade → café wholesale stream
  {
    id: 'pottery-class',
    sideQuest: true,
    kicker: '🗺️ Side quest',
    image: '🏺',
    prompt: 'A community studio runs a weekly pottery class for $60 a month. Sign up?',
    left: {
      label: 'Sign up',
      commit: {
        id: 'pottery', label: 'Pottery', image: '🏺', hours: 3,
        cost: { amount: -60, every: 'monthly' },
        gains: [{ stat: 'social', amount: 1, every: 'monthly' }],
        keepPrompt: 'Keep going to pottery class?',
      },
      outcome: 'Your first bowl is lopsided, but it holds soup. In a few weeks you could sell your work.',
    },
    right: SKIP,
  },
  {
    id: 'artisan-market',
    sideQuest: true,
    repeatable: true,
    kicker: '🏺 Pottery',
    image: '🛍️',
    prompt: 'The artisan market has a stall open this weekend. Sell your pottery there?',
    when: (s) => hasCommitment(s, 'pottery') && daysSince(s, 'pottery') >= 21,
    left: {
      label: 'Sell',
      days: 2,
      pay: (s) => (hasFlag(s, 'kiln') ? { min: 200, max: 350 } : { min: 100, max: 200 }),
      effects: { social: 1 },
      outcome: 'Two long days at the stall, and most of your pieces went home with someone.',
    },
    right: { label: 'Not this time', outcome: 'You kept making pots instead.' },
  },
  {
    id: 'pottery-kiln',
    sideQuest: true,
    kicker: '🏺 Pottery',
    image: '🔥',
    prompt: 'Buy your own kiln and glazes for $800? Better pieces sell for more.',
    when: (s) => hasCommitment(s, 'pottery') && daysSince(s, 'pottery') >= 30 && s.wealth >= 800,
    left: {
      label: 'Buy it',
      effects: { wealth: -800, skills: 1 },
      setFlags: ['kiln'],
      outcome: 'Your glazes finally look like the photos. Market pieces now sell for $200–$350.',
    },
    right: { label: 'Not yet', outcome: 'The studio kiln will do for now.' },
  },
  {
    id: 'pottery-wholesale',
    sideQuest: true,
    kicker: '💼 Opportunity',
    image: '☕',
    prompt: 'A café wants to stock your mugs every week. Take the order?',
    when: (s) => hasFlag(s, 'kiln') && hasCommitment(s, 'pottery') && !hasCommitment(s, 'mugs'),
    left: {
      label: 'Take it',
      commit: {
        id: 'mugs', label: 'Café mug orders', image: '☕', hours: 3,
        gains: [{ stat: 'wealth', amount: 60, every: 'weekly', kind: 'income' }],
        keepPrompt: 'Keep making mugs for the café?',
      },
      outcome: 'Your mugs are on the café shelf. +$60/wk.',
    },
    right: { label: 'Too busy', outcome: 'You passed on the order.' },
  },

  // Trading cards → tournaments, rare pulls → hosting tournaments stream
  {
    id: 'tcg-hobby',
    sideQuest: true,
    kicker: '🗺️ Side quest',
    image: '🃏',
    prompt: 'Friends play a trading card game every Thursday. Build a deck and join in?',
    left: {
      label: 'Join',
      commit: {
        id: 'tcg', label: 'Card game', image: '🃏', hours: 3, weekday: 3,
        cost: { amount: -40, every: 'monthly' },
        gains: [{ stat: 'social', amount: 1, every: 'monthly' }],
        keepPrompt: 'Keep playing the card game?',
      },
      outcome: 'You lost every game, and loved it. Booster packs are $40 a month.',
    },
    right: SKIP,
  },
  {
    id: 'tcg-tournament',
    sideQuest: true,
    repeatable: true,
    kicker: '🃏 Card game',
    image: '🏆',
    prompt: 'A regional tournament has a $500–$750 prize. Entry is $30. Play?',
    when: (s) => hasCommitment(s, 'tcg') && daysSince(s, 'tcg') >= 14,
    left: {
      label: 'Play',
      days: 2,
      effects: { wealth: -30 },
      check: {
        stat: 'skills',
        chance: (s) => clampChance(0.08 + 0.05 * s.skills + Math.min(0.15, daysSince(s, 'tcg') / 600)),
        success: { pay: { min: 500, max: 750 }, effects: { social: 1 }, outcome: 'You took first place and the prize money!' },
        fail: { outcome: 'Knocked out in round three. You will get them next time.' },
      },
    },
    right: { label: 'Skip it', outcome: 'You stayed home and sorted your binder.' },
  },
  {
    id: 'tcg-host',
    sideQuest: true,
    kicker: '💼 Opportunity',
    image: '🏪',
    prompt: 'The game shop asks you to host its weekly tournament for $40 a week. Do it?',
    when: (s) => hasCommitment(s, 'tcg') && daysSince(s, 'tcg') >= 45 && s.social >= 3 && !hasCommitment(s, 'tcg-host'),
    left: {
      label: 'Host',
      commit: {
        id: 'tcg-host', label: 'Tournament host', image: '🏪', hours: 2,
        gains: [{ stat: 'wealth', amount: 40, every: 'weekly', kind: 'income' }],
        keepPrompt: 'Keep hosting the weekly tournament?',
      },
      outcome: 'Thursday nights are now your show. +$40/wk.',
    },
    right: { label: 'Just play', outcome: 'You would rather play than run it.' },
  },

  // Vinyl → DJ gigs → gear upgrade, weddings → bar residency stream
  {
    id: 'vinyl-hobby',
    sideQuest: true,
    kicker: '🗺️ Side quest',
    image: '💿',
    prompt: 'Start collecting vinyl records? Crate digging is about $40 a month.',
    left: {
      label: 'Start digging',
      commit: {
        id: 'vinyl', label: 'Vinyl collecting', image: '💿', hours: 2,
        cost: { amount: -40, every: 'monthly' },
        gains: [{ stat: 'social', amount: 1, every: 'monthly' }],
        keepPrompt: 'Keep collecting records?',
      },
      outcome: 'The record shop regulars already know your name.',
    },
    right: SKIP,
  },
  {
    id: 'dj-gig',
    sideQuest: true,
    repeatable: true,
    kicker: '💿 Vinyl',
    image: '🎧',
    prompt: 'A friend needs a DJ for their party on Saturday. Play a set?',
    when: (s) => hasCommitment(s, 'vinyl') && daysSince(s, 'vinyl') >= 21,
    left: {
      label: 'Play',
      pay: (s) => (hasFlag(s, 'dj-gear') ? { min: 250, max: 450 } : { min: 150, max: 300 }),
      effects: { social: 1, health: -2 },
      outcome: 'The dance floor never emptied. They paid you at the end of the night.',
    },
    right: { label: 'Pass', outcome: 'You had an early night instead.' },
  },
  {
    id: 'dj-gear',
    sideQuest: true,
    kicker: '💿 Vinyl',
    image: '🎛️',
    prompt: 'Upgrade to pro turntables and speakers for $1,200? Bigger gigs pay more.',
    when: (s) => hasCommitment(s, 'vinyl') && daysSince(s, 'vinyl') >= 30 && s.wealth >= 1200,
    left: {
      label: 'Upgrade',
      effects: { wealth: -1200, skills: 1 },
      setFlags: ['dj-gear'],
      outcome: 'Your sets sound huge now. Party gigs pay $250–$450, weddings pay more.',
    },
    right: { label: 'Not yet', outcome: 'Your starter setup will do for now.' },
  },
  {
    id: 'dj-residency',
    sideQuest: true,
    kicker: '💼 Opportunity',
    image: '🍸',
    prompt: 'A cocktail bar offers you a Saturday residency for $150 a week. Take it?',
    when: (s) => hasFlag(s, 'dj-gear') && s.social >= 5 && !hasCommitment(s, 'residency'),
    left: {
      label: 'Take it',
      commit: {
        id: 'residency', label: 'DJ residency', image: '🍸', hours: 4, weekday: SAT,
        gains: [{ stat: 'wealth', amount: 150, every: 'weekly', weekday: SAT, kind: 'income' }],
        keepPrompt: 'Keep your Saturday DJ residency?',
      },
      outcome: 'Your name is on the chalkboard outside. +$150/wk.',
    },
    right: { label: 'Too late for me', outcome: 'You like your weekends free.' },
  },

  // Accounting → lower costs, bookkeeping gigs, a rare silent partnership
  {
    id: 'accounting-course',
    sideQuest: true,
    kicker: '🗺️ Side quest',
    image: '🧮',
    prompt: 'Take a 6-week evening accounting course for $40 a week?',
    left: {
      label: 'Enroll',
      effects: { skills: 1 },
      recurring: [
        { label: 'Accounting course', amount: -40, every: 'weekly', durationDays: 42 },
        // Doing your own books and taxes once you finish.
        { label: 'Doing your own books', amount: 25, every: 'monthly', afterDays: 42 },
      ],
      setFlags: ['accounting'],
      outcome: 'Spreadsheets, ledgers and tax law. In 6 weeks you can do your own books, and other people\'s.',
    },
    right: SKIP,
  },
  {
    id: 'bookkeeping-gig',
    sideQuest: true,
    repeatable: true,
    kicker: '🧮 Accounting',
    image: '📒',
    prompt: 'A local shop needs its books sorted out before tax season. Take the job?',
    when: (s) => hasFlag(s, 'accounting') && daysSince(s, 'accounting') >= 42,
    left: {
      label: 'Take it',
      days: 2,
      pay: { min: 200, max: 400 },
      outcome: 'Two days of receipts and spreadsheets. The owner paid you on the spot.',
    },
    right: { label: 'Pass', outcome: 'You were too busy this time.' },
  },

  // Gardening → farmers market produce → restaurant herb deliveries stream; rare bonsai contest
  {
    id: 'garden-plot',
    sideQuest: true,
    kicker: '🗺️ Side quest',
    image: '🌱',
    prompt: 'A community garden has a plot open for $15 a month. Start growing?',
    left: {
      label: 'Plant',
      commit: {
        id: 'garden', label: 'Garden plot', image: '🌱', hours: 3,
        cost: { amount: -15, every: 'monthly' },
        gains: [{ stat: 'health', amount: 5, every: 'monthly' }],
        keepPrompt: 'Keep tending your garden plot?',
      },
      outcome: 'Dirt under your nails and seedlings in the ground. You feel calmer already.',
    },
    right: SKIP,
  },
  {
    id: 'garden-market',
    sideQuest: true,
    repeatable: true,
    kicker: '🌱 Garden',
    image: '🥕',
    prompt: 'Your plot is overflowing. Sell produce at the Saturday farmers market?',
    when: (s) => hasCommitment(s, 'garden') && daysSince(s, 'garden') >= 30,
    left: {
      label: 'Sell',
      pay: { min: 60, max: 140 },
      effects: { social: 1 },
      outcome: 'Your heirloom tomatoes sold out first.',
    },
    right: { label: 'Eat it all', outcome: 'You ate very well this week.' },
  },
  {
    id: 'herb-delivery',
    sideQuest: true,
    kicker: '💼 Opportunity',
    image: '🌿',
    prompt: 'A restaurant chef wants fresh herbs from your plot every week for $50. Deal?',
    when: (s) => hasCommitment(s, 'garden') && daysSince(s, 'garden') >= 45 && !hasCommitment(s, 'herbs'),
    left: {
      label: 'Deal',
      commit: {
        id: 'herbs', label: 'Herb deliveries', image: '🌿', hours: 2,
        gains: [{ stat: 'wealth', amount: 50, every: 'weekly', kind: 'income' }],
        keepPrompt: 'Keep delivering herbs to the restaurant?',
      },
      outcome: 'Your basil is on the menu. +$50/wk.',
    },
    right: { label: 'Not now', outcome: 'You are growing for yourself for now.' },
  },

  // Photography → event shoots → better lenses; rare magazine sale or limited print
  {
    id: 'photo-hobby',
    sideQuest: true,
    kicker: '🗺️ Side quest',
    image: '📷',
    prompt: 'Buy a used camera for $300 and start taking photography seriously?',
    when: (s) => s.wealth >= 300,
    left: {
      label: 'Buy it',
      effects: { wealth: -300 },
      commit: {
        id: 'photo', label: 'Photography', image: '📷', hours: 2,
        gains: [{ stat: 'skills', amount: 1, every: 'monthly', afterDays: 30 }],
        keepPrompt: 'Keep up your photography?',
      },
      outcome: 'Golden hour walks, every evening. Your photos get better each week.',
    },
    right: SKIP,
  },
  {
    id: 'photo-gig',
    sideQuest: true,
    repeatable: true,
    kicker: '📷 Photography',
    image: '📸',
    prompt: 'Someone needs photos of their event or family portraits. Book the shoot?',
    when: (s) => hasCommitment(s, 'photo') && daysSince(s, 'photo') >= 21,
    left: {
      label: 'Shoot it',
      pay: (s) => (hasFlag(s, 'lens') ? { min: 220, max: 400 } : { min: 120, max: 250 }),
      outcome: 'They loved the photos and tagged you everywhere.',
    },
    right: { label: 'Pass', outcome: 'You were not free that day.' },
  },
  {
    id: 'photo-lens',
    sideQuest: true,
    kicker: '📷 Photography',
    image: '🔭',
    prompt: 'Buy a pro lens for $900? Sharper photos mean higher rates.',
    when: (s) => hasCommitment(s, 'photo') && daysSince(s, 'photo') >= 30 && s.wealth >= 900,
    left: {
      label: 'Buy it',
      effects: { wealth: -900, skills: 1 },
      setFlags: ['lens'],
      outcome: 'Creamy backgrounds, crisp faces. Shoots now pay $220–$400.',
    },
    right: { label: 'Not yet', outcome: 'The kit lens will do for now.' },
  },

  // Bike repair → flipping thrifted bikes → weekend repair stand stream; rare vintage frame
  {
    id: 'bike-repair',
    sideQuest: true,
    kicker: '🗺️ Side quest',
    image: '🔧',
    prompt: 'Buy $150 of tools and learn to fix bikes in your free time?',
    when: (s) => s.wealth >= 150,
    left: {
      label: 'Learn',
      effects: { wealth: -150 },
      commit: {
        id: 'bikes', label: 'Bike repair', image: '🔧', hours: 3,
        gains: [{ stat: 'skills', amount: 1, every: 'monthly', afterDays: 30 }],
        keepPrompt: 'Keep fixing bikes?',
      },
      outcome: 'Greasy hands and a wall of tools. Neighbors are already asking for tune-ups.',
    },
    right: SKIP,
  },
  {
    id: 'bike-flip',
    sideQuest: true,
    repeatable: true,
    kicker: '🔧 Bike repair',
    image: '🚲',
    prompt: 'A thrift store has a beat-up bike for $60. Fix it up and flip it?',
    when: (s) => hasCommitment(s, 'bikes') && daysSince(s, 'bikes') >= 21 && s.wealth >= 60,
    left: {
      label: 'Flip it',
      days: 2,
      effects: { wealth: -60 },
      pay: { min: 140, max: 260 },
      outcome: 'New tires, true wheels, fresh chain. Sold to the first person who test-rode it.',
    },
    right: { label: 'Pass', outcome: 'Not worth the trouble.' },
  },
  {
    id: 'bike-stand',
    sideQuest: true,
    kicker: '💼 Opportunity',
    image: '🛠️',
    prompt: 'Open a weekend bike repair stand at the park? About $90 a week.',
    when: (s) => hasCommitment(s, 'bikes') && daysSince(s, 'bikes') >= 45 && s.skills >= 5 && !hasCommitment(s, 'bike-stand'),
    left: {
      label: 'Open it',
      commit: {
        id: 'bike-stand', label: 'Repair stand', image: '🛠️', hours: 4, weekday: SAT,
        gains: [{ stat: 'wealth', amount: 90, every: 'weekly', weekday: SAT, kind: 'income' }],
        keepPrompt: 'Keep running your weekend repair stand?',
      },
      outcome: 'A line of flat tires every Saturday. +$90/wk.',
    },
    right: { label: 'Not yet', outcome: 'You will keep it a hobby for now.' },
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
      outcome: c.dropOutcome ?? `You let go of ${c.label.toLowerCase()} and got ${c.hours}h back ${scheduleText(c)}.`,
    },
    right: { label: 'Keep', outcome: `${c.label} stays.` },
  };
}

// ---------- Surprise events ----------
// Same shape as cards, but they interrupt the deck on the days planned by planEvents.
// Events are repeatable unless `once: true`. `big: true` events wait until
// BIG_EXPENSES_AFTER swipes have passed.
export const EVENTS = [
  {
    id: 'parent-help',
    image: '🏠',
    weight: (s) => (s.household.single ? 1.5 : 0.3),
    build: (s, rng) => {
      const bills = ['electric bill', 'car repair', 'groceries', 'water bill', 'prescription'];
      const bill = bills[Math.floor(rng() * bills.length)];
      const amount = (s.household.single ? 40 : 20) + Math.floor(rng() * 9) * 10;
      const who = s.household.single ? s.household.parent : 'Your parents';
      return {
        prompt: `${who} ${s.household.single ? 'is' : 'are'} short on the ${bill} this month. Chip in $${amount}?`,
        left: { label: 'Help out', effects: { wealth: -amount, social: 1 }, outcome: 'They hugged you a little longer than usual.' },
        right: { label: "Can't right now", effects: { social: -1 }, outcome: 'They said they understand. It still stings.' },
      };
    },
    left: { label: 'Help out' },
    right: { label: "Can't right now" },
  },
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
      effects: { health: -5 },
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
      effects: { wealth: -150 },
      busy: 8,
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
      busy: 1,
      outcome: 'An hour on hold with the city, but paid. Lesson learned about street cleaning day.',
    },
    right: {
      label: 'Contest it',
      busy: 4,
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
  // --- Errands: small costs that mostly eat into today's free time ---
  {
    id: 'dmv-errand',
    image: '🪪',
    prompt: 'Your ID expires this week. Spend the afternoon in line at the DMV?',
    left: {
      label: 'Go today',
      busy: 4,
      effects: { wealth: -25 },
      outcome: 'Four hours, one terrible photo and a $25 fee. Done.',
    },
    right: {
      label: 'Put it off',
      recurring: [{ label: 'Late ID renewal', amount: -60, inDays: 14 }],
      outcome: 'You will go later. A $35 late fee is coming on top of the $25.',
    },
  },
  {
    id: 'airport-ride',
    image: '✈️',
    prompt: 'A friend needs a ride to the airport, plus help with their bags.',
    left: {
      label: 'Drive them',
      busy: 3,
      effects: { social: 1 },
      outcome: 'Traffic both ways, but they owe you one.',
    },
    right: {
      label: 'Can\'t today',
      effects: { social: -1 },
      outcome: 'They took a pricey cab and mentioned it twice.',
    },
  },
  {
    id: 'internet-down',
    image: '📡',
    prompt: 'Your internet is down. The technician\'s window is 8 a.m. to 4 p.m.',
    left: {
      label: 'Wait for them',
      busy: 6,
      outcome: 'They showed up at 3:55. Fixed, but your day is gone.',
    },
    right: {
      label: 'Fix it yourself',
      busy: 2,
      check: {
        stat: 'skills',
        chance: (s) => clampChance(0.3 + 0.07 * s.skills),
        success: { effects: { skills: 1 }, outcome: 'You reset the router config yourself. +1 skill.' },
        fail: { effects: { wealth: -40 }, outcome: 'Two hours in, you gave up and paid $40 for a same-day visit.' },
      },
    },
  },
  {
    id: 'jury-duty',
    weight: () => 0.3,
    image: '⚖️',
    prompt: 'You have been called for jury duty. It pays $40 a day.',
    left: {
      label: 'Serve',
      days: 2,
      busy: 8,
      effects: { wealth: 80, social: 1 },
      outcome: 'Two long days in court. Civic duty done, and $80 for your trouble.',
    },
    right: {
      label: 'Postpone',
      outcome: 'Rescheduled. They will call again.',
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
    id: 'layoffs',
    // Low social = likelier to be the one let go. Social 0: 2.5×, 3: 1×, 5+: rare.
    weight: (s) => Math.max(0.1, 2.5 - 0.5 * s.social),
    image: '📦',
    prompt: 'Layoffs at work. Your manager calls you in and says your role is being cut.',
    when: (s) => hasJob(s),
    left: {
      label: 'Make your case',
      check: {
        stat: 'social',
        chance: (s) => socialOdds(0.1, s),
        success: { outcome: 'Your coworkers vouched for you. You keep your job.' },
        fail: { fire: true, outcome: 'It did not change their mind. You are out of a job.' },
      },
    },
    right: {
      label: 'Take severance',
      fire: true,
      effects: (s) => ({ wealth: 2 * jobIncome(s) }),
      outcome: 'You walked out with two weeks of pay as severance.',
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
            job: { label: 'Job from a party contact', amount: 180, every: 'weekly', hours: 6 },
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
        dropOutcome: 'A friend gave your cat a loving new home. You got your time back.',
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
            job: { label: 'Job from the mixer', amount: 200, every: 'weekly', skillPay: true, hours: 7 },
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
    prompt: 'Your neighbor asks for help moving today.',
    left: {
      label: 'Help',
      busy: 6,
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
        id: 'gigs', label: 'Weekend gigs', image: '🎤', hours: 3, weekday: SAT,
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
        id: 'dogs', label: 'Dog walking', image: '🐕', hours: 1, weekdays: [0, 1, 2, 3, 4],
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

  // --- Side-quest moments: rare finds, big gigs, collector offers ---
  {
    id: 'sculpture-buyer',
    weight: () => 0.4,
    kicker: '🏺 Pottery',
    image: '🗿',
    prompt: 'A gallery owner loves one of your sculptures and offers $500 for it.',
    when: (s) => hasCommitment(s, 'pottery') && daysSince(s, 'pottery') >= 21,
    left: { label: 'Sell', effects: { wealth: 500 }, outcome: 'Sold! Your first piece in a gallery.' },
    right: {
      label: 'Keep it',
      item: { label: 'Sculpture', image: '🗿', value: 500 },
      outcome: 'You kept it. As your name grows, it could be worth more.',
    },
  },
  {
    id: 'rare-card',
    weight: () => 0.4,
    kicker: '🃏 Card game',
    image: '✨',
    prompt: 'You opened a rare holo card in a booster pack! It is worth about $600.',
    when: (s) => hasCommitment(s, 'tcg'),
    left: { label: 'Sell', effects: { wealth: 600 }, outcome: 'A collector paid $600 the same day.' },
    right: {
      label: 'Keep it',
      item: { label: 'Rare holo card', image: '✨', value: 600 },
      outcome: 'Into a hard case it goes. Card prices tend to climb.',
    },
  },
  {
    id: 'wedding-dj',
    weight: () => 0.5,
    kicker: '💿 Vinyl',
    image: '💒',
    prompt: 'A couple wants you to DJ their wedding reception. It pays $1,000.',
    when: (s) => hasCommitment(s, 'vinyl') && daysSince(s, 'vinyl') >= 45,
    left: {
      label: 'Pitch them',
      check: {
        stat: 'social',
        chance: (s) => socialOdds(hasFlag(s, 'dj-gear') ? 0.35 : 0.15, s),
        success: {
          pay: (s) => (hasFlag(s, 'dj-gear') ? { min: 1200, max: 1400 } : { min: 1000, max: 1000 }),
          effects: { social: 2, health: -3 },
          outcome: 'They booked you. A long night, a packed floor and a big check.',
        },
        fail: { outcome: 'They went with a DJ who had more wedding reviews.' },
      },
    },
    right: { label: 'Not my scene', outcome: 'Weddings are not for you.' },
  },
  {
    id: 'silent-partner',
    once: true,
    weight: () => 0.3,
    kicker: '🧮 Accounting',
    image: '🥐',
    when: (s) => hasFlag(s, 'accounting') && daysSince(s, 'accounting') >= 42,
    // The size of the stake is picked when the card is drawn.
    build: (s, rng) => {
      const share = 300 + Math.floor(rng() * 21) * 10; // $300–$500 a week
      return {
        prompt: `A family bakery is drowning in debt. Spend a week fixing their books for a silent-partner stake worth about $${share}/wk?`,
        left: {
          label: 'Help them',
          days: 7,
          check: {
            stat: 'skills',
            chance: (st) => clampChance(0.3 + 0.06 * st.skills),
            success: {
              recurring: [{ label: 'Bakery partnership', amount: share, every: 'weekly', kind: 'income', afterDays: 14 }],
              setFlags: ['silent-partner'],
              outcome: `You turned the bakery around. As a silent partner you get $${share}/wk, starting in two weeks.`,
            },
            fail: { outcome: 'You tried, but the bakery closed anyway. At least they thanked you.' },
          },
        },
        right: { label: 'Too risky', outcome: 'You wished them luck.' },
      };
    },
  },
  {
    id: 'bonsai-contest',
    weight: () => 0.4,
    kicker: '🌱 Garden',
    image: '🌳',
    prompt: 'The botanical garden is holding a bonsai contest. Enter the juniper you have been shaping?',
    when: (s) => hasCommitment(s, 'garden') && daysSince(s, 'garden') >= 60,
    left: {
      label: 'Enter',
      effects: { wealth: -20 },
      check: {
        stat: 'skills',
        chance: (s) => clampChance(0.15 + 0.05 * s.skills + Math.min(0.15, daysSince(s, 'garden') / 800)),
        success: { pay: { min: 400, max: 600 }, effects: { social: 1 }, outcome: 'Best in show! The judges loved its windswept shape.' },
        fail: { effects: { social: 1 }, outcome: 'An honorable mention, and a few new gardening friends.' },
      },
    },
    right: { label: 'Not ready', outcome: 'Bonsai takes patience. Maybe next year.' },
  },
  {
    id: 'magazine-photo',
    weight: () => 0.4,
    kicker: '📷 Photography',
    image: '🖼️',
    prompt: 'A magazine wants to buy one of your photos for $400.',
    when: (s) => hasCommitment(s, 'photo') && daysSince(s, 'photo') >= 30,
    left: { label: 'Sell', effects: { wealth: 400, social: 1 }, outcome: 'Your photo is in print, with your name under it.' },
    right: {
      label: 'Keep it',
      item: { label: 'Limited print', image: '🖼️', value: 400 },
      outcome: 'You made a signed, limited run instead. Prints like this can gain value.',
    },
  },
  {
    id: 'vintage-frame',
    weight: () => 0.4,
    kicker: '🔧 Bike repair',
    image: '🚴',
    prompt: 'Buried in a garage sale pile: a rare vintage racing frame worth about $450.',
    when: (s) => hasCommitment(s, 'bikes') && daysSince(s, 'bikes') >= 21,
    left: { label: 'Sell', effects: { wealth: 450 }, outcome: 'A collector drove two hours to buy it.' },
    right: {
      label: 'Keep it',
      item: { label: 'Vintage frame', image: '🚴', value: 450 },
      outcome: 'It is hanging on your wall. Vintage frames tend to climb in value.',
    },
  },
  {
    id: 'collector-offer',
    weight: () => 0.8,
    kicker: '💰 Offer',
    image: '🧐',
    when: (s) => s.items.length > 0,
    // Picks one of your collectibles and an offer around its current value.
    build: (s, rng) => {
      const item = s.items[Math.floor(rng() * s.items.length)];
      const offer = Math.round((item.value * (0.9 + rng() * 0.3)) / 10) * 10;
      return {
        image: item.image,
        prompt: `A collector offers ${money(offer)} for your ${item.label.toLowerCase()}. It is valued around ${money(item.value)}.`,
        left: { label: 'Sell', effects: { wealth: offer }, sell: item.id, outcome: `Sold your ${item.label.toLowerCase()} for ${money(offer)}.` },
        right: { label: 'Hold', outcome: 'You are holding out for more.' },
      };
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
    right: { label: 'Keep looking', busy: 2, outcome: 'Two hours of open houses, and you passed on this one.' },
  };
}

// ---------- Rentals ----------
// Rent and utilities are monthly. A roommate makes it cheaper, but they have
// to pick you (a social check).
const RENTAL_TYPES = [
  { type: 'Room in a shared house', image: '🛏️', rent: [260, 340], utilities: [30, 45], roommate: true,
    size: 'Bedroom, shared kitchen', blurb: 'three housemates, one bathroom', gains: [{ stat: 'social', amount: 1, every: 'monthly' }] },
  { type: '2-bed apartment', image: '🏢', rent: [380, 460], utilities: [40, 55], roommate: true,
    size: '2 bed, your half', blurb: 'split with a roommate', gains: [{ stat: 'social', amount: 1, every: 'monthly' }] },
  { type: 'Basement apartment', image: '🚪', rent: [400, 480], utilities: [50, 70], roommate: false,
    size: '1 bed', blurb: 'a little damp, very quiet', health: -3 },
  { type: 'Studio apartment', image: '🏬', rent: [520, 620], utilities: [60, 80], roommate: false,
    size: 'Studio', blurb: 'small, bright and all yours', health: 5 },
  { type: '1-bed apartment', image: '🏙️', rent: [650, 780], utilities: [80, 100], roommate: false,
    size: '1 bed', blurb: 'room to host friends', gains: [{ stat: 'social', amount: 1, every: 'monthly' }] },
  { type: 'Downtown loft', image: '🌆', rent: [850, 980], utilities: [90, 120], roommate: false,
    size: 'Open plan', blurb: 'exposed brick, bars downstairs', social: 2, gains: [{ stat: 'social', amount: 1, every: 'monthly' }] },
];

export function makeRental(rng = Math.random) {
  const t = RENTAL_TYPES[Math.floor(rng() * RENTAL_TYPES.length)];
  return {
    type: t.type, image: t.image, size: t.size, blurb: t.blurb, roommate: t.roommate,
    rent: roundTo(between(t.rent, rng), 10),
    utilities: roundTo(between(t.utilities, rng), 5),
    health: t.health ?? 0, social: t.social ?? 0, gains: t.gains ?? [],
  };
}

// A swipe card for one rental listing. Signing costs a deposit (one month's rent).
export function rentalCard(r) {
  const moveIn = {
    rental: r,
    effects: { wealth: -r.rent, health: 5 + r.health, ...(r.social ? { social: r.social } : {}) },
    recurring: [
      { label: 'Rent', amount: -r.rent, every: 'monthly', tag: 'rent' },
      { label: 'Utilities', amount: -r.utilities, every: 'monthly', tag: 'home' },
      ...r.gains.map((g) => ({ label: r.roommate ? 'Roommate' : r.type, ...g, tag: 'home', afterDays: 30 })),
    ],
    outcome: `You moved into your ${r.type.toLowerCase()}: ${r.blurb}. Your own place!`,
  };
  const left = r.roommate
    ? {
        label: 'Apply',
        effects: moveIn.effects,
        recurring: moveIn.recurring,
        check: {
          stat: 'social',
          chance: (s) => socialOdds(0.45, s),
          success: { rental: r, recurring: moveIn.recurring, effects: moveIn.effects, outcome: `The roommate picked you! ${moveIn.outcome}` },
          fail: { outcome: 'The roommate went with someone they clicked with more.' },
        },
        preview: true, // effects shown on the card only apply if the check passes
      }
    : { label: 'Sign lease', ...moveIn };
  return {
    id: 'rental-listing',
    repeatable: true,
    kicker: '🔑 For rent',
    image: r.image,
    prompt: `${r.type}, ${r.blurb}. ${r.roommate ? 'Apply to move in?' : 'Sign the lease?'}`,
    rental: r,
    details: [
      ['Type', r.type],
      ['Size', r.size],
      ['Rent', `$${r.rent}/mo`],
      ['Utilities', `$${r.utilities}/mo`],
      ['Roommate', r.roommate ? 'Yes' : 'No'],
      ['Deposit', `$${r.rent}`],
    ],
    left,
    right: { label: 'Keep looking', busy: 1, outcome: 'You spent an hour touring it, then walked away.' },
  };
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)] ?? null;

// Weighted pick; cards without a `weight` function count as 1 (side quests less).
function pickWeighted(list, stats, rng) {
  const weights = list.map((c) => (c.weight ? c.weight(stats) : c.sideQuest ? SIDE_QUEST_WEIGHT : 1));
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

  const lodging = lodgingCard(stats, rng);
  if (lodging) return lodging;

  if (hasCommitment(stats, 'therapy') && stats.day >= stats.nextTherapy) return THERAPY_SESSION;

  // House hunting: once the down payment is saved, listings show up often.
  if (!isHomeowner(stats) && stats.wealth >= DOWN_PAYMENT_GOAL && rng() < HOUSE_LISTING_CHANCE) {
    return houseCard(makeHouse(rng));
  }
  // Apartment hunting: once you have income and have cleared your debt.
  if (rentalsUnlocked(stats) && lastId !== 'rental-listing' && rng() < RENTAL_LISTING_CHANCE) {
    return rentalCard(makeRental(rng));
  }

  const eligible = (list) =>
    list.filter((c) =>
      c.id !== lastId &&
      !stats.usedCards.includes(c.id) &&
      (!c.big || stats.swipes >= BIG_EXPENSES_AFTER) &&
      (!c.when || c.when(stats)));

  // A planned day that a multi-day card skipped over still fires, on the next swipe that week.
  // The first surprise always lands on swipe `eventsFrom` (13–16).
  const firstSurprise = !stats.hadEvent && stats.swipes + 1 >= stats.eventsFrom;
  if (stats.swipes + 1 >= stats.eventsFrom && (firstSurprise || stats.eventPlan.days.some((d) => d <= stats.day))) {
    const event = pickWeighted(eligible(EVENTS), stats, rng);
    // Some events fill in details when drawn (which item, how much).
    if (event) return event.build ? { ...event, ...event.build(stats, rng) } : event;
  }
  const early = stats.swipes < stats.lowStakesUntil;
  const deck = eligible(early ? DECISIONS.filter((c) => LOW_STAKES.has(c.id)) : DECISIONS);
  if (deck.length) {
    const card = pickWeighted(deck, stats, rng);
    return card.build ? { ...card, ...card.build(stats, rng) } : card;
  }
  // Only the last card is eligible: allow the repeat rather than ending the game.
  return DECISIONS.find((c) => c.id === lastId && (!c.when || c.when(stats))) ?? null;
}

// ---------- Display ----------
export const STAT_META = {
  wealth: { label: 'Wealth', format: (v) => money(v) },
  social: { label: 'Social', format: (v) => `${v}` },
  skills: { label: 'Skills', format: (v) => `${v}` },
  health: { label: 'Health', format: (v) => `${Math.round(v)}` },
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

let itemId = 0;

function startCommitment(next, c) {
  if (next.commitments.some((x) => x.id === c.id)) return;
  next.since[c.id] = next.day;
  next.commitments.push({
    id: c.id, label: c.label, image: c.image, hours: c.hours, ...planCommitment(c, next),
    keepPrompt: c.keepPrompt, dropLabel: c.dropLabel, dropOutcome: c.dropOutcome,
  });
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
function applyResult(next, result, before, ledger, rng = Math.random) {
  if (!result) return;
  if (result.lodge || result.rental || result.house) {
    // Settling somewhere new ends couch surfing, the shelter, and chipping in at home.
    next.flows = next.flows.filter((f) => f.tag !== 'lodging');
    next.lodging = result.lodge && result.lodge !== 'home'
      ? { kind: result.lodge, host: result.host ?? null, next: next.day + 7 }
      : null;
    next.housingPrompt = null;
  }
  if (result.stay) next.lodging = { ...next.lodging, next: next.day + 7 };
  if (result.housingPrompt) next.housingPrompt = result.housingPrompt;
  const pay = resolve(result.pay, before);
  if (pay) {
    const amount = pay.min + Math.floor(rng() * ((pay.max - pay.min) / 10 + 1)) * 10;
    next.wealth += amount;
    ledger['One-time'] = (ledger['One-time'] ?? 0) + amount;
  }
  if (result.item) next.items.push({ id: ++itemId, ...result.item, since: next.day });
  if (result.sell) next.items = next.items.filter((i) => i.id !== result.sell);
  for (const flag of result.setFlags ?? []) if (next.since[flag] == null) next.since[flag] = next.day;
  const effects = resolve(result.effects, before);
  addEffects(next, effects);
  if (effects?.wealth) ledger['One-time'] = (ledger['One-time'] ?? 0) + effects.wealth;
  for (const def of result.recurring ?? []) next.flows.push(makeFlow(def, next.day));
  for (const flag of result.setFlags ?? []) if (!next.flags.includes(flag)) next.flags.push(flag);
  if (result.job) {
    const job = { weekday: PAYDAY, ...result.job, amount: jobPay(result.job, before), kind: 'job' };
    next.flows.push(makeFlow(job, next.day + (result.startsIn ?? 0)));
  }
  if (result.fire) next.flows = next.flows.filter((f) => f.kind !== 'job');
  if (result.raise) {
    next.flows = next.flows.map((f) =>
      f.kind === 'job' ? { ...f, amount: Math.round(f.amount * (1 + result.raise)) } : f);
  }
  if (result.commit) startCommitment(next, result.commit);
  if (result.drop) dropCommitment(next, result.drop);
  if (result.reassess) next.queue = next.commitments.map((c) => c.id);
  if (result.rental) {
    // Moving out: the allowance stops, rent and utilities start.
    next.rental = { ...result.rental, behind: 0, since: next.day };
    next.since.movedOut = next.since.movedOut ?? next.day;
    next.flows = next.flows.filter((f) => f.tag !== 'allowance');
  }
  if (result.house) {
    next.house = result.house;
    // Buying ends any lease.
    if (next.rental) {
      next.rental = null;
      next.flows = next.flows.filter((f) => f.tag !== 'rent' && f.tag !== 'home');
    }
  }
}

// Evicted: the lease ends and you move back in with your family.
function evict(next) {
  next.rental = null;
  next.flows = next.flows.filter((f) => f.tag !== 'rent' && f.tag !== 'home');
  next.health -= EVICTION_HEALTH_LOSS;
  next.since.evicted = next.day;
  next.housingPrompt = 'evicted';
}

// ---------- Where to stay after an eviction ----------
// Each option costs something: home costs money, a couch costs social,
// the shelter costs health.
const HOSTS = ['Sam', 'Priya', 'Marcus', 'Jess', 'Leo', 'Ana'];
export const SHELTER_HEALTH_PER_WEEK = -4;
export const HOME_CHIP_IN = -25;

function lodgingChoice(kind, s, host) {
  const parent = s.household.single ? s.household.parent : 'your parents';
  if (kind === 'home') {
    return {
      label: 'Move back home', lodge: 'home', effects: { social: -1 },
      recurring: [{ label: 'Chipping in at home', amount: HOME_CHIP_IN, every: 'weekly', weekday: MON, tag: 'lodging' }],
      outcome: `You move back in with ${parent}. This time they ask you to chip in $${-HOME_CHIP_IN} a week.`,
    };
  }
  if (kind === 'couch') {
    return {
      label: 'Crash on a couch', lodge: 'couch', host,
      note: '🛋️ Free, but -1 social each week you stay',
      outcome: `${host} says you can crash on their couch for a while. Every week there costs a little goodwill.`,
    };
  }
  return {
    label: 'Go to a shelter', lodge: 'shelter',
    recurring: [{ label: 'Shelter', stat: 'health', amount: SHELTER_HEALTH_PER_WEEK, every: 'weekly', afterDays: 7, tag: 'lodging' }],
    outcome: 'A free bed at the shelter. It is loud, and you sleep badly.',
  };
}

// The next housing card, if one is waiting: a where-to-stay prompt, or the
// weekly check-in while you're on a couch or at the shelter.
export function lodgingCard(s, rng = Math.random) {
  const host = s.lodging?.host ?? HOSTS[Math.floor(rng() * HOSTS.length)];
  const base = { repeatable: true, housing: true, kicker: '🏚️ Housing' };
  if (s.housingPrompt === 'evicted') {
    return {
      ...base, id: 'evicted', image: '📦', days: 0,
      prompt: 'You have been evicted. Where will you stay?',
      left: lodgingChoice('home', s, host),
      right: { label: 'Other options', note: '🛋️ A friend\'s couch or 🏚️ a shelter', housingPrompt: ['couch', 'shelter'], outcome: 'You start texting friends and looking up shelters.' },
    };
  }
  if (Array.isArray(s.housingPrompt)) {
    const [a, b] = s.housingPrompt;
    return {
      ...base, id: 'lodging-options', image: '🧳', days: 0,
      prompt: a === 'couch' ? "Crash on a friend's couch, or check into a shelter?" : 'Where to next?',
      left: lodgingChoice(a, s, host),
      right: lodgingChoice(b, s, host),
    };
  }
  if (s.lodging && s.day >= s.lodging.next) {
    const weeks = Math.max(1, Math.round((s.day - (s.since.evicted ?? s.day)) / 7));
    if (s.lodging.kind === 'couch') {
      return {
        ...base, id: 'couch-week', image: '🛋️',
        prompt: `Week ${weeks} on ${host}'s couch. They're being nice, but it's wearing thin. Stay another week?`,
        left: { label: 'Stay a week', stay: true, effects: { social: -1 }, outcome: `${host} sighs a little louder each morning.` },
        right: { label: 'Move on', housingPrompt: ['home', 'shelter'], days: 0, outcome: `You thank ${host} and pack your bag.` },
      };
    }
    return {
      ...base, id: 'shelter-week', image: '🏚️',
      prompt: `Week ${weeks} at the shelter. Stay another week?`,
      left: { label: 'Stay', stay: true, note: `🏚️ ${SHELTER_HEALTH_PER_WEEK} health a week`, outcome: 'Another week of thin mattresses and early wake-ups.' },
      right: { label: 'Move on', housingPrompt: ['home', 'couch'], days: 0, outcome: 'You pack your things.' },
    };
  }
  return null;
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
    items: [...stats.items],
    since: { ...stats.since },
    queue: card.queued ? stats.queue.slice(1) : [...stats.queue],
    usedCards: card.repeatable ? stats.usedCards : [...stats.usedCards, card.id],
    goalsDone: [...stats.goalsDone],
    swipes: stats.swipes + 1,
  };
  const ledger = {}; // money in/out this turn, by label
  const gains = {};  // stat changes from commitments this turn: { label: { social: 1 } }
  let outcome = choice.outcome ?? '';

  // A roommate listing only takes effect if the check passes.
  if (!choice.preview) applyResult(next, choice, stats, ledger, rng);

  const days = choice.days ?? card.days ?? DEFAULT_DAYS_PER_TURN;

  if (choice.apply) {
    const hired = rng() < jobChance(choice.apply, stats);
    next.flags = next.flags.filter((f) => f !== 'job-lead'); // a job lead is used up by applying
    // The job starts once the application wait is over, so no pay during it.
    const job = { job: choice.apply.job, effects: choice.apply.effects, startsIn: days };
    if (hired) applyResult(next, job, stats, ledger, rng);
    outcome = hired ? choice.apply.success : choice.apply.fail;
  }

  if (choice.check) {
    const passed = rng() < choiceChance(choice, stats);
    const result = pickResult(passed ? choice.check.success : choice.check.fail, stats, rng);
    applyResult(next, result, stats, ledger, rng);
    const label = choice.check.stat ? `${STAT_META[choice.check.stat].label} check` : 'Roll';
    // Rare run-ins only mention themselves when they happen.
    outcome = choice.check.rare
      ? `${passed ? '✨ ' : ''}${result?.outcome ?? ''}`
      : `${passed ? '✅' : '❌'} ${label} ${passed ? 'passed' : 'failed'}. ${result?.outcome ?? ''}`;
  }

  next.health = Math.max(0, Math.min(100, next.health));
  const healthBefore = next.health;
  const healthCauses = new Set();
  let evicted = false;
  const busy = choice.busy ?? 0;
  for (let d = next.day; d < next.day + days; d++) {
    // Collectibles: each month held, value moves -5%…+15% (usually up).
    next.items = next.items.map((it) =>
      d > it.since && (d - it.since) % 30 === 0
        ? { ...it, value: Math.round(it.value * (0.95 + rng() * 0.2)) }
        : it);
    for (const flow of next.flows) {
      if (!isDue(flow, d)) continue;
      if (flow.chance != null && rng() >= flow.chance) continue;
      if (choice.pauseIncome && isIncomeStream(flow)) continue;
      if (flow.stat === 'wealth') {
        next.wealth += flow.amount;
        ledger[flow.label] = (ledger[flow.label] ?? 0) + flow.amount;
        // Rent day: if paying it put you in the red, you're behind on rent.
        if (flow.tag === 'rent' && next.rental) {
          next.rental = { ...next.rental, behind: next.wealth < 0 ? next.rental.behind + 1 : 0 };
          if (next.rental.behind > 0) healthCauses.add('🏚️ Behind on rent');
          if (next.rental.behind >= EVICTION_MONTHS) {
            evict(next);
            evicted = true;
            healthCauses.add('🏚️ Evicted');
          }
        }
      } else {
        next[flow.stat] += flow.amount;
        gains[flow.label] = gains[flow.label] ?? {};
        gains[flow.label][flow.stat] = (gains[flow.label][flow.stat] ?? 0) + flow.amount;
      }
    }

    // Day by day: a day short on sleep costs health (more for each hour short)
    // and social; a day in debt slowly drains health; a rested, debt-free day
    // slowly recovers it.
    let rate = 0; // per week
    const free = freeHours(next, d, busy);
    const overcommitted = free < SLEEP_HOURS;
    if (overcommitted) {
      next.health -= sleepPenalty(free);
      const lost = SOCIAL_LOSS_PER_OVERCOMMITTED_DAY; // social can go below zero
      next.social -= lost;
      if (lost) {
        gains['Short on sleep'] = gains['Short on sleep'] ?? {};
        gains['Short on sleep'].social = (gains['Short on sleep'].social ?? 0) - lost;
      }
      healthCauses.add('😴 Short on sleep');
      next.overDays = [...(next.overDays ?? []).filter((x) => x > d - 7), d];
    }
    if (next.wealth < 0) { rate -= DEBT_HEALTH_LOSS_PER_WEEK; healthCauses.add('💳 In debt'); }
    if (rate === 0 && !overcommitted) rate = HEALTH_GAIN_PER_WEEK;
    // Kept fractional so small daily drains add up; shown rounded.
    next.health = Math.max(0, Math.min(100, +(next.health + rate / 7).toFixed(3)));
  }
  if (card.event) {
    next.hadEvent = true;
    const due = next.eventPlan.days.filter((d) => d <= stats.day);
    const used = Math.min(...due);
    next.eventPlan = { ...next.eventPlan, days: next.eventPlan.days.filter((d) => d !== used) };
  }
  next.day += days;
  if (weekOf(next.day) !== next.eventPlan.week) next.eventPlan = planEvents(next.day, rng);
  next.flows = next.flows.filter((f) => f.endDay === null || f.endDay > next.day);
  next.skills = Math.max(0, next.skills);
  if (card.therapy) next.nextTherapy = next.day + THERAPY_EVERY;

  // Stretched thin: time to rethink your commitments.
  const recentOver = (next.overDays ?? []).filter((x) => x > next.day - 7).length;
  const lastCheckin = next.since.checkin;
  if (recentOver >= STRETCHED_DAYS && next.commitments.length && !next.queue.length &&
      (lastCheckin == null || next.day - lastCheckin >= CHECKIN_COOLDOWN)) {
    next.queue = next.commitments.map((c) => c.id);
    next.since.checkin = next.day;
    outcome = `${outcome} 😴 You're stretched thin. Time to rethink your commitments.`.trim();
  }

  next.health = Math.max(0, Math.min(100, next.health));
  const healthDelta = Math.round(next.health) - Math.round(healthBefore);

  if (evicted) {
    outcome = `${outcome} 🏚️ Evicted after ${EVICTION_MONTHS} months behind on rent. -${EVICTION_HEALTH_LOSS} health.`.trim();
  }

  const newGoals = GOALS.filter((g) => !next.goalsDone.includes(g.id) && g.isDone(next));
  next.goalsDone.push(...newGoals.map((g) => g.id));

  // The only way to lose: health hits 0 (from debt, lack of sleep, or both).
  const gameOver = next.health < 0.5 ? 'health' : null;

  return { stats: next, ledger, gains, outcome, newGoals, healthDelta, healthCauses: [...healthCauses], gameOver };
}
