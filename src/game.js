// Retro Bowl — Mini (compact)
// Drop into src/game.js. Depends on index.html already present.

(() => {
  const canvas = document.getElementById("field");
  const ctx = canvas.getContext("2d");

  // UI elements
  const runBtn = document.getElementById("runBtn");
  const passBtn = document.getElementById("passBtn");
  const kickBtn = document.getElementById("kickBtn");
  const restartBtn = document.getElementById("restartBtn");
  const homeNameEl = document.getElementById("homeName");
  const awayNameEl = document.getElementById("awayName");
  const homeScoreEl = document.getElementById("homeScore");
  const awayScoreEl = document.getElementById("awayScore");
  const quarterEl = document.getElementById("quarter");
  const timeEl = document.getElementById("time");
  const downDistanceEl = document.getElementById("downDistance");

  // Game state
  let state = {};
  function resetState() {
    state = {
      home: { name: "HOME", score: 0 },
      away: { name: "AWAY", score: 0 },
      possession: "home",   // 'home' or 'away'
      ballOn: 25,           // yards from offense endzone (0..100)
      down: 1,
      distance: 10,
      quarter: 1,
      timeSeconds: 10 * 60,
      playing: false,
      gameOver: false,
    };
  }
  resetState();

  // Helpers
  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function disableControls(val) {
    [runBtn, passBtn, kickBtn].forEach(b => b.disabled = val);
  }

  function changePossession() {
    state.possession = state.possession === "home" ? "away" : "home";
    // flip field position when possession changes
    state.ballOn = 100 - state.ballOn;
    state.down = 1;
    state.distance = 10;
  }

  function touchdown() {
    const team = state.possession;
    state[team].score += 6;
    // simple extra point: automatic 1
    state[team].score += 1;
    // kickoff: other team gets ball at 25, possession flips
    changePossession();
    state.ballOn = 25;
  }

  function safetyOrOppScore() {
    // not implemented separately — keep simple
  }

  function endQuarterOrGame() {
    if (state.quarter >= 4) {
      state.gameOver = true;
      disableControls(true);
      downDistanceEl.textContent = `Game Over — Final ${state.home.name} ${state.home.score} - ${state.away.score} ${state.away.name}`;
      return;
    }
    state.quarter += 1;
    state.timeSeconds = 10 * 60;
  }

  // Play resolution
  function resolvePlay(action) {
    if (state.gameOver) return;
    disableControls(true);
    state.playing = true;

    // time used by the play
    const timeUsed = 15 + Math.floor(Math.random() * 20);
    state.timeSeconds -= timeUsed;
    if (state.timeSeconds <= 0) {
      endQuarterOrGame();
      state.playing = false;
      disableControls(false);
      return;
    }

    let yards = 0;
    let turnover = false;

    if (action === "run") {
      // modest gains, chance for loss
      yards = -2 + Math.floor(Math.random() * 15); // -2..12
    } else if (action === "pass") {
      // higher variance, chance of interception
      const pick = Math.random();
      if (pick < 0.06) {
        // interception — turnover with return
        turnover = true;
        yards = - (5 + Math.floor(Math.random() * 25)); // turnover location shift
      } else {
        yards = -10 + Math.floor(Math.random() * 46); // -10..35
      }
    } else if (action === "kick") {
      // attempt field goal if close enough, otherwise punt (flip field some)
      const yardsFromGoal = 100 - state.ballOn;
      if (yardsFromGoal <= 50) {
        // field goal attempt
        const distanceFG = yardsFromGoal;
        const successChance = Math.max(0.25, 1 - (distanceFG / 70));
        if (Math.random() < successChance) {
          // good
          state[state.possession].score += 3;
          // kickoff: flip possession & ball to 25
          changePossession();
          state.ballOn = 25;
          state.down = 1;
          state.distance = 10;
          state.playing = false;
          disableControls(false);
          return;
        } else {
          // miss: other team takes over at spot
          changePossession();
          state.down = 1;
          state.distance = 10;
          state.playing = false;
          disableControls(false);
          return;
        }
      } else {
        // punt: flip possession and place ball with random return
        const returnYards = 20 + Math.floor(Math.random() * 31); // 20..50
        changePossession();
        state.ballOn = Math.max(10, 100 - (state.ballOn + returnYards));
        state.playing = false;
        disableControls(false);
        return;
      }
    }

    // apply yards (if turnover, interpret differently)
    if (turnover) {
      // interception: change possession and advance the intercepting team
      changePossession();
      state.ballOn = Math.max(1, Math.min(99, state.ballOn + Math.abs(yards)));
      state.down = 1;
      state.distance = 10;
      state.playing = false;
      disableControls(false);
      return;
    } else {
      // normal play: offense moves forward by yards
      state.ballOn += yards;
    }

    // clamp
    if (state.ballOn >= 100) {
      // touchdown
      touchdown();
      state.playing = false;
      disableControls(false);
      return;
    }
    if (state.ballOn <= 0) {
      // safety or defensive score — credit defense with a TD
      changePossession();
      state[state.possession].score += 2; // give 2 for simplicity
      // reset
      state.ballOn = 25;
      state.playing = false;
      disableControls(false);
      return;
    }

    // update down/distance
    if (yards >= state.distance) {
      state.down = 1;
      state.distance = 10;
    } else {
      state.down += 1;
      state.distance = Math.max(1, state.distance - Math.max(0, yards));
      if (state.down > 4) {
        // turnover on downs
        changePossession();
        state.down = 1;
        state.distance = 10;
      }
    }

    state.playing = false;
    disableControls(false);
  }

  // UI hook-ups
  runBtn.addEventListener("click", () => resolvePlay("run"));
  passBtn.addEventListener("click", () => resolvePlay("pass"));
  kickBtn.addEventListener("click", () => resolvePlay("kick"));
  restartBtn.addEventListener("click", () => {
    resetState();
    disableControls(false);
  });

  // Drawing
  const W = canvas.width;
  const H = canvas.height;

  function drawField() {
    // background
    ctx.fillStyle = "#1f7d3b";
    ctx.fillRect(0, 0, W, H);

    // yard lines every 10 yards
    for (let y = 0; y <= 100; y += 10) {
      const x = (y / 100) * W;
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, H - 10);
      ctx.stroke();

      // number
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "bold 14px Arial";
      ctx.save();
      ctx.translate(x + 4, 30);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(String(y), 0, 0);
      ctx.restore();
    }

    // midfield marker
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "20px Arial";
    ctx.fillText("50", W / 2 - 8, 24);
  }

  function drawBallAndPlayers() {
    // ball position
    const x = (state.ballOn / 100) * W;
    const y = H / 2;
    // offense player
    ctx.fillStyle = state.possession === "home" ? "#ffcc00" : "#00ccff";
    ctx.beginPath();
    ctx.arc(x - 18, y, 10, 0, Math.PI * 2);
    ctx.fill();
    // defense player
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x + 18, y, 10, 0, Math.PI * 2);
    ctx.fill();
    // ball
    ctx.fillStyle = "#6b3f11";
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHUD() {
    homeNameEl.textContent = state.home.name;
    awayNameEl.textContent = state.away.name;
    homeScoreEl.textContent = state.home.score;
    awayScoreEl.textContent = state.away.score;
    quarterEl.textContent = state.quarter;
    timeEl.textContent = formatTime(state.timeSeconds);
    downDistanceEl.textContent = `${state.down} & ${state.distance} • Ball on ${Math.round(state.ballOn)}`;
  }

  function loop() {
    drawField();
    drawBallAndPlayers();
    drawHUD();
    if (!state.gameOver) requestAnimationFrame(loop);
  }

  // initial draw
  disableControls(false);
  requestAnimationFrame(loop);

  // small AI: if away has possession, play automatically every 1.3s
  setInterval(() => {
    if (state.gameOver || state.playing) return;
    if (state.possession === "away") {
      // simple decision: run when short, pass otherwise
      if (state.distance <= 3) resolvePlay("run");
      else if (Math.random() < 0.6) resolvePlay("pass");
      else resolvePlay("run");
    }
  }, 1300);
})();
