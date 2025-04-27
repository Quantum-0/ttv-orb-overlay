// ===== Настройки =====

// Количество циклов появления орба в период его активности
const maxIterations = 5;
// Время респауна/неактивности орба в милисекундах
const spawnMinInterval = 7 * 60 * 1000;
const spawnMaxInterval = 15 * 60 * 1000;
// Время видимости орба во время одного цикла
const movementMinDuration = 1 * 1000;
const movementMaxDuration = 5 * 1000;
// Время плавного исчезновения (должно быть равно transition в CSS)
const fadeDuration = 3 * 1000;
// Время, в течении которого орб не видно в пробежутках между циклами видимости в активном состоянии в милисекундах
const pauseDuration = 4000;
// Максимальная и минимальная начальная скорость орба
const minStartSpeed = 25;
const maxStartSpeed = 35;
// Максимальная и минимальная скорость орба
const minSpeed = 10;
const maxSpeed = 50;
// Сила притяжения к центру
const pullStrength = 0.005;

// ===== Вебхук =====

// Вытягиваем параметры из урла (для подключения напрямую - не работает, т.к. не хендлятся сообщения из чата)
// const urlParams = new URLSearchParams(window.location.search);
// const whSecret = urlParams.get('secret');
// const whId = urlParams.get('id');

// Вытягиваем Properties из оверлея MixItUp
const whSecret = "{whSecret}"; // Секрет вебхука
const whId = "{whId}"; // ID вебхука


function random(min, max) {
  return Math.random() * (max - min) + min;
}

function createOrb() {
  console.log("[D]: createOrb");
  const orb = document.createElement('div');
  orb.className = 'orb';
  orb.style.opacity = '0';
  document.body.appendChild(orb);

  // Плавное появление после следующего кадра
  requestAnimationFrame(() => {
    orb.style.opacity = '1';
  });

  return orb;
}

function animateOrb(orb, onComplete) {
  console.log("[D]: animateOrb");
  const { innerWidth: width, innerHeight: height } = window;
  const centerX = width / 2;
  const centerY = height / 2;

  let x = random(0, width);
  let y = random(0, height);

  orb.style.left = `${x}px`;
  orb.style.top = `${y}px`;

  let startTime = null;
  let direction = random(0, 2 * Math.PI);
  let speed = random(minStartSpeed, maxStartSpeed);
  let fadingOut = false;

  function update(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const movementDuration = random(movementMinDuration, movementMaxDuration) | 0;

    // Исчезновение в рамках одного цикла
    if (window.orbIsCatched || (elapsed > movementDuration && !fadingOut)) {
      fadingOut = true;
      orb.style.opacity = 0;
      setTimeout(() => {
        orb.remove();
        onComplete();
      }, fadeDuration);
      return;
    }

    // Притяжение к центру
    const toCenterX = centerX - x;
    const toCenterY = centerY - y;
    const angleToCenter = Math.atan2(toCenterY, toCenterX);
    direction += pullStrength * Math.sin(angleToCenter - direction);

    // Случайные отклонения
    direction += random(-0.05, 0.05);
    speed += random(-2, 2);
    speed = Math.max(minSpeed, Math.min(speed, maxSpeed));

    x += Math.cos(direction) * speed * 0.016;
    y += Math.sin(direction) * speed * 0.016;

    orb.style.left = `${x}px`;
    orb.style.top = `${y}px`;

    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

function startOrbCycle() {
  console.log("[D]: startOrbCycle");
  if (window.isOrbCycleRunning) return; // Предотвращаем множественные запуски
  window.isOrbCycleRunning = true;
  window.isOrbActive = true;
  let iteration = 0;

  function spawnNext() {
    console.log("[D]: spawnNext");
    if (iteration >= maxIterations || window.orbIsCatched) {
      window.isOrbActive = false;
      window.isOrbCycleRunning = false;
      if (window.orbIsCatched) {
        console.log("Орб пойман, цикл завершён.");
        window.orbIsCatched = false;
      }
      else {
        console.log("Орб не был пойман, цикл появления орба закончен.");
      }

      if (!window.orbSpawnTimeout) {
        let interval = random(spawnMinInterval, spawnMaxInterval) | 0;
        window.orbSpawnTimeout = setTimeout(() => {
          window.orbSpawnTimeout = null;
          startOrbCycle();
        }, interval);
      }
      return;
    }

    const orb = createOrb();
    animateOrb(orb, () => {
      setTimeout(() => {
        iteration++;
        spawnNext();
      }, pauseDuration);
    });
  }

  spawnNext();
}

// Стартуем первый цикл
window.orbSpawnTimeout = setTimeout(() => {
  window.orbSpawnTimeout = null;
  startOrbCycle();
}, 1000);

function callWebhookCatched(user) {
  if (whSecret == "" || whId == "") return;
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://api.mixitupapp.com/api/webhook/" + whId + "?secret=" + whSecret, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify({
      user: user
  }));
}

// Обработчики команд

function cmdOrbHandler(nick) {
  if (!window.isOrbActive) {
    console.log("Орб не активен, игнорируем команду.");
    return;
  }
  console.log("Пользователь @" + nick + " обнаружил орб! Молодец!");
  callWebhookCatched(nick);
  window.orbIsCatched = true;
  // Clear any existing spawn timeout to ensure 60-second delay
  if (window.orbSpawnTimeout) {
    clearTimeout(window.orbSpawnTimeout);
    window.orbSpawnTimeout = null;
  }
}

function cmdSpawnHandler() {
  console.log("[D]: cmdSpawnHandler");
  if (window.isOrbCycleRunning) {
    console.log("Цикл уже активен, игнорируем команду.");
    return;
  }
  if (window.orbSpawnTimeout) {
    clearTimeout(window.orbSpawnTimeout);
    console.log("Предыдущий таймер на респаун цикла отменён.");
  }
  startOrbCycle();
  console.log("Цикл орба принудительно запущен.");
}


// Handling twitch messages via adding as overlay in MixItUp
function ChatMessageReceived(data)
{
  if (data.Message[0].Content == "!orb" || data.Message[0].Content == "!орб")
    cmdOrbHandler(data.User.DisplayName);
  if (data.Message[0].Content == "!чопоорбам")
    cmdSpawnHandler();
}

// Handling twitch messages via adding as overlay on StreamElements
// window.addEventListener('onEventReceived', function (obj) {
//   console.log("[D]: onEventReceived");
//   if (!obj.detail.event) {
//     return;
//   }
//   const listener = obj.detail.listener;
//   const data = obj.detail.event.data;

//   document.getElementsByName('debug')[0].innerText = data;

//   if (listener === 'message') {
//     if (data.text === "!orb" || data.text === "!орб") {
//       cmdOrbHandler(data.nick);
//     }

//     if (data.text === "!чопоорбам") {
//       cmdSpawnHandler();
//     }
//   }
// });

window.orbIsCatched = false;
window.isOrbActive = false;
window.isOrbCycleRunning = false;
window.orbSpawnTimeout = null;

// ===== Copyright =====
// Made by Quantum0 / Anton Kurenkov:
//   https://github.com/Quantum-0
//   https://www.twitch.tv/quantum075
//   https://t.me/quantum0
// as twitch overlay
// specially for my friend Silly Snaily:
//   https://www.twitch.tv/sillysnaily
// in April, 2025
