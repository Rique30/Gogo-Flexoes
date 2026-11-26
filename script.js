'use strict';

const activities = {
  pushups: 'Flexões',
  squats: 'Agachamentos',
  situps: 'Abdominais',
  running: 'Corrida'
};
const missions = [
  { kind: 'pushups', goal: 10 },
  { kind: 'squats', goal: 15 },
  { kind: 'running', goal: 1 }
];
const ranks = ['E', 'D', 'C', 'B', 'A', 'S'];
const storageKey = 'rank-ativo-v1';
const xpPerLevel = 100;
const missionBonus = 20;
const get = id => document.getElementById(id);
const form = get('activity');
const kindInput = get('kind');
const amountInput = get('amount');
const durationInput = get('duration');

function readStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

const saved = readStorage(storageKey);
const legacy = readStorage('gogo-flex-v1');
let history = Array.isArray(saved?.history) ? saved.history : (legacy?.history ?? []).map(entry => ({
  kind: 'pushups',
  amount: entry.reps,
  date: entry.date,
  xp: 0,
  legacyName: entry.name || `Gogo nº ${entry.number}`
}));

function today() {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map(value => String(value).padStart(2, '0')).join('-');
}

function quantity(kind, amount) {
  const number = amount.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  if (kind === 'running') return `${number} km`;
  return `${number} ${amount === 1 ? 'repetição' : 'repetições'}`;
}

function progressFor(kind, date) {
  return history.filter(entry => entry.kind === kind && entry.date === date && !entry.legacyName)
    .reduce((total, entry) => total + Math.round(entry.amount * 100), 0) / 100;
}

function render() {
  const xp = history.reduce((total, entry) => total + entry.xp, 0);
  const level = Math.floor(xp / xpPerLevel) + 1;
  const rank = ranks[Math.min(Math.floor((level - 1) / 3), ranks.length - 1)];
  get('rank').textContent = `Rank ${rank}`;
  get('level').textContent = `Nível ${level}`;
  get('xp-bar').value = xp % xpPerLevel;
  get('xp-label').textContent = `${xp % xpPerLevel} de ${xpPerLevel} XP para o próximo nível`;
  get('xp-total').textContent = `${xp} XP acumulados`;

  get('missions').replaceChildren(...missions.map(({ kind, goal }) => {
    const item = document.createElement('div');
    item.className = 'mission';
    const title = document.createElement('strong');
    title.textContent = activities[kind];
    const progress = document.createElement('p');
    const amount = progressFor(kind, today());
    progress.textContent = amount >= goal
      ? `Concluída · +${missionBonus} XP`
      : `${quantity(kind, amount)} de ${quantity(kind, goal)}`;
    item.append(title, progress);
    if (amount < goal) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = 'Registrar';
      button.setAttribute('aria-label', `Registrar ${activities[kind].toLowerCase()}`);
      button.onclick = () => {
        kindInput.value = kind;
        updateForm();
        amountInput.focus();
      };
      item.append(button);
    }
    return item;
  }));

  const list = get('history');
  list.replaceChildren();
  if (!history.length) {
    const item = document.createElement('li');
    item.textContent = 'Nenhuma atividade registrada.';
    list.append(item);
  }
  for (const entry of history) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = `${activities[entry.kind]} · ${quantity(entry.kind, entry.amount)}`;
    const details = document.createElement('small');
    const date = entry.date.split('-').reverse().join('/');
    const duration = entry.duration ? ` · ${entry.duration} min` : '';
    details.textContent = `${date}${duration} · ${entry.legacyName || `+${entry.xp} XP`}`;
    item.append(title, details);
    list.append(item);
  }
}

function updateForm() {
  const running = kindInput.value === 'running';
  get('amount-label').textContent = running ? 'Distância em km' : 'Repetições';
  amountInput.min = running ? '0.01' : '1';
  amountInput.step = amountInput.min;
  amountInput.max = running ? '1000' : '10000';
  amountInput.inputMode = running ? 'decimal' : 'numeric';
  amountInput.value = '';
  get('duration-field').hidden = !running;
  durationInput.disabled = !running;
  durationInput.value = '';
}

for (const [kind, label] of Object.entries(activities)) {
  kindInput.add(new Option(label, kind));
}
kindInput.addEventListener('change', updateForm);

form.addEventListener('submit', event => {
  event.preventDefault();
  const kind = kindInput.value;
  const amount = amountInput.valueAsNumber;
  const date = today();
  const mission = missions.find(item => item.kind === kind);
  const progress = progressFor(kind, date);
  const completed = mission && progress < mission.goal
    && Math.round((progress + amount) * 100) >= mission.goal * 100;
  const xp = Math.max(1, Math.round(kind === 'running' ? amount * 10 : amount))
    + (completed ? missionBonus : 0);
  const entry = { kind, amount, date, xp };
  if (!durationInput.disabled && durationInput.value) entry.duration = durationInput.valueAsNumber;
  const nextHistory = [entry, ...history];
  try {
    localStorage.setItem(storageKey, JSON.stringify({ history: nextHistory }));
  } catch {
    get('feedback').textContent = 'O navegador não conseguiu salvar a atividade. Confira o armazenamento e tente novamente.';
    return;
  }
  history = nextHistory;
  get('feedback').textContent = `Atividade salva. +${xp} XP.${completed ? ' Missão concluída!' : ''}`;
  updateForm();
  render();
});

get('export').onclick = () => {
  const blob = new Blob([JSON.stringify({ history, ...(legacy ? { legacy } : {}) }, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rank-ativo-backup.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

updateForm();
render();
