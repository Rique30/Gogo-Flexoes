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
const rings = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const storageKey = 'rank-ativo-v1';
const journeyLength = 66;
const weeklyGoal = 4;
const xpPerLevel = 100;
const missionBonus = 20;
const habitXp = 10;
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

function localDate(now = new Date()) {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map(value => String(value).padStart(2, '0')).join('-');
}

function parseDate(text) {
  const [year, month, day] = text.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(text, days) {
  const date = parseDate(text);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function daysBetween(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / 86400000);
}

const saved = readStorage(storageKey);
const legacy = readStorage('gogo-flex-v1');
const state = {
  customExercises: Array.isArray(saved?.customExercises) ? saved.customExercises : [],
  habits: Array.isArray(saved?.habits) ? saved.habits : [],
  journeyStart: typeof saved?.journeyStart === 'string' ? saved.journeyStart : localDate(),
  history: Array.isArray(saved?.history) ? saved.history : (legacy?.history ?? []).map(entry => ({
    kind: 'pushups',
    amount: entry.reps,
    date: entry.date,
    xp: 0,
    legacyName: entry.name || `Gogo nº ${entry.number}`
  }))
};

function save(changes) {
  const next = { ...state, ...changes };
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    return false;
  }
  Object.assign(state, next);
  return true;
}

function quantity(kind, amount) {
  if (kind === 'habit') return 'hábito concluído';
  const number = amount.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  if (kind === 'running') return `${number} km`;
  return `${number} ${amount === 1 ? 'repetição' : 'repetições'}`;
}

function progressFor(kind, date) {
  return state.history.filter(entry => entry.kind === kind && entry.date === date && !entry.legacyName)
    .reduce((total, entry) => total + Math.round(entry.amount * 100), 0) / 100;
}

function habitDone(name, date) {
  return state.history.some(entry => entry.kind === 'habit' && entry.habitName === name && entry.date === date);
}

function dayComplete(date) {
  return missions.every(({ kind, goal }) => progressFor(kind, date) >= goal)
    && state.habits.every(name => habitDone(name, date));
}

function renderJourney() {
  const today = localDate();
  const elapsed = daysBetween(state.journeyStart, today);
  const finished = elapsed >= journeyLength;
  const completeDays = Array.from({ length: journeyLength }, (_, index) => addDays(state.journeyStart, index))
    .filter(date => date <= today && dayComplete(date)).length;

  get('journey-day').textContent = finished
    ? 'Jornada concluída'
    : `Dia ${elapsed + 1} de ${journeyLength}`;
  get('journey-summary').textContent = `${completeDays} de ${journeyLength} dias completos. Começou em ${state.journeyStart.split('-').reverse().join('/')}.`;

  let streak = 0;
  let day = dayComplete(today) ? today : addDays(today, -1);
  while (day >= state.journeyStart && dayComplete(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  get('streak').textContent = `🔥 ${streak} ${streak === 1 ? 'dia seguido' : 'dias seguidos'}`;

  get('journey-grid').replaceChildren(...Array.from({ length: journeyLength }, (_, index) => {
    const date = addDays(state.journeyStart, index);
    const cell = document.createElement('li');
    let status = 'futuro';
    if (date < today) status = dayComplete(date) ? 'completo' : 'perdido';
    if (date === today) status = dayComplete(date) ? 'completo' : 'hoje';
    cell.className = { completo: 'done', perdido: 'missed', hoje: 'today', futuro: '' }[status];
    if (date === today) cell.classList.add('today');
    cell.textContent = index + 1;
    cell.title = `Dia ${index + 1} · ${date.split('-').reverse().join('/')} · ${status}`;
    return cell;
  }));
}

function renderWeeklyProgress() {
  const monday = new Date();
  const end = localDate(monday);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const start = localDate(monday);
  const trainingDays = new Set(state.history
    .filter(entry => entry.kind !== 'habit' && entry.date >= start && entry.date <= end)
    .map(entry => entry.date)).size;

  get('weekly-summary').textContent = `${trainingDays} de ${weeklyGoal} dias de treino nesta semana`;
  get('weekly-progress').value = Math.min(trainingDays, weeklyGoal);
}

function renderAttributes() {
  const totals = { Força: 0, Resistência: 0, Disciplina: 0 };
  for (const entry of state.history) {
    if (entry.kind === 'habit') totals.Disciplina += entry.xp;
    else if (entry.kind === 'running') totals.Resistência += entry.xp;
    else totals.Força += entry.xp;
  }
  get('attributes').replaceChildren(...Object.entries(totals).map(([name, value]) => {
    const wrapper = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = name;
    const detail = document.createElement('dd');
    detail.textContent = value;
    wrapper.append(term, detail);
    return wrapper;
  }));
}

function renderHabits() {
  const today = localDate();
  const list = get('habits-today');
  if (!state.habits.length) {
    const item = document.createElement('li');
    item.className = 'empty';
    item.textContent = 'Nenhum hábito ainda. Adicione em Exercícios e hábitos.';
    list.replaceChildren(item);
  } else {
    list.replaceChildren(...state.habits.map(name => {
      const item = document.createElement('li');
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = habitDone(name, today);
      box.onchange = () => toggleHabit(name, box);
      label.append(box, ` ${name}`);
      item.append(label);
      return item;
    }));
  }

  get('habit-list').replaceChildren(...state.habits.map(name => {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = name;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary small';
    remove.textContent = 'Remover';
    remove.setAttribute('aria-label', `Remover hábito ${name}`);
    remove.onclick = () => {
      if (save({ habits: state.habits.filter(habit => habit !== name) })) render();
    };
    item.append(text, remove);
    return item;
  }));
}

function toggleHabit(name, box) {
  const today = localDate();
  const wasComplete = dayComplete(today);
  const history = box.checked
    ? [{ kind: 'habit', habitName: name, amount: 1, date: today, xp: habitXp }, ...state.history]
    : state.history.filter(entry => !(entry.kind === 'habit' && entry.habitName === name && entry.date === today));
  if (!save({ history })) {
    box.checked = !box.checked;
    get('feedback').textContent = 'O navegador não conseguiu salvar o hábito.';
    return;
  }
  const closedDay = !wasComplete && dayComplete(today);
  get('feedback').textContent = box.checked
    ? `${name} concluído. +${habitXp} XP.${closedDay ? ' Dia da jornada completo!' : ''}`
    : `${name} desmarcado.`;
  render();
}

function render() {
  renderJourney();
  renderWeeklyProgress();
  renderAttributes();
  renderHabits();
  const xp = state.history.reduce((total, entry) => total + entry.xp, 0);
  const level = Math.floor(xp / xpPerLevel) + 1;
  const ring = rings[Math.min(Math.floor((level - 1) / 3), rings.length - 1)];
  get('ring').textContent = `Anel ${ring}`;
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
    const amount = progressFor(kind, localDate());
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
  if (!state.history.length) {
    const item = document.createElement('li');
    item.textContent = 'Nenhuma atividade registrada.';
    list.append(item);
  }
  for (const entry of state.history) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    const name = entry.habitName || entry.exerciseName || activities[entry.kind];
    title.textContent = `${name} · ${quantity(entry.kind, entry.amount)}`;
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

function nameTaken(name, names) {
  return names.some(existing => existing.localeCompare(name, 'pt-BR', { sensitivity: 'base' }) === 0);
}

for (const [kind, label] of Object.entries(activities)) {
  kindInput.add(new Option(label, kind));
}
for (const name of state.customExercises) {
  kindInput.add(new Option(name, `custom:${name}`));
}
kindInput.addEventListener('change', updateForm);

get('custom-exercise').addEventListener('submit', event => {
  event.preventDefault();
  const input = get('exercise-name');
  const name = input.value.trim();
  const feedback = get('exercise-feedback');
  feedback.hidden = false;
  if (!name) {
    feedback.textContent = 'Digite o nome do exercício.';
    return;
  }
  if (nameTaken(name, [...Object.values(activities), ...state.customExercises])) {
    feedback.textContent = 'Esse exercício já está na lista de atividades.';
    return;
  }
  if (!save({ customExercises: [...state.customExercises, name] })) {
    feedback.textContent = 'O navegador não conseguiu salvar o exercício.';
    return;
  }
  kindInput.add(new Option(name, `custom:${name}`));
  kindInput.value = `custom:${name}`;
  updateForm();
  input.value = '';
  feedback.textContent = `${name} foi adicionado. Registre as repetições em Registrar atividade.`;
});

get('custom-habit').addEventListener('submit', event => {
  event.preventDefault();
  const input = get('habit-name');
  const name = input.value.trim();
  const feedback = get('habit-feedback');
  feedback.hidden = false;
  if (!name) {
    feedback.textContent = 'Digite o nome do hábito.';
    return;
  }
  if (nameTaken(name, state.habits)) {
    feedback.textContent = 'Esse hábito já está na lista.';
    return;
  }
  if (!save({ habits: [...state.habits, name] })) {
    feedback.textContent = 'O navegador não conseguiu salvar o hábito.';
    return;
  }
  input.value = '';
  feedback.textContent = `${name} foi adicionado aos hábitos de hoje.`;
  render();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const kind = kindInput.value;
  const amount = amountInput.valueAsNumber;
  const date = localDate();
  const wasComplete = dayComplete(date);
  const mission = missions.find(item => item.kind === kind);
  const progress = progressFor(kind, date);
  const completed = mission && progress < mission.goal
    && Math.round((progress + amount) * 100) >= mission.goal * 100;
  const xp = Math.max(1, Math.round(kind === 'running' ? amount * 10 : amount))
    + (completed ? missionBonus : 0);
  const entry = { kind, amount, date, xp };
  if (kind.startsWith('custom:')) entry.exerciseName = kind.slice(7);
  if (!durationInput.disabled && durationInput.value) entry.duration = durationInput.valueAsNumber;
  if (!save({ history: [entry, ...state.history] })) {
    get('feedback').textContent = 'O navegador não conseguiu salvar a atividade. Confira o armazenamento e tente novamente.';
    return;
  }
  const closedDay = !wasComplete && dayComplete(date);
  get('feedback').textContent = `Atividade salva. +${xp} XP.${completed ? ' Missão concluída!' : ''}${closedDay ? ' Dia da jornada completo!' : ''}`;
  updateForm();
  render();
});

get('restart').onclick = () => {
  if (!confirm('Recomeçar a jornada de 66 dias a partir de hoje? Seu XP e histórico continuam.')) return;
  if (save({ journeyStart: localDate() })) render();
};

get('export').onclick = () => {
  const blob = new Blob([JSON.stringify({ ...state, ...(legacy ? { legacy } : {}) }, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sombras-do-destino-backup.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

if (!saved?.journeyStart) save({});
updateForm();
render();
