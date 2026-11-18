const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ---------- Tuning ----------
export const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 30 };
const PERIOD_SHORT = { daily: 'day', weekly: 'wk', monthly: 'mo' };
export const DEFAULT_DAYS_PER_TURN = 7;
export const GAME_OVER_AT = -100; // wealth at or below this ends the game
const COST_OF_LIVING = { label: 'Cost of living', amount: -20, every: 'weekly' };
export const EVENT_CHANCE = 0.25; // chance each turn that a surprise event interrupts the deck

// Sleep & health: under SLEEP_THRESHOLD hours of spare time means you're under-slept.
export const SLEEP_THRESHOLD = 6;
export const LOW_HEALTH = 50;            // below this: more medical events, worse job odds
const HEALTH_LOSS_PER_WEEK = 10;         // while under-slept
const HEALTH_GAIN_PER_WEEK = 5;          // while rested
const LOW_HEALTH_JOB_PENALTY = 0.15;     // subtracted from job application odds

// ---------- Helpers ----------
export const hasJob = (s) => s.flows.some((f) => f.kind === 'job');
export const hasFlag = (s, flag) => s.flags.includes(flag);
export const isUnderSlept = (s) => s.spareTime < SLEEP_THRESHOLD;
const clampChance = (p) => Math.max(0.05, Math.min(0.95, p));

// Job odds after the low-health penalty. Used for both the card display and the roll.
export function jobChance(apply, s) {
  const penalty = s.health < LOW_HEALTH ? LOW_HEALTH_JOB_PENALTY : 0;
  return clampChance(apply.chance(s) - penalty);
}

let flowId = 0;
function makeFlow(def, startDay) {
  // A one-off payment due in N days, e.g. a late bill: { label, amount, inDays: 14 }
  if (def.inDays != null) {
    const due = startDay + def.inDays;
    return { id: ++flowId, label: def.label, kind: null, amount: def.amount, every: 'daily',
      startDay: due, endDay: due + 1, scheduled: true };
  }
  return {
    id: ++flowId,
    label: def.label,
    kind: def.kind ?? null,             // 'job' marks employment
    amount: def.amount,                 // + income, - expense
    every: def.every,                   // 'daily' | 'weekly' | 'monthly'
    startDay,
    endDay: def.durationDays ? startDay + def.durationDays : null, // exclusive
  };
}

// ---------- Starting state ----------
export function createInitialStats() {
  const allowance = randomInt(0, 15);
  const flows = [makeFlow(COST_OF_LIVING, 1)];
  if (allowance > 0) {
    flows.unshift(makeFlow({ label: 'Allowance from parents', amount: allowance, every: 'weekly' }, 1));
  }
  return {
    day: 1,
    wealth: randomInt(5, 500),
    social: 0,
    spareTime: 24,
    health: 100,
    skills: 0,
    flows,
    flags: [],          // things the player has learned/unlocked, e.g. 'chainsaw'
    usedCards: [],      // one-off cards already seen
    goalsDone: [],
  };
}

// ---------- Goals ----------
// Shown one at a time, in order. Add more here.
export const GOALS = [
  {
    id: 'job',
    title: 'Get a job',
    hint: 'Study to raise your skills, then apply. More skills = better odds.',
    isDone: (s) => hasJob(s),
  },
  {
    id: 'savings',
    title: 'Save $1,000',
    hint: 'Keep your costs down and grow your income.',
    isDone: (s) => s.wealth >= 1000,
  },
];

export const currentGoal = (s) => GOALS.find((g) => !s.goalsDone.includes(g.id)) ?? null;

// ---------- Cards ----------
// Card fields:
//   repeatable: can show up more than once (default: one-off)
//   when(stats): only drawn when this returns true
//   days: how many days the turn takes (default 7); a choice can override with its own `days`
// Choice fields:
//   effects:   one-time changes, e.g. { wealth: -100 } (lump sum), { skills: 1 }
//   recurring: repeating cash flows, e.g. { label: 'Gym', amount: -20, every: 'monthly' }
//   setFlags:  flags to unlock other cards, e.g. ['chainsaw']
//   apply:     a job application; `chance(stats)` is the success probability
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
    prompt: 'Enrol in a 2-week coding bootcamp?',
    when: (s) => !hasJob(s),
    left: {
      label: 'Enrol',
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
    right: { label: 'Skip', outcome: 'You let this one pass.' },
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
    right: { label: 'Skip', outcome: 'You let this one pass.' },
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
        job: { label: 'Landscaping job', amount: 220, every: 'weekly' },
        effects: { spareTime: -12 },
        success: 'The chainsaw course paid off. You start Monday!',
        fail: 'The crew filled the spot before you heard back.',
      },
    },
    right: { label: 'Skip', outcome: 'You let this one pass.' },
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
        job: { label: 'Junior developer', amount: 400, every: 'weekly' },
        effects: { spareTime: -12 },
        success: 'You passed the technical interview. Welcome aboard!',
        fail: 'Three rounds of interviews, then a no. More skills would help.',
      },
    },
    right: { label: 'Skip', outcome: 'You let this one pass.' },
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
      effects: { social: 1, spareTime: -3 },
      recurring: [{ label: 'Gym membership', amount: -20, every: 'monthly' }],
      outcome: 'You joined the gym and recognise a few regulars already.',
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
];

// ---------- Surprise events ----------
// Same shape as cards, but they interrupt the deck at random (EVENT_CHANCE per turn).
// Events are repeatable unless `once: true`.
export const EVENTS = [
  {
    id: 'medical-bill',
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
    once: true,
    image: '🏠',
    prompt: 'Your landlord is raising the rent by $10 a week.',
    when: (s) => hasJob(s),
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
].map((e) => ({ ...e, event: true, repeatable: !e.once }));

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

// Picks the next card: sometimes a surprise event, otherwise a random eligible
// deck card. Avoids showing the same card twice in a row.
export function drawCard(stats, lastId = null, rng = Math.random) {
  const eligible = (list) =>
    list.filter((c) => c.id !== lastId && !stats.usedCards.includes(c.id) && (!c.when || c.when(stats)));

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
  health: { label: 'Health', format: (v) => `${v}` },
  spareTime: { label: 'Spare time', format: (v) => `${v}h` },
};

export function money(v) {
  return `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v))}`;
}

const PERIOD_PLURAL = { daily: 'days', weekly: 'wks', monthly: 'mos' };

export function formatFlow(flow) {
  const sign = flow.amount > 0 ? '+' : '-';
  const amount = `${sign}$${Math.abs(flow.amount)}`;
  if (flow.inDays != null) return `${amount} due in ${flow.inDays} days`;
  if (flow.scheduled) return amount;
  const base = `${amount}/${PERIOD_SHORT[flow.every]}`;
  if (!flow.durationDays) return base;
  return `${base} for ${flow.durationDays / PERIOD_DAYS[flow.every]} ${PERIOD_PLURAL[flow.every]}`;
}

export function formatDelta(key, delta) {
  const sign = delta > 0 ? '+' : '-';
  const abs = Math.abs(delta);
  if (key === 'wealth') return `${sign}$${abs}`;
  if (key === 'spareTime') return `${sign}${abs}h`;
  return `${sign}${abs}`;
}

// Net recurring cash flow, normalised to a weekly figure for the HUD.
export function weeklyNet(flows) {
  return flows
    .filter((f) => !f.scheduled)
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

// Applies the chosen side of a card, then advances time day by day.
// Returns { stats, ledger, outcome, newGoals, gameOver }.
export function applyChoice(stats, card, side, rng = Math.random) {
  const choice = card[side];
  const next = {
    ...stats,
    flows: [...stats.flows],
    flags: [...stats.flags],
    usedCards: card.repeatable ? stats.usedCards : [...stats.usedCards, card.id],
    goalsDone: [...stats.goalsDone],
  };
  const ledger = {};
  let outcome = choice.outcome ?? '';

  addEffects(next, choice.effects);
  if (choice.effects?.wealth) ledger['One-time'] = choice.effects.wealth;
  for (const def of choice.recurring ?? []) next.flows.push(makeFlow(def, next.day));
  for (const flag of choice.setFlags ?? []) if (!next.flags.includes(flag)) next.flags.push(flag);

  if (choice.apply) {
    const hired = rng() < jobChance(choice.apply, stats);
    if (hired) {
      next.flows.push(makeFlow({ ...choice.apply.job, kind: 'job' }, next.day));
      addEffects(next, choice.apply.effects);
    }
    outcome = hired ? choice.apply.success : choice.apply.fail;
  }

  const days = choice.days ?? card.days ?? DEFAULT_DAYS_PER_TURN;
  for (let d = next.day; d < next.day + days; d++) {
    for (const flow of next.flows) {
      if (isDue(flow, d)) {
        next.wealth += flow.amount;
        ledger[flow.label] = (ledger[flow.label] ?? 0) + flow.amount;
      }
    }
  }
  next.day += days;
  next.flows = next.flows.filter((f) => f.endDay === null || f.endDay > next.day);
  next.spareTime = Math.max(0, next.spareTime);
  next.social = Math.max(0, next.social);

  // Sleep: health drains while under-slept and slowly recovers while rested.
  const weeks = days / 7;
  const healthBefore = next.health;
  const rate = isUnderSlept(next) ? -HEALTH_LOSS_PER_WEEK : HEALTH_GAIN_PER_WEEK;
  next.health = Math.max(0, Math.min(100, Math.round(next.health + rate * weeks)));
  const healthDelta = next.health - healthBefore;

  const newGoals = GOALS.filter((g) => !next.goalsDone.includes(g.id) && g.isDone(next));
  next.goalsDone.push(...newGoals.map((g) => g.id));

  const gameOver =
    next.wealth <= GAME_OVER_AT ? 'debt' : next.health <= 0 ? 'health' : null;

  return { stats: next, ledger, outcome, newGoals, healthDelta, gameOver };
}
