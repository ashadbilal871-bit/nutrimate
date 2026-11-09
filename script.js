// ---------- Data ----------
const KEY = 'nutrimate';
const WATER_GOAL = 8;
const WATER_TIMES = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
const RING = 465; // circle length (2 x pi x 74)

// Each meal takes a share of the daily calories
const MEALS = [
  { id: 'b',  name: 'Breakfast',     time: '08:00', share: 0.25 },
  { id: 's1', name: 'Morning snack', time: '11:00', share: 0.10 },
  { id: 'l',  name: 'Lunch',         time: '13:30', share: 0.30 },
  { id: 's2', name: 'Evening snack', time: '17:00', share: 0.10 },
  { id: 'd',  name: 'Dinner',        time: '20:00', share: 0.25 }
];

const FOODS = {
  lose: {
    b:  'Oats with banana and one boiled egg',
    s1: 'An apple and a few almonds',
    l:  'Grilled chicken, brown rice and salad',
    s2: 'Yogurt or cucumber and carrot sticks',
    d:  'Vegetable soup with daal or grilled fish'
  },
  gain: {
    b:  'Omelette, 2 toasts and a glass of milk',
    s1: 'Banana shake with peanut butter',
    l:  'Chicken, rice, daal and salad',
    s2: 'Handful of nuts and dates',
    d:  'Chicken or beef curry, 2 rotis and vegetables'
  }
};

// ---------- State ----------
let s = load() || { user: null };
const $ = id => document.getElementById(id);

function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
function todayStr() { return new Date().toLocaleDateString('en-CA'); }

// New day = fresh tracking
function checkDay() {
  if (s.day !== todayStr()) {
    s.day = todayStr(); s.eaten = []; s.extra = []; s.water = 0; s.fired = {}; s.cel = {};
    save();
  }
  s.eaten = s.eaten || []; s.extra = s.extra || []; s.water = s.water || 0;
  s.fired = s.fired || {}; s.cel = s.cel || {};
}

// ---------- Calculations ----------
// Simple BMR estimate (average of male/female Mifflin-St Jeor) x light activity,
// then -500 kcal to lose or +500 kcal to gain.
function calcTarget(u) {
  const bmr = 10 * u.weight + 6.25 * u.height - 5 * u.age - 78;
  const t = bmr * 1.4 + (u.goal === 'lose' ? -500 : 500);
  return Math.round(Math.max(1200, t) / 10) * 10;
}
function mealKcal(m) { return Math.round(s.user.target * m.share / 10) * 10; }
function bmiOf(u) { return u.weight / Math.pow(u.height / 100, 2); }
function bmiCat(b) { return b < 18.5 ? 'Underweight' : b < 25 ? 'Normal' : b < 30 ? 'Overweight' : 'Obese'; }
function eatenTotal() {
  const plan = MEALS.filter(m => s.eaten.includes(m.id)).reduce((a, m) => a + mealKcal(m), 0);
  return plan + s.extra.reduce((a, f) => a + f.kcal, 0);
}
function nextMeal() {
  const now = new Date().toTimeString().slice(0, 5);
  return MEALS.find(m => m.time > now && !s.eaten.includes(m.id)) || null;
}

// ---------- Effects ----------
// Smooth count-up for numbers
function countTo(el, to) {
  const from = +el.dataset.v || 0, start = performance.now(), dur = 700;
  el.dataset.v = to;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) { el.textContent = to; return; }
  (function step(t) {
    const p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  })(start);
}

function burst() {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const cols = ['#39ffa0', '#3cd7ff', '#b07cff', '#ff9a4d', '#ffffff'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    p.style.setProperty('--x', (Math.random() * 2 - 1) * 170 + 'px');
    p.style.setProperty('--y', -(110 + Math.random() * 190) + 'px');
    p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    p.style.background = cols[i % cols.length];
    p.style.boxShadow = '0 0 8px ' + cols[i % cols.length];
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1600);
  }
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove('show'), 7000);
}

// ---------- Screens ----------
function show(editing) {
  const ready = !!s.user && !editing;
  $('setup').hidden = ready;
  $('home').hidden = !ready;
  $('cancel').hidden = !s.user;
  const box = ready ? $('home') : $('setup');
  box.classList.remove('enter'); void box.offsetWidth; box.classList.add('enter');
  if (ready) { checkDay(); render(); }
}

$('form').addEventListener('submit', e => {
  e.preventDefault();
  const u = {
    name: $('name').value.trim(),
    age: +$('age').value,
    height: +$('height').value,
    weight: +$('weight').value,
    goal: document.querySelector('input[name=goal]:checked').value
  };
  u.target = calcTarget(u);
  s.user = u;
  checkDay(); save();
  show();
});

$('edit').addEventListener('click', () => {
  const u = s.user;
  $('name').value = u.name; $('age').value = u.age;
  $('height').value = u.height; $('weight').value = u.weight;
  document.querySelector('input[name=goal][value=' + u.goal + ']').checked = true;
  show(true);
});
$('cancel').addEventListener('click', () => show());

$('resetDay').addEventListener('click', () => {
  if (!confirm('Clear today\'s meals, extra food and water?')) return;
  s.day = ''; checkDay(); render();
});

// ---------- Dashboard ----------
function render() {
  const u = s.user, total = eatenTotal(), over = total > u.target;
  $('hello').textContent = 'Hi ' + u.name + '! Goal: ' + (u.goal === 'lose' ? 'lose weight' : 'gain weight');

  // next meal line
  const nm = nextMeal();
  $('next').innerHTML = '';
  if (nm) {
    const b = document.createElement('b'); b.textContent = nm.name + ' at ' + nm.time;
    $('next').append('Next up: ', b);
  } else {
    $('next').textContent = 'No more meals planned for today.';
  }

  // calorie ring + numbers
  $('home').classList.toggle('over', over);
  $('ringFg').style.strokeDashoffset = RING * (1 - Math.min(1, total / u.target));
  countTo($('left'), Math.abs(u.target - total));
  $('leftLabel').textContent = over ? 'kcal over' : 'kcal left';
  countTo($('eaten'), total);
  $('target').textContent = u.target;
  const bmi = bmiOf(u);
  $('bmi').textContent = bmi.toFixed(1);
  $('bmiCat').textContent = 'BMI ' + bmiCat(bmi);

  // diet plan
  const ml = $('meals'); ml.innerHTML = '';
  MEALS.forEach(m => {
    const li = document.createElement('li');
    const done = s.eaten.includes(m.id);
    li.className = done ? 'done' : (nm && nm.id === m.id ? 'upnext' : '');
    const info = document.createElement('div'); info.className = 'info';
    const b = document.createElement('b'); b.textContent = m.name + ' · ' + m.time;
    const sp = document.createElement('span'); sp.textContent = FOODS[u.goal][m.id] + ' (' + mealKcal(m) + ' kcal)';
    info.append(b, sp);
    const btn = document.createElement('button');
    btn.className = 'tick'; btn.textContent = done ? 'Eaten ✓' : 'Mark eaten';
    btn.onclick = () => {
      s.eaten = done ? s.eaten.filter(x => x !== m.id) : [...s.eaten, m.id];
      save(); render();
      if (!done && s.eaten.length === MEALS.length && !s.cel.meals) {
        s.cel.meals = 1; save(); burst(); toast('All meals done today. Great job! 🎉');
      }
    };
    li.append(info, btn); ml.appendChild(li);
  });

  // extra foods
  const el = $('extras'); el.innerHTML = '';
  s.extra.forEach((f, i) => {
    const li = document.createElement('li');
    const info = document.createElement('div'); info.className = 'info';
    const b = document.createElement('b'); b.textContent = f.name;
    const sp = document.createElement('span'); sp.textContent = f.kcal + ' kcal';
    info.append(b, sp);
    const x = document.createElement('button');
    x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', 'Remove ' + f.name);
    x.onclick = () => { s.extra.splice(i, 1); save(); render(); };
    li.append(info, x); el.appendChild(li);
  });

  // water glasses
  const g = $('glasses'); g.innerHTML = '';
  for (let i = 0; i < WATER_GOAL; i++) {
    const d = document.createElement('div');
    d.className = 'g' + (i < s.water ? ' full' : '');
    g.appendChild(d);
  }
  $('drink').textContent = s.water + '/' + WATER_GOAL + '  + Glass';

  $('notifBtn').hidden = !('Notification' in window) || Notification.permission === 'granted';
}

$('extraForm').addEventListener('submit', e => {
  e.preventDefault();
  s.extra.push({ name: $('fname').value.trim(), kcal: +$('fkcal').value });
  e.target.reset(); save(); render();
});

$('drink').addEventListener('click', () => {
  if (s.water < WATER_GOAL) s.water++;
  save(); render();
  if (s.water === WATER_GOAL && !s.cel.water) {
    s.cel.water = 1; save(); burst(); toast('Water goal reached! 💧');
  }
});

// ---------- Reminders ----------
function notify(title, body) {
  toast(title + ' – ' + body);
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

$('notifBtn').addEventListener('click', async () => {
  if (!('Notification' in window)) return toast('This browser does not support notifications.');
  const p = await Notification.requestPermission();
  if (p === 'granted') notify('Reminders on', 'You will be notified at meal and water times.');
  else toast('Notifications are blocked. Allow them in your browser settings.');
  render();
});

// Runs every 20 seconds and compares the clock with meal / water times
function tick() {
  if (!s.user) return;
  checkDay();
  const now = new Date().toTimeString().slice(0, 5);
  MEALS.forEach(m => {
    const k = 'm' + m.id;
    if (m.time === now && !s.fired[k]) {
      s.fired[k] = 1; save();
      notify(m.name + ' time 🍽', FOODS[s.user.goal][m.id]);
    }
  });
  WATER_TIMES.forEach(t => {
    const k = 'w' + t;
    if (t === now && !s.fired[k]) {
      s.fired[k] = 1; save();
      notify('Water time 💧', 'Drink a glass of water.');
    }
  });
  if (!$('home').hidden) render();
}

// ---------- Start ----------
checkDay();
show();
setInterval(tick, 20000);
