const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// How many days each recurring period lasts.
export const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 30 };
const PERIOD_SHORT = { daily: 'day', weekly: 'wk', monthly: 'mo' };

// Days that pass with each swipe unless a decision sets its own `days`.
export const DEFAULT_DAYS_PER_TURN = 7;

let flowId = 0;
function makeFlow(def, startDay) {
  return {
    id: ++flowId,
    label: def.label,
    amount: def.amount,                 // + income, - expense
    every: def.every,                   // 'daily' | 'weekly' | 'monthly'
    startDay,
    endDay: def.durationDays ? startDay + def.durationDays : null, // exclusive
  };
}

// Starting stats for a new game. Wealth and income are randomized each game.
export function createInitialStats() {
  const startingIncome = randomInt(0, 15);
  return {
    day: 1,                       // time tracker (top left)
    wealth: randomInt(5, 500),    // $ in the bank (top right)
    social: 0,                    // social network points (bottom left)
    spareTime: 24,                // spare time hours (bottom right)
    flows: startingIncome > 0
      ? [makeFlow({ label: 'Starting job', amount: startingIncome, every: 'weekly' }, 1)]
      : [],
  };
}

// Each decision is one swipe card.
// `image` can be an emoji or an image URL (e.g. '/images/chainsaw.png' in /public).
// A choice has:
//   effects:   one-time changes, e.g. { wealth: -100 } (a lump sum), { social: 2 }
//   recurring: cash flows that repeat, e.g.
//              { label: 'Gym', amount: -20, every: 'monthly' }
//              { label: 'Bootcamp', amount: -25, every: 'daily', durationDays: 14 }
// A recurring flow pays/charges on the day it starts and then every period after that.
export const DECISIONS = [
  {
    id: 'chainsaw',
    image: '🪚',
    prompt: 'Should I learn how to use a chainsaw?',
    left: {
      label: 'Learn',
      effects: { wealth: -100 },
      outcome: 'You paid for a safety course and can now handle a chainsaw.',
    },
    right: {
      label: 'Skip',
      effects: { wealth: -10 },
      outcome: 'You skipped it, but the cost of living still ticked on.',
    },
  },
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
    id: 'bootcamp',
    image: '💻',
    prompt: 'Enrol in a 2-week coding bootcamp, or pick up café shifts instead?',
    left: {
      label: 'Bootcamp',
      effects: { spareTime: -8 },
      recurring: [{ label: 'Coding bootcamp', amount: -25, every: 'daily', durationDays: 14 }],
      outcome: 'Bootcamp started. Your days are full of code and coffee.',
    },
    right: {
      label: 'Café job',
      effects: { wealth: 50, spareTime: -6 },
      recurring: [{ label: 'Café shifts', amount: 40, every: 'weekly' }],
      outcome: 'You got the café job, plus a $50 signing bonus.',
    },
  },
];

export const STAT_META = {
  wealth: { label: 'Wealth', format: (v) => money(v) },
  social: { label: 'Social', format: (v) => `${v}` },
  spareTime: { label: 'Spare time', format: (v) => `${v}h` },
};

export function money(v) {
  return `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v))}`;
}

function isDue(flow, day) {
  if (day < flow.startDay) return false;
  if (flow.endDay !== null && day >= flow.endDay) return false;
  return (day - flow.startDay) % PERIOD_DAYS[flow.every] === 0;
}

// Applies a choice, then advances time day by day, paying out recurring flows.
// Returns the new stats and a ledger of what was paid this turn.
export function applyChoice(stats, choice, days = DEFAULT_DAYS_PER_TURN) {
  const next = { ...stats, flows: [...stats.flows] };
  const ledger = {}; // label -> total amount this turn

  for (const [key, delta] of Object.entries(choice.effects ?? {})) {
    next[key] = (next[key] ?? 0) + delta;
  }
  if (choice.effects?.wealth) ledger['One-time'] = choice.effects.wealth;

  for (const def of choice.recurring ?? []) {
    next.flows.push(makeFlow(def, next.day));
  }

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

  return { stats: next, ledger };
}

// Net recurring cash flow, normalised to a weekly figure for the HUD.
export function weeklyNet(flows) {
  return flows.reduce((sum, f) => sum + (f.amount * 7) / PERIOD_DAYS[f.every], 0);
}

export function formatFlow(flow) {
  const sign = flow.amount > 0 ? '+' : '-';
  const base = `${sign}$${Math.abs(flow.amount)}/${PERIOD_SHORT[flow.every]}`;
  return flow.durationDays ? `${base} × ${flow.durationDays}d` : base;
}

export function formatDelta(key, delta) {
  const sign = delta > 0 ? '+' : '-';
  const abs = Math.abs(delta);
  if (key === 'wealth') return `${sign}$${abs}`;
  if (key === 'spareTime') return `${sign}${abs}h`;
  return `${sign}${abs}`;
}
