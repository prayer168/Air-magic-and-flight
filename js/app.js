/* 空氣魔法與飛行 — 互動教材主程式 */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  /* 進行中的動畫控制：切頁籤時全部停止 */
  var activeAnims = [];
  var stopResetters = [];
  function trackAnim(cancelFn) { activeAnims.push(cancelFn); }
  function onStop(fn) { stopResetters.push(fn); }
  function stopAllAnims() {
    activeAnims.forEach(function (fn) { try { fn(); } catch (e) {} });
    activeAnims = [];
    stopResetters.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  /* ============ 頁籤 ============ */
  var tabs = $$(".tab");
  var panels = $$(".panel");

  function activateTab(tab) {
    stopAllAnims();
    tabs.forEach(function (t) {
      var on = t === tab;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) {
      var on = p.id === tab.getAttribute("aria-controls");
      p.classList.toggle("is-active", on);
      p.hidden = !on;
    });
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { activateTab(tab); });
    tab.addEventListener("keydown", function (e) {
      var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      var next = tabs[(i + dir + tabs.length) % tabs.length];
      activateTab(next);
      next.focus();
    });
  });

  $$(".quest-link").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tab = document.getElementById(btn.getAttribute("data-goto"));
      if (tab) { activateTab(tab); tab.focus(); }
    });
  });

  /* 通用：requestAnimationFrame 動畫器 */
  function animate(durationMs, onFrame, onDone) {
    var start = null, rafId = null, cancelled = false;
    function frame(ts) {
      if (cancelled) return;
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / durationMs);
      onFrame(t);
      if (t < 1) { rafId = requestAnimationFrame(frame); }
      else if (onDone) { onDone(); }
    }
    rafId = requestAnimationFrame(frame);
    var cancel = function () { cancelled = true; if (rafId) cancelAnimationFrame(rafId); };
    trackAnim(cancel);
    return cancel;
  }

  /* ============ 1. 紙飛機 ============ */
  (function paperPlane() {
    var angleInput = $("#pp-angle"), angleOut = $("#pp-angle-out");
    var readout = $("#pp-readout"), pathEl = $("#pp-path");
    var planeG = $("#pp-plane-g"), shape = $("#pp-plane-shape");
    var launchBtn = $("#pp-launch"), resetBtn = $("#pp-reset");
    var busy = false;

    angleInput.addEventListener("input", function () { angleOut.textContent = angleInput.value; });

    /* 簡化滑翔物理（教學示意）：升力/阻力係數依機翼設計 */
    function simulate(wing, angleDeg) {
      var kL = wing === "glider" ? 0.70 : 0.04;   // 升力係數
      var kD = wing === "glider" ? 0.12 : 0.015;  // 阻力係數
      var v0 = wing === "glider" ? 6 : 12;        // 窄翼可丟比較快
      var a = (angleDeg * Math.PI) / 180;
      var vx = v0 * Math.cos(a), vy = v0 * Math.sin(a);
      var x = 0, y = 1.5, g = 9.8, dt = 0.02;
      var pts = [], t = 0;
      while (y > 0 && t < 12) {
        pts.push([x, y]);
        var v = Math.sqrt(vx * vx + vy * vy) || 0.0001;
        // 阻力沿速度反方向；升力垂直於速度方向（朝上偏）
        var ax = -kD * v * vx - kL * v * vy * 0.6;
        var ay = -g - kD * v * vy + kL * v * vx;
        vx += ax * dt; vy += ay * dt;
        if (vx < 0.3) vx = 0.3; // 教學示意：不倒飛
        x += vx * dt; y += vy * dt;
        t += dt;
      }
      pts.push([x, 0]);
      return { pts: pts, dist: x, time: t };
    }

    /* 世界座標 → SVG：x 0..20m → 60..620, y 0..7m → 270..20（垂直為示意比例） */
    function toSvg(p) {
      return [60 + (p[0] / 20) * 560, 270 - (p[1] / 7) * 250];
    }

    function render(res, animateIt) {
      var d = res.pts.map(function (p, i) {
        var s = toSvg(p);
        return (i === 0 ? "M" : "L") + s[0].toFixed(1) + " " + s[1].toFixed(1);
      }).join(" ");
      pathEl.setAttribute("d", d);
      var msg = "飛行距離約 " + res.dist.toFixed(1) + " 公尺，滯空時間約 " + res.time.toFixed(1) + " 秒。";
      if (!animateIt) {
        var last = toSvg(res.pts[res.pts.length - 1]);
        planeG.setAttribute("transform", "translate(" + last[0] + "," + last[1] + ")");
        readout.textContent = msg;
        busy = false;
        return;
      }
      var n = res.pts.length - 1;
      animate(Math.max(1200, res.time * 600), function (t) {
        var idx = Math.min(n, Math.floor(t * n));
        var p = toSvg(res.pts[idx]);
        var p2 = toSvg(res.pts[Math.min(n, idx + 1)]);
        var ang = Math.atan2(p2[1] - p[1], p2[0] - p[0]) * 180 / Math.PI;
        planeG.setAttribute("transform", "translate(" + p[0] + "," + p[1] + ") rotate(" + ang.toFixed(1) + ")");
      }, function () {
        readout.textContent = msg;
        busy = false;
      });
      readout.textContent = "飛行中…觀察軌跡！";
    }

    launchBtn.addEventListener("click", function () {
      if (busy) return;
      busy = true;
      var wing = document.querySelector('input[name="pp-wing"]:checked').value;
      shape.setAttribute("points", wing === "glider" ? "-14,4 14,-2 -10,-9" : "-16,3 16,-2 -12,-6");
      var res = simulate(wing, parseInt(angleInput.value, 10));
      render(res, !REDUCED);
    });

    resetBtn.addEventListener("click", function () {
      stopAllAnims();
      pathEl.setAttribute("d", "");
      planeG.setAttribute("transform", "translate(60,216)");
      readout.textContent = "選好設計和角度後按「發射」。";
    });

    onStop(function () { busy = false; });
  })();

  /* ============ 2. 吹箭 ============ */
  (function blowgun() {
    var powerInput = $("#bg-power"), powerOut = $("#bg-power-out");
    var readout = $("#bg-readout"), pathEl = $("#bg-path");
    var dartG = $("#bg-dart-g"), airRect = $("#bg-air");
    var tubeTop = $("#bg-tube-top"), tubeBot = $("#bg-tube-bot");
    var launchBtn = $("#bg-launch"), resetBtn = $("#bg-reset");
    var EXIT_X = 140, PX_PER_M = 40, TUBE_Y = 108, GROUND_Y = 230;
    var busy = false;

    powerInput.addEventListener("input", function () { powerOut.textContent = powerInput.value; });

    function tubeLen() { return parseFloat(document.querySelector('input[name="bg-len"]:checked').value); }

    function drawTube() {
      var Lpx = tubeLen() * 200; // 0.2m→40px
      var x0 = EXIT_X - Lpx;
      tubeTop.setAttribute("x", x0); tubeTop.setAttribute("width", Lpx);
      tubeBot.setAttribute("x", x0); tubeBot.setAttribute("width", Lpx);
      airRect.setAttribute("x", x0 + 2); airRect.setAttribute("width", 0);
      dartG.setAttribute("transform", "translate(" + (x0 + 8) + "," + TUBE_Y + ")");
    }

    $$('input[name="bg-len"]').forEach(function (r) {
      r.addEventListener("change", function () {
        if (busy) return;
        drawTube(); pathEl.setAttribute("d", "");
        readout.textContent = "管長改為 " + Math.round(tubeLen() * 100) + " 公分，按「吹箭發射」試試！";
      });
    });

    launchBtn.addEventListener("click", function () {
      if (busy) return;
      busy = true;
      var L = tubeLen();
      var power = parseInt(powerInput.value, 10);
      var accel = power * 50;                    // 教學示意加速度 m/s²
      var vExit = Math.sqrt(2 * accel * L);      // v = √(2aL)
      var tFall = Math.sqrt(2 * 1.2 / 9.8);      // 從 1.2 m 高度水平射出
      var range = vExit * tFall;
      var Lpx = L * 200, x0 = EXIT_X - Lpx;
      var endX = Math.min(620, EXIT_X + range * PX_PER_M);
      var msg = "出口速度約 " + vExit.toFixed(1) + " 公尺／秒，落地距離約 " + range.toFixed(1) +
        " 公尺（管長 " + Math.round(L * 100) + " 公分、力道 " + power + "）。";

      // 拋物線路徑（示意）
      var d = "M" + EXIT_X + " " + TUBE_Y;
      for (var i = 1; i <= 20; i++) {
        var f = i / 20;
        d += " L" + (EXIT_X + (endX - EXIT_X) * f).toFixed(1) + " " + (TUBE_Y + (GROUND_Y - 8 - TUBE_Y) * f * f).toFixed(1);
      }

      if (REDUCED) {
        airRect.setAttribute("width", Lpx - 4);
        pathEl.setAttribute("d", d);
        dartG.setAttribute("transform", "translate(" + (endX - 22) + "," + (GROUND_Y - 8) + ")");
        readout.textContent = msg;
        busy = false;
        return;
      }

      readout.textContent = "空氣正在管子裡推箭…";
      pathEl.setAttribute("d", "");
      // 階段1：管內加速（慢動作）
      animate(500 + L * 1000, function (t) {
        var f = t * t; // 等加速：位置與 t² 成正比
        airRect.setAttribute("width", Math.max(0, (Lpx - 4) * f));
        dartG.setAttribute("transform", "translate(" + (x0 + 8 + (Lpx - 30) * f) + "," + TUBE_Y + ")");
      }, function () {
        // 階段2：出管飛行
        pathEl.setAttribute("d", d);
        animate(700, function (t) {
          var x = EXIT_X + (endX - EXIT_X) * t;
          var y = TUBE_Y + (GROUND_Y - 8 - TUBE_Y) * t * t;
          dartG.setAttribute("transform", "translate(" + (x - 22) + "," + y + ")");
        }, function () {
          readout.textContent = msg;
          busy = false;
        });
      });
    });

    resetBtn.addEventListener("click", function () {
      stopAllAnims();
      drawTube(); pathEl.setAttribute("d", "");
      readout.textContent = "選好管長和力道後按「吹箭發射」。";
    });

    onStop(function () { busy = false; });
    drawTube();
  })();

  /* ============ 3. 氣球火箭 ============ */
  (function balloonRocket() {
    var pumpBtn = $("#br-pump"), launchBtn = $("#br-launch"), resetBtn = $("#br-reset");
    var pumpCount = $("#br-pump-count"), readout = $("#br-readout");
    var rocket = $("#br-rocket"), balloonEl = $("#br-balloon-el"), jet = $("#br-jet");
    var START_X = 70, PX_PER_M = 67.5, Y = 100;
    var pumps = 0, busy = false, MAX_PUMPS = 10;

    function balloonSize(n) { return { rx: 10 + n * 4.6, ry: 7 + n * 2.6 }; }

    function setBalloon(n) {
      var s = balloonSize(n);
      balloonEl.setAttribute("rx", s.rx);
      balloonEl.setAttribute("ry", s.ry);
    }

    pumpBtn.addEventListener("click", function () {
      if (busy || pumps >= MAX_PUMPS) return;
      pumps++;
      pumpCount.textContent = pumps;
      setBalloon(pumps);
      launchBtn.disabled = false;
      readout.textContent = "已打氣 " + pumps + " 次" + (pumps >= MAX_PUMPS ? "（氣球滿了！）" : "，可以繼續打氣或發射。");
      if (pumps >= MAX_PUMPS) pumpBtn.disabled = true;
    });

    launchBtn.addEventListener("click", function () {
      if (busy || pumps === 0) return;
      busy = true;
      launchBtn.disabled = true; pumpBtn.disabled = true;
      var dist = pumps * 0.75; // 教學示意：每次打氣約前進 0.75 m
      var endX = START_X + dist * PX_PER_M;
      var msg = "打氣 " + pumps + " 次，前進約 " + dist.toFixed(1) + " 公尺！空氣向後噴（作用力），氣球被向前推（反作用力）。";
      var startPumps = pumps;

      if (REDUCED) {
        rocket.setAttribute("transform", "translate(" + endX + "," + Y + ")");
        setBalloon(0);
        readout.textContent = msg;
        busy = false;
        return;
      }

      jet.setAttribute("opacity", "1");
      readout.textContent = "咻——！觀察空氣往哪邊噴！";
      animate(600 + startPumps * 200, function (t) {
        var ease = 1 - Math.pow(1 - t, 2.2); // 先快後慢
        rocket.setAttribute("transform", "translate(" + (START_X + (endX - START_X) * ease) + "," + Y + ")");
        setBalloon(startPumps * (1 - t));
        if (t > 0.85) jet.setAttribute("opacity", String(Math.max(0, (1 - t) / 0.15)));
      }, function () {
        jet.setAttribute("opacity", "0");
        readout.textContent = msg;
        busy = false;
        pumps = 0; pumpCount.textContent = "0";
        pumpBtn.disabled = false;
      });
    });

    onStop(function () {
      busy = false;
      jet.setAttribute("opacity", "0");
      pumpBtn.disabled = pumps >= MAX_PUMPS;
      launchBtn.disabled = pumps === 0;
    });

    resetBtn.addEventListener("click", function () {
      stopAllAnims();
      pumps = 0; pumpCount.textContent = "0";
      setBalloon(0);
      jet.setAttribute("opacity", "0");
      rocket.setAttribute("transform", "translate(" + START_X + "," + Y + ")");
      pumpBtn.disabled = false; launchBtn.disabled = true;
      readout.textContent = "先打氣（至少 1 次），再按「放手發射」。";
    });
  })();

  /* ============ 4. 空氣砲 ============ */
  (function airCannon() {
    var powerInput = $("#ac-power"), powerOut = $("#ac-power-out");
    var readout = $("#ac-readout"), ringG = $("#ac-ring-g");
    var holeCircle = $("#ac-hole-vis"), holeSquare = $("#ac-hole-vis-sq");
    var launchBtn = $("#ac-launch"), resetBtn = $("#ac-reset");
    var cups = $$(".ac-cup");
    var START_X = 100, PX_PER_M = 85, Y = 150, CUP_DIST = 5.7;
    var busy = false;
    var cupHome = cups.map(function (c) { return c.getAttribute("transform"); });

    powerInput.addEventListener("input", function () { powerOut.textContent = powerInput.value; });

    $$('input[name="ac-hole"]').forEach(function (r) {
      r.addEventListener("change", function () {
        var isCircle = holeShape() === "circle";
        holeCircle.setAttribute("visibility", isCircle ? "visible" : "hidden");
        holeSquare.setAttribute("visibility", isCircle ? "hidden" : "visible");
      });
    });

    function holeShape() { return document.querySelector('input[name="ac-hole"]:checked').value; }

    function knockCups() {
      cups.forEach(function (c, i) {
        var rot = 60 + i * 25;
        c.setAttribute("transform", "translate(" + (585 + i * 22) + "," + (186 + (i === 2 ? 24 : 0)) + ") rotate(" + rot + ")");
      });
    }

    function restoreCups() {
      cups.forEach(function (c, i) { c.setAttribute("transform", cupHome[i]); });
    }

    launchBtn.addEventListener("click", function () {
      if (busy) return;
      busy = true;
      var shape = holeShape();
      var power = parseInt(powerInput.value, 10);
      var range = shape === "circle" ? 0.85 * power : 0.4 * power; // 教學示意距離
      range = Math.min(range, 6.0);
      var hit = shape === "circle" && range >= CUP_DIST;
      var endX = START_X + range * PX_PER_M;
      var msg = (shape === "circle" ? "圓孔渦環穩定前進，" : "方孔渦環搖搖晃晃、越飛越散，") +
        "約飛了 " + range.toFixed(1) + " 公尺。" +
        (hit ? "💥 推倒紙杯塔，成功！" : "沒碰到 6 公尺外的紙杯" + (shape === "circle" ? "，力道再大一點試試！" : "。換圓孔試試看？"));

      if (REDUCED) {
        ringG.setAttribute("opacity", "0.9");
        ringG.setAttribute("transform", "translate(" + endX + "," + Y + ")");
        if (hit) knockCups();
        readout.textContent = msg;
        busy = false;
        return;
      }

      readout.textContent = "渦環發射！盯著它看——";
      ringG.setAttribute("opacity", "1");
      animate(900 + range * 120, function (t) {
        var x = START_X + (endX - START_X) * t;
        var wob = shape === "square" ? Math.sin(t * 26) * 14 * t : 0;
        var fade = shape === "square" ? Math.max(0.12, 1 - t * 0.95) : Math.max(0.35, 1 - t * 0.55);
        var grow = 1 + t * (shape === "square" ? 1.6 : 0.7);
        ringG.setAttribute("transform", "translate(" + x + "," + (Y + wob) + ") scale(" + grow.toFixed(2) + ")");
        ringG.setAttribute("opacity", String(fade));
      }, function () {
        if (hit) knockCups();
        readout.textContent = msg;
        busy = false;
      });
    });

    onStop(function () { busy = false; });

    resetBtn.addEventListener("click", function () {
      stopAllAnims();
      ringG.setAttribute("opacity", "0");
      ringG.setAttribute("transform", "translate(" + START_X + "," + Y + ")");
      restoreCups();
      readout.textContent = "選好孔形和力道後按「發射空氣砲」。";
    });
  })();

  /* ============ 5. 魔法闖關 ============ */
  (function quiz() {
    var QUESTIONS = [
      { tag: "✈️ 紙飛機", q: "把紙飛機往「上」托住、對抗重力的力叫做什麼？",
        c: ["阻力", "升力", "推力", "磨擦力"], a: 1,
        exp: "空氣流過機翼會產生升力，方向朝上，對抗把飛機往下拉的重力。" },
      { tag: "✈️ 紙飛機", q: "紙飛機沒有引擎，它的「推力」是從哪裡來的？",
        c: ["你丟出去那一瞬間手給的力", "機翼自己產生", "太陽光", "地球引力"], a: 0,
        exp: "紙飛機的推力來自投擲瞬間，之後靠滑翔前進，速度會被阻力慢慢消耗。" },
      { tag: "✈️ 紙飛機", q: "機翼「寬大」的紙飛機通常會怎麼飛？",
        c: ["飛得最快最直", "馬上墜落", "升力大、阻力也大，飛得慢但滑翔久", "完全不受重力影響"], a: 2,
        exp: "寬大機翼升力大，能慢慢滑翔；但阻力也大，所以速度慢、衝不遠。" },
      { tag: "🎯 吹箭", q: "吹箭的箭是被什麼推出管子的？",
        c: ["磁力", "箭後方和前方空氣的「壓力差」", "重力", "管子的彈力"], a: 1,
        exp: "吹氣讓箭後方壓力變大，前方仍是一般大氣壓，後大前小的壓力差把箭往前推。" },
      { tag: "🎯 吹箭", q: "同樣的吹氣力道，管子越長，箭衝出管口的速度會？",
        c: ["越慢", "一樣快", "變成零", "越快，因為被推著加速的距離變長"], a: 3,
        exp: "管子越長，空氣推箭加速的距離越長，出口速度就越快。" },
      { tag: "🎯 吹箭", q: "玩吹箭時，哪一條安全守則是正確的？",
        c: ["只能吹、不能吸，也不可以對人發射", "可以對同學發射比較刺激", "用嘴巴把箭吸回來", "箭做得越尖越好"], a: 0,
        exp: "吸氣可能把箭吸進嘴裡非常危險；吹箭也絕對不能對人或動物發射。" },
      { tag: "🎈 氣球火箭", q: "放手後氣球火箭往前衝，是因為什麼力？",
        c: ["棉線在前面拉它", "重力", "噴出空氣時產生的反作用力", "空氣從前面吸它"], a: 2,
        exp: "氣球把空氣向後噴（作用力），空氣同時把氣球向前推（反作用力）。" },
      { tag: "🎈 氣球火箭", q: "牛頓第三運動定律說，作用力和反作用力的關係是？",
        c: ["大小相等、方向相反", "大小不同、方向相同", "只有作用力沒有反作用力", "方向一樣、大小一樣"], a: 0,
        exp: "兩力永遠同時出現，大小相等、方向相反，作用在不同物體上。" },
      { tag: "🎈 氣球火箭", q: "為什麼打氣打越多，氣球火箭衝越遠？",
        c: ["氣球變重了", "氣球裡的空氣多，噴氣時間長，推力持續比較久", "顏色變深比較快", "棉線變得比較滑"], a: 1,
        exp: "氣越多、噴越久，反作用力作用的時間越長，氣球就衝得越遠。" },
      { tag: "💨 空氣砲", q: "空氣砲射出去的「隱形砲彈」其實是？",
        c: ["一顆水滴", "一道光", "一團會旋轉的空氣渦環", "一張紙"], a: 2,
        exp: "被擠出圓孔的空氣捲成像甜甜圈一樣旋轉的渦環，穩定地往前飛。" },
      { tag: "💨 空氣砲", q: "哪一種形狀的孔，做出來的渦環最穩定、飛最遠？",
        c: ["方形孔", "三角形孔", "星形孔", "圓形孔"], a: 3,
        exp: "科展實驗發現孔越接近圓形，渦環越完整、衝力越大、飛得越遠。" },
      { tag: "💨 空氣砲", q: "空氣為什麼會捲成一圈一圈的渦環？",
        c: ["因為孔中間的空氣衝得快、邊緣的空氣被拖慢，一快一慢捲起來", "因為地球自轉", "因為磁場吸引", "因為聲音的震動"], a: 0,
        exp: "中間快、邊緣慢的速度差讓空氣捲成環狀旋轉，所以渦環又穩又能飛遠。" },
      { tag: "🌀 綜合", q: "下面哪一件事「不能」證明空氣真的存在、有力量？",
        c: ["空氣砲把紙杯推倒", "吹箭被吹出管子", "氣球火箭往前衝", "石頭放在桌上不動"], a: 3,
        exp: "石頭不動跟空氣的力量無關；前三個都是空氣推動物體的證據。" }
    ];

    var listEl = $("#quiz-list"), scoreEl = $("#quiz-score");
    var score = 0, answered = 0;

    function renderQuiz() {
      score = 0; answered = 0;
      scoreEl.textContent = "目前得分：0 / " + QUESTIONS.length;
      listEl.innerHTML = "";
      QUESTIONS.forEach(function (item, qi) {
        var div = document.createElement("div");
        div.className = "quiz-item";
        var tag = document.createElement("span");
        tag.className = "quiz-tag"; tag.textContent = item.tag;
        var h = document.createElement("h3");
        h.textContent = "第 " + (qi + 1) + " 題：" + item.q;
        var choices = document.createElement("div");
        choices.className = "quiz-choices";
        var fb = document.createElement("p");
        fb.className = "quiz-fb"; fb.hidden = true;
        fb.setAttribute("aria-live", "polite");

        item.c.forEach(function (text, ci) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "quiz-choice";
          btn.textContent = "（" + "ABCD"[ci] + "）" + text;
          btn.addEventListener("click", function () {
            var all = choices.querySelectorAll("button");
            all.forEach(function (b) { b.disabled = true; });
            all[item.a].classList.add("is-correct");
            answered++;
            if (ci === item.a) {
              score++;
              fb.className = "quiz-fb ok";
              fb.textContent = "✅ 答對了！" + item.exp;
            } else {
              btn.classList.add("is-wrong");
              fb.className = "quiz-fb err";
              fb.textContent = "❌ 還差一點。正確答案是（" + "ABCD"[item.a] + "）。" + item.exp;
            }
            fb.hidden = false;
            var msg = "目前得分：" + score + " / " + QUESTIONS.length;
            if (answered === QUESTIONS.length) {
              msg += score >= 10
                ? " —— 🎉 恭喜！你獲得「空氣魔法師」稱號！"
                : " —— 再回到前面的實驗室複習，按「重新挑戰」再試一次！";
            }
            scoreEl.textContent = msg;
          });
          choices.appendChild(btn);
        });

        div.appendChild(tag); div.appendChild(h); div.appendChild(choices); div.appendChild(fb);
        listEl.appendChild(div);
      });
    }

    $("#quiz-reset").addEventListener("click", renderQuiz);
    renderQuiz();
  })();
})();
