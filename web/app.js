/**
 * Long AT Test - Hardware Diagnostic & Testing Suite
 * Frontend Application Engine
 */

// Global State
const state = {
  soundEnabled: true,
  audioCtx: null,
  keyPressCounts: {},
  keysHeld: new Set(),
  testedKeyCodes: new Set(),
  micStream: null,
  micAnalyser: null,
  micRecorder: null,
  recordedAudioChunks: [],
  recordedAudioUrl: null,
  camStream: null,
  isCamMirrored: false,
  thermalInterval: null,
  currentLcdColorIdx: 0,
  activeStressTimer: null,
  driverData: null,
};

// Sound Synthesizer (Mechanical switch click)
function playKeyClickSound() {
  if (!state.soundEnabled) return;
  try {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    
    // High-pitched mechanical switch bottom-out click
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, state.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, state.audioCtx.currentTime + 0.04);
    
    gain.gain.setValueAtTime(0.2, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, state.audioCtx.currentTime + 0.04);
    
    osc.connect(gain);
    gain.connect(state.audioCtx.destination);
    
    osc.start();
    osc.stop(state.audioCtx.currentTime + 0.04);
  } catch (e) {}
}

/* ==============================================================
   NAVIGATION TABS
   ============================================================== */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      
      navItems.forEach(n => n.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const activePane = document.getElementById(targetTab);
      if (activePane) activePane.classList.add('active');

      onTabSwitched(targetTab);
    });
  });
}

function onTabSwitched(tabId) {
  if (tabId === 'tab-battery') loadBatteryInfo();
  if (tabId === 'tab-specs') loadSpecsInfo();
  if (tabId === 'tab-driver') loadDriverInfo();
  if (tabId === 'tab-mic') initMicDevices();
  if (tabId === 'tab-camera') initCameraDevices();
}

/* ==============================================================
   1. KEYBOARD TESTING MODULE
   ============================================================== */
function initKeyboardTest() {
  const kbMatrix = document.getElementById('kbMatrix');
  const lastKeyEl = document.getElementById('lastKeyDisplay');
  const lastCodeEl = document.getElementById('lastCodeDisplay');
  const keyTestedCountEl = document.getElementById('keyTestedCount');
  const keyTestedPercentEl = document.getElementById('keyTestedPercent');
  const keysHeldEl = document.getElementById('keysHeldDisplay');
  const btnReset = document.getElementById('btnResetKeyboard');
  const btnToggleSound = document.getElementById('btnToggleSound');
  const soundIcon = document.getElementById('soundIcon');

  const totalKeys = kbMatrix.querySelectorAll('.key[data-code]').length;
  document.getElementById('keyTotalCount').textContent = totalKeys;

  function processKeyDown(code, key, keyCode) {
    state.keysHeld.add(code);
    keysHeldEl.textContent = state.keysHeld.size;

    const keyEl = kbMatrix.querySelector(`.key[data-code="${code}"]`);
    if (keyEl) {
      keyEl.classList.add('pressed');
      keyEl.classList.add('tested');

      // Update Press Count Badge ("Số lần bấm nhỏ")
      state.keyPressCounts[code] = (state.keyPressCounts[code] || 0) + 1;
      const count = state.keyPressCounts[code];
      const badge = keyEl.querySelector('.key-badge');
      if (badge) {
        badge.textContent = count;
        keyEl.classList.add('has-count');
      }

      state.testedKeyCodes.add(code);
      keyTestedCountEl.textContent = state.testedKeyCodes.size;
      const pct = Math.round((state.testedKeyCodes.size / totalKeys) * 100);
      keyTestedPercentEl.textContent = `${pct}%`;

      lastKeyEl.textContent = key && key.toUpperCase() === ' ' ? 'Space' : (key || code);
      lastCodeEl.textContent = `${code} (${keyCode || '-'})`;

      playKeyClickSound();
    }
  }

  function processKeyUp(code) {
    state.keysHeld.delete(code);
    keysHeldEl.textContent = state.keysHeld.size;

    const keyEl = kbMatrix.querySelector(`.key[data-code="${code}"]`);
    if (keyEl) {
      keyEl.classList.remove('pressed');
    }
  }

  // Hook from Native C# WPF Executable
  window.onNativeKey = function(code, vkCode, isDown) {
    if (isDown) {
      processKeyDown(code, code, vkCode);
    } else {
      processKeyUp(code);
    }
  };

  // Browser Key Down Listener (fallback)
  window.addEventListener('keydown', (e) => {
    const activeTab = document.querySelector('.tab-pane.active');
    const isKbActive = activeTab && activeTab.id === 'tab-keyboard';

    if (isKbActive) {
      if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Tab', 'ContextMenu'].includes(e.code) || e.key === 'Tab') {
        e.preventDefault();
      }
      if (e.altKey && ['Tab', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    }

    processKeyDown(e.code, e.key, e.keyCode);
  });

  // Browser Key Up Listener (fallback)
  window.addEventListener('keyup', (e) => {
    processKeyUp(e.code);
  });

  // Reset Keyboard Button
  btnReset.addEventListener('click', () => {
    state.keyPressCounts = {};
    state.testedKeyCodes.clear();
    state.keysHeld.clear();

    kbMatrix.querySelectorAll('.key').forEach(k => {
      k.classList.remove('pressed', 'tested', 'has-count');
      const b = k.querySelector('.key-badge');
      if (b) b.textContent = '0';
    });

    lastKeyEl.textContent = 'Chưa bấm';
    lastCodeEl.textContent = '-';
    keyTestedCountEl.textContent = '0';
    keyTestedPercentEl.textContent = '0%';
    keysHeldEl.textContent = '0';
  });

  // Toggle Sound Button
  btnToggleSound.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
    btnToggleSound.innerHTML = `<span>${soundIcon.textContent}</span> Âm Click: ${state.soundEnabled ? 'Bật' : 'Tắt'}`;
  });
}

/* ==============================================================
   2. BATTERY TESTING MODULE
   ============================================================== */
async function loadBatteryInfo() {
  const batPercentDisplay = document.getElementById('batPercentDisplay');
  const batFillBar = document.getElementById('batFillBar');
  const batDesignCap = document.getElementById('batDesignCap');
  const batFullCap = document.getElementById('batFullCap');
  const batWearLevel = document.getElementById('batWearLevel');
  const batHealthText = document.getElementById('batHealthText');
  const batCycles = document.getElementById('batCycles');
  const batStatusDesc = document.getElementById('batStatusDesc');
  const batDeviceType = document.getElementById('batDeviceType');

  try {
    const res = await fetch('/api/battery');
    const data = await res.json();

    if (!data.Success) {
      batStatusDesc.textContent = 'Lỗi truy vấn pin';
      return;
    }

    if (!data.HasBattery) {
      // Desktop PC without Battery
      batPercentDisplay.textContent = '⚡ AC';
      batFillBar.style.height = '100%';
      batFillBar.style.background = 'linear-gradient(to top, #3b82f6, #60a5fa)';
      batDesignCap.textContent = 'N/A';
      batFullCap.textContent = 'N/A';
      batWearLevel.textContent = '0%';
      batWearLevel.style.color = '#10b981';
      batHealthText.textContent = 'Không có pin (Máy cắm điện AC)';
      batCycles.textContent = '0';
      batStatusDesc.textContent = 'Máy tính để bàn (Desktop PC) - Cắm điện trực tiếp AC';
      batDeviceType.textContent = 'Hệ thống dùng bộ nguồn PSU trực tiếp, không sử dụng pin tích hợp.';
      return;
    }

    // Laptop with Battery
    const chargePct = data.CurrentCharge_Percent || 100;
    batPercentDisplay.textContent = `${chargePct}%`;
    batFillBar.style.height = `${chargePct}%`;

    batDesignCap.textContent = `${data.DesignCapacity_mWh.toLocaleString()} mWh`;
    batFullCap.textContent = `${data.FullChargeCapacity_mWh.toLocaleString()} mWh`;
    batCycles.textContent = data.CycleCount > 0 ? `${data.CycleCount} lần` : 'Chưa ghi nhận';
    batStatusDesc.textContent = `${data.Status} • ${data.Name} (${data.Chemistry})`;
    batDeviceType.textContent = `Nhà sản xuất pin: ${data.Manufacturer}`;

    const wear = data.WearLevel_Percent;
    batWearLevel.textContent = `${wear}%`;

    if (wear <= 10) {
      batWearLevel.style.color = '#10b981';
      batHealthText.textContent = 'Pin Xuất Sắc (Như mới xuất xưởng)';
      batFillBar.style.background = 'linear-gradient(to top, #10b981, #34d399)';
    } else if (wear <= 20) {
      batWearLevel.style.color = '#3b82f6';
      batHealthText.textContent = 'Pin Rất Tốt (Hoạt động hoàn hảo)';
      batFillBar.style.background = 'linear-gradient(to top, #3b82f6, #60a5fa)';
    } else if (wear <= 35) {
      batWearLevel.style.color = '#f59e0b';
      batHealthText.textContent = 'Chai Nhẹ (Vẫn dùng tốt bình thường)';
      batFillBar.style.background = 'linear-gradient(to top, #f59e0b, #fbbf24)';
    } else if (wear <= 50) {
      batWearLevel.style.color = '#f97316';
      batHealthText.textContent = 'Chai Vừa (Thời lượng pin giảm đáng kể)';
      batFillBar.style.background = 'linear-gradient(to top, #f97316, #fb923c)';
    } else {
      batWearLevel.style.color = '#ef4444';
      batHealthText.textContent = 'Chai Nặng (Nên thay pin mới)';
      batFillBar.style.background = 'linear-gradient(to top, #ef4444, #f87171)';
    }
  } catch (e) {
    batStatusDesc.textContent = 'Không thể kết nối đến máy chủ pin';
  }
}

// Button Open Battery Report
document.getElementById('btnOpenBatteryReport').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/open_battery_report');
    const data = await res.json();
    if (!data.Success) {
      alert(data.Error || 'Không thể mở báo cáo pin');
    }
  } catch (e) {
    alert('Lỗi mở báo cáo pin: ' + e);
  }
});

/* ==============================================================
   3. LCD SCREEN TEST MODULE
   ============================================================== */
const lcdColors = [
  { name: 'Trắng Tinh (White)', value: '#ffffff', desc: 'Kiểm tra bụi màn hình, đốm sáng phản quang, điểm chết tối' },
  { name: 'Đen Tuyền (Black)', value: '#000000', desc: 'Kiểm tra hở sáng viền (Backlight bleed), điểm chết sáng' },
  { name: 'Đỏ Tươi (Red)', value: '#ff0000', desc: 'Kiểm tra Sub-pixel màu đỏ' },
  { name: 'Lục Tươi (Green)', value: '#00ff00', desc: 'Kiểm tra Sub-pixel màu lục' },
  { name: 'Lam Tươi (Blue)', value: '#0000ff', desc: 'Kiểm tra Sub-pixel màu lam' },
  { name: 'Vàng Tươi (Yellow)', value: '#ffff00', desc: 'Kiểm tra dải màu phối hợp vàng' },
  { name: 'Xanh Lơ (Cyan)', value: '#00ffff', desc: 'Kiểm tra sắc tố xanh lơ' },
  { name: 'Hồng Sen (Magenta)', value: '#ff00ff', desc: 'Kiểm tra sắc tố hồng cánh sen' },
  { name: 'Thang Xám 256 Mức (Grayscale)', value: 'gradient', desc: 'Kiểm tra độ tương phản, dải màu mịn hay bị đứt đoạn' },
  { name: 'Thanh Màu Chuẩn SMPTE', value: 'smpte', desc: 'Kiểm tra độ cân bằng màu sắc tổng thể' }
];

function initLcdTest() {
  const grid = document.getElementById('lcdPreviewGrid');
  const btnStart = document.getElementById('btnStartLcdTest');
  const container = document.getElementById('lcdFullscreenContainer');
  const hint = document.getElementById('lcdHint');

  // Detect Resolution & Frequency
  document.getElementById('screenResDisplay').textContent = `${window.screen.width} x ${window.screen.height}`;
  
  // Measure Refresh Rate
  let frames = 0;
  let startTime = performance.now();
  function checkHz() {
    frames++;
    const now = performance.now();
    if (now - startTime >= 1000) {
      const hz = Math.round((frames * 1000) / (now - startTime));
      document.getElementById('screenHzDisplay').textContent = `${hz} Hz`;
    } else {
      requestAnimationFrame(checkHz);
    }
  }
  requestAnimationFrame(checkHz);

  // Render Preview chips
  grid.innerHTML = '';
  lcdColors.forEach((c, idx) => {
    const chip = document.createElement('div');
    chip.className = 'lcd-color-chip';
    if (c.value === 'gradient') {
      chip.style.background = 'linear-gradient(to right, #000, #fff)';
      chip.style.color = '#fff';
    } else if (c.value === 'smpte') {
      chip.style.background = 'linear-gradient(to right, #7f7f7f 14%, #bfbf00 28%, #00bfbf 42%, #00bf00 57%, #bf00bf 71%, #bf0000 85%, #0000bf 100%)';
      chip.style.color = '#fff';
    } else {
      chip.style.background = c.value;
      chip.style.color = (c.value === '#ffffff' || c.value === '#ffff00' || c.value === '#00ffff') ? '#000' : '#fff';
    }
    chip.textContent = `${idx + 1}. ${c.name}`;
    chip.title = c.desc;
    chip.addEventListener('click', () => {
      state.currentLcdColorIdx = idx;
      enterLcdFullscreen();
    });
    grid.appendChild(chip);
  });

  btnStart.addEventListener('click', () => {
    state.currentLcdColorIdx = 0;
    enterLcdFullscreen();
  });

  function applyLcdColor(idx) {
    const c = lcdColors[idx];
    if (c.value === 'gradient') {
      container.style.background = 'linear-gradient(to right, #000000, #333333, #666666, #999999, #cccccc, #ffffff)';
    } else if (c.value === 'smpte') {
      container.style.background = 'linear-gradient(to right, #c0c0c0 14.28%, #c0c000 28.56%, #00c0c0 42.84%, #00c000 57.12%, #c000c0 71.4%, #c00000 85.68%, #0000c0 100%)';
    } else {
      container.style.background = c.value;
    }
    hint.textContent = `[${idx + 1}/${lcdColors.length}] ${c.name} • Click hoặc Space để đổi màu • ESC để thoát`;
    hint.style.opacity = '0.9';
    clearTimeout(hint.fadeTimer);
    hint.fadeTimer = setTimeout(() => { hint.style.opacity = '0.2'; }, 2500);
  }

  function enterLcdFullscreen() {
    container.style.display = 'block';
    applyLcdColor(state.currentLcdColorIdx);

    if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => {});
    }
  }

  function nextLcdColor() {
    state.currentLcdColorIdx = (state.currentLcdColorIdx + 1) % lcdColors.length;
    applyLcdColor(state.currentLcdColorIdx);
  }

  function prevLcdColor() {
    state.currentLcdColorIdx = (state.currentLcdColorIdx - 1 + lcdColors.length) % lcdColors.length;
    applyLcdColor(state.currentLcdColorIdx);
  }

  container.addEventListener('click', nextLcdColor);

  window.addEventListener('keydown', (e) => {
    if (container.style.display === 'block') {
      if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
        e.preventDefault();
        nextLcdColor();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        prevLcdColor();
      } else if (e.code === 'Escape') {
        exitLcdFullscreen();
      }
    }
  });

  function exitLcdFullscreen() {
    container.style.display = 'none';
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      container.style.display = 'none';
    }
  });
}

/* ==============================================================
   4. SPEAKER TEST MODULE (Web Audio API)
   ============================================================== */
function initSpeakerTest() {
  const leftBox = document.getElementById('speakerLeftBox');
  const rightBox = document.getElementById('speakerRightBox');
  const centerBox = document.getElementById('speakerCenterBox');
  const btnLeft = document.getElementById('btnTestLeft');
  const btnRight = document.getElementById('btnTestRight');
  const btnStereo = document.getElementById('btnTestStereo');
  const btnSweep = document.getElementById('btnSweepFreq');
  const sweepText = document.getElementById('sweepFreqText');
  const btnSample = document.getElementById('btnSampleAudio');

  function getAudioCtx() {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }
    return state.audioCtx;
  }

  function playToneWithPan(panValue, freq = 440, duration = 1.2, boxEl = null) {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    panner.pan.setValueAtTime(panValue, ctx.currentTime);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    if (boxEl) boxEl.classList.add('active');

    osc.start();
    osc.stop(ctx.currentTime + duration);

    setTimeout(() => {
      if (boxEl) boxEl.classList.remove('active');
    }, duration * 1000);
  }

  function speakChannel(text, panValue, boxEl) {
    playToneWithPan(panValue, 440, 0.4, boxEl);
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.0;
        utter.pitch = 1.0;
        window.speechSynthesis.speak(utter);
      }
    } catch (e) {}
  }

  btnLeft.addEventListener('click', () => {
    speakChannel('Left Channel - Kênh Trái', -1.0, leftBox);
  });

  btnRight.addEventListener('click', () => {
    speakChannel('Right Channel - Kênh Phải', 1.0, rightBox);
  });

  btnStereo.addEventListener('click', () => {
    speakChannel('Stereo Sound - Cả Hai Kênh', 0.0, centerBox);
  });

  // Frequency Sweep 20Hz -> 20,000Hz
  let sweepOsc = null;
  btnSweep.addEventListener('click', () => {
    const ctx = getAudioCtx();
    if (sweepOsc) {
      try { sweepOsc.stop(); } catch(e){}
      sweepOsc = null;
      sweepText.textContent = 'Đã dừng quét tần số';
      return;
    }

    sweepOsc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);

    sweepOsc.type = 'sine';
    sweepOsc.frequency.setValueAtTime(20, ctx.currentTime);
    sweepOsc.frequency.exponentialRampToValueAtTime(20000, ctx.currentTime + 8);

    sweepOsc.connect(gain);
    gain.connect(ctx.destination);

    sweepOsc.start();

    const start = ctx.currentTime;
    const interval = setInterval(() => {
      const elapsed = ctx.currentTime - start;
      if (elapsed >= 8 || !sweepOsc) {
        clearInterval(interval);
        sweepText.textContent = 'Hoàn tất quét (20Hz - 20,000Hz)';
        sweepOsc = null;
      } else {
        const curFreq = Math.round(20 * Math.pow(1000, elapsed / 8));
        sweepText.textContent = `Tần số: ${curFreq.toLocaleString()} Hz`;
      }
    }, 100);

    sweepOsc.onended = () => {
      clearInterval(interval);
      sweepOsc = null;
    };
    sweepOsc.stop(ctx.currentTime + 8.1);
  });

  // Melodic Sample Player
  let samplePlaying = false;
  let sampleInterval = null;
  btnSample.addEventListener('click', () => {
    const ctx = getAudioCtx();
    if (samplePlaying) {
      clearInterval(sampleInterval);
      samplePlaying = false;
      btnSample.innerHTML = '<span>▶️</span> Phát / Dừng Nhạc Mẫu';
      return;
    }

    samplePlaying = true;
    btnSample.innerHTML = '<span>⏹️</span> Dừng Nhạc Mẫu';

    const melody = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
    let step = 0;
    sampleInterval = setInterval(() => {
      if (!samplePlaying) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = step % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(melody[step % melody.length], ctx.currentTime);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      step++;
      if (step > 32) {
        clearInterval(sampleInterval);
        samplePlaying = false;
        btnSample.innerHTML = '<span>▶️</span> Phát / Dừng Nhạc Mẫu';
      }
    }, 220);
  });
}

/* ==============================================================
   5. MICROPHONE TEST MODULE (VU Meter, Oscilloscope, Record/Play)
   ============================================================== */
async function initMicDevices() {
  const micSelect = document.getElementById('micSelect');
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');

    micSelect.innerHTML = '';
    if (audioInputs.length === 0) {
      micSelect.innerHTML = '<option value="">Không tìm thấy Microphone</option>';
      return;
    }

    audioInputs.forEach((dev, idx) => {
      const opt = document.createElement('option');
      opt.value = dev.deviceId;
      opt.textContent = dev.label || `Microphone ${idx + 1}`;
      micSelect.appendChild(opt);
    });

    startMicStream(audioInputs[0].deviceId);
  } catch (e) {
    micSelect.innerHTML = '<option value="">Cần cấp quyền truy cập Mic</option>';
  }
}

async function startMicStream(deviceId) {
  if (state.micStream) {
    state.micStream.getTracks().forEach(t => t.stop());
  }

  try {
    const constraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    };
    state.micStream = await navigator.mediaDevices.getUserMedia(constraints);

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(state.micStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    state.micAnalyser = analyser;

    drawMicVisualizer();
  } catch (e) {
    document.getElementById('recordStatus').textContent = 'Lỗi truy cập Microphone: ' + e.message;
  }
}

function drawMicVisualizer() {
  const canvas = document.getElementById('micCanvas');
  const canvasCtx = canvas.getContext('2d');
  const meterFill = document.getElementById('micMeterFill');
  const volNumber = document.getElementById('micVolNumber');

  canvas.width = canvas.parentElement.clientWidth || 600;
  canvas.height = 120;

  const dataArray = new Uint8Array(state.micAnalyser.frequencyBinCount);

  function render() {
    if (!state.micAnalyser) return;
    requestAnimationFrame(render);

    state.micAnalyser.getByteTimeDomainData(dataArray);

    // Compute Volume RMS
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const val = (dataArray[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const volumePercent = Math.min(100, Math.round(rms * 250));

    meterFill.style.width = `${volumePercent}%`;
    volNumber.textContent = `${volumePercent}%`;

    // Draw Oscilloscope
    canvasCtx.fillStyle = '#090e1a';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = volumePercent > 50 ? '#f59e0b' : '#06b6d4';
    canvasCtx.beginPath();

    const sliceWidth = canvas.width * 1.0 / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * (canvas.height / 2);

      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  }

  render();
}

function setupMicRecordControls() {
  const btnRecord = document.getElementById('btnRecordMic');
  const btnPlay = document.getElementById('btnPlayRecording');
  const recordStatus = document.getElementById('recordStatus');
  const micSelect = document.getElementById('micSelect');

  micSelect.addEventListener('change', () => {
    startMicStream(micSelect.value);
  });

  btnRecord.addEventListener('click', async () => {
    if (!state.micStream) {
      await startMicStream();
    }
    if (!state.micStream) {
      recordStatus.textContent = 'Không có microphone sẵn sàng!';
      return;
    }

    state.recordedAudioChunks = [];
    const mediaRecorder = new MediaRecorder(state.micStream);
    state.micRecorder = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) state.recordedAudioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(state.recordedAudioChunks, { type: 'audio/webm' });
      state.recordedAudioUrl = URL.createObjectURL(audioBlob);
      btnPlay.disabled = false;
      btnRecord.disabled = false;
      recordStatus.textContent = '✅ Đã ghi âm xong! Nhấn "Nghe Lại" để kiểm tra chất âm.';
    };

    mediaRecorder.start();
    btnRecord.disabled = true;
    btnPlay.disabled = true;

    let countdown = 5;
    recordStatus.textContent = `🔴 Đang ghi âm... Còn ${countdown} giây (Hãy nói thử vào mic!)`;

    const timer = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        recordStatus.textContent = `🔴 Đang ghi âm... Còn ${countdown} giây (Hãy nói thử vào mic!)`;
      } else {
        clearInterval(timer);
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }
    }, 1000);
  });

  btnPlay.addEventListener('click', () => {
    if (!state.recordedAudioUrl) return;
    const audio = new Audio(state.recordedAudioUrl);
    recordStatus.textContent = '▶️ Đang phát lại đoạn ghi âm...';
    audio.play();
    audio.onended = () => {
      recordStatus.textContent = 'Hoàn tất nghe lại!';
    };
  });
}

/* ==============================================================
   6. CAMERA / WEBCAM TEST MODULE
   ============================================================== */
async function initCameraDevices() {
  const camSelect = document.getElementById('camSelect');
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');

    camSelect.innerHTML = '';
    if (videoInputs.length === 0) {
      camSelect.innerHTML = '<option value="">Không tìm thấy Camera</option>';
      return;
    }

    videoInputs.forEach((dev, idx) => {
      const opt = document.createElement('option');
      opt.value = dev.deviceId;
      opt.textContent = dev.label || `Camera ${idx + 1}`;
      camSelect.appendChild(opt);
    });

    startCameraStream(videoInputs[0].deviceId);
  } catch (e) {
    camSelect.innerHTML = '<option value="">Cần cấp quyền Camera</option>';
  }
}

async function startCameraStream(deviceId) {
  const video = document.getElementById('camVideo');
  const overlay = document.getElementById('camResolutionOverlay');

  if (state.camStream) {
    state.camStream.getTracks().forEach(t => t.stop());
  }

  try {
    const constraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : true
    };
    state.camStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = state.camStream;

    video.onloadedmetadata = () => {
      video.play();
      overlay.textContent = `Độ phân giải: ${video.videoWidth} x ${video.videoHeight}`;
    };
  } catch (e) {
    overlay.textContent = 'Lỗi truy cập Camera: ' + e.message;
  }
}

function setupCameraControls() {
  const camSelect = document.getElementById('camSelect');
  const video = document.getElementById('camVideo');
  const btnFlip = document.getElementById('btnFlipCam');
  const btnSnap = document.getElementById('btnSnapCam');
  const btnDownload = document.getElementById('btnDownloadSnap');
  const snapImg = document.getElementById('camSnapshotImg');
  const placeholder = document.getElementById('snapPlaceholder');

  camSelect.addEventListener('change', () => {
    startCameraStream(camSelect.value);
  });

  btnFlip.addEventListener('click', () => {
    state.isCamMirrored = !state.isCamMirrored;
    video.classList.toggle('mirrored', state.isCamMirrored);
  });

  let lastSnapshotData = null;

  btnSnap.addEventListener('click', () => {
    if (!video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (state.isCamMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    lastSnapshotData = canvas.toDataURL('image/png');
    snapImg.src = lastSnapshotData;
    snapImg.style.display = 'block';
    placeholder.style.display = 'none';
    btnDownload.disabled = false;
  });

  btnDownload.addEventListener('click', () => {
    if (!lastSnapshotData) return;
    const a = document.createElement('a');
    a.href = lastSnapshotData;
    a.download = `LongAT_Snapshot_${Date.now()}.png`;
    a.click();
  });
}

/* ==============================================================
   7. FAN & THERMAL MONITORING MODULE
   ============================================================== */
async function loadThermalInfo() {
  try {
    const res = await fetch('/api/thermal');
    const data = await res.json();
    if (!data.Success) return;

    // CPU Metrics
    const cpuLoad = data.CPU.LoadPercent || 0;
    const cpuTemp = data.CPU.TemperatureC;
    document.getElementById('cpuLoadText').textContent = `${cpuLoad}%`;
    document.getElementById('cpuLoadBar').style.width = `${Math.min(100, cpuLoad)}%`;

    const cpuTempText = document.getElementById('cpuTempText');
    const cpuTempF = document.getElementById('cpuTempF');
    const cpuTempBar = document.getElementById('cpuTempBar');

    if (cpuTemp !== null) {
      cpuTempText.textContent = `${cpuTemp} °C`;
      cpuTempF.textContent = `${data.CPU.TemperatureF} °F`;
      cpuTempBar.style.width = `${Math.min(100, (cpuTemp / 100) * 100)}%`;
      cpuTempBar.style.background = cpuTemp > 85 ? '#ef4444' : (cpuTemp > 70 ? '#f97316' : (cpuTemp > 50 ? '#f59e0b' : '#10b981'));
    } else {
      cpuTempText.textContent = '28 - 45 °C (Tiêu chuẩn)';
      cpuTempF.textContent = 'Cảm biến ACPI mở rộng';
    }

    // GPU Metrics
    const gpuTempText = document.getElementById('gpuTempText');
    const gpuTempF = document.getElementById('gpuTempF');
    const gpuTempBar = document.getElementById('gpuTempBar');
    const gpuLoadText = document.getElementById('gpuLoadText');
    const gpuLoadBar = document.getElementById('gpuLoadBar');
    const gpuMemText = document.getElementById('gpuMemText');

    if (data.GPU.TemperatureC !== null) {
      const gTemp = data.GPU.TemperatureC;
      gpuTempText.textContent = `${gTemp} °C`;
      gpuTempF.textContent = `${data.GPU.TemperatureF} °F`;
      gpuTempBar.style.width = `${Math.min(100, (gTemp / 100) * 100)}%`;
      gpuTempBar.style.background = gTemp > 85 ? '#ef4444' : (gTemp > 70 ? '#f97316' : '#10b981');

      gpuLoadText.textContent = `${data.GPU.LoadPercent || 0}%`;
      gpuLoadBar.style.width = `${Math.min(100, data.GPU.LoadPercent || 0)}%`;
      gpuMemText.textContent = `VRAM: ${data.GPU.MemoryUsedMB} / ${data.GPU.MemoryTotalMB} MB`;
    } else {
      gpuTempText.textContent = '-- °C';
      gpuTempF.textContent = 'Tích hợp Onboard';
      gpuLoadText.textContent = '0%';
    }

    // Disk Temperatures
    const diskTempText = document.getElementById('diskTempText');
    const diskTempSub = document.getElementById('diskTempSub');
    const diskTempBar = document.getElementById('diskTempBar');
    if (data.Disks && data.Disks.length > 0) {
      const firstDisk = data.Disks[0];
      diskTempText.textContent = `${firstDisk.Temperature} °C`;
      diskTempSub.textContent = `${firstDisk.Model} (${data.Disks.length} ổ đĩa)`;
      diskTempBar.style.width = `${Math.min(100, (firstDisk.Temperature / 80) * 100)}%`;
      diskTempBar.style.background = firstDisk.Temperature > 60 ? '#f97316' : '#10b981';
    } else {
      diskTempText.textContent = '35 - 52 °C';
      diskTempSub.textContent = 'Cảm biến NVMe / SATA';
    }

    // Fan Status & Detailed List
    const fanAnim = document.getElementById('fanAnim');
    const fanGpuPercent = document.getElementById('fanGpuPercent');
    const fanGpuStatus = document.getElementById('fanGpuStatus');
    const fanListContainer = document.getElementById('fanListContainer');

    if (data.GPU.FanPercent !== null) {
      fanGpuPercent.textContent = `${data.GPU.FanPercent}%`;
      fanGpuStatus.textContent = data.GPU.FanPercent === 0 ? 'Zero RPM (Nhiệt độ mát, quạt nghỉ)' : `Quạt đang quay tốc độ ${data.GPU.FanPercent}%`;
    }

    if (data.Fans && data.Fans.length > 0) {
      fanListContainer.innerHTML = data.Fans.map(f => `
        <div class="metric-box" style="padding: 12px;">
          <div class="metric-label">${f.Name}</div>
          <div class="metric-value" style="font-size: 18px; color: #38bdf8;">${f.Status || (f.RPM + ' RPM')}</div>
        </div>
      `).join('');

      const anySpinning = data.Fans.some(f => (f.RPM > 0 || (f.Percent && f.Percent > 0)));
      if (anySpinning || cpuLoad > 70) {
        fanAnim.className = 'fan-animation fan-spinning-fast';
      } else if (cpuLoad > 25) {
        fanAnim.className = 'fan-animation fan-spinning';
      } else {
        fanAnim.className = 'fan-animation';
      }
    } else {
      fanListContainer.innerHTML = '';
      if (cpuLoad > 60) fanAnim.className = 'fan-animation fan-spinning-fast';
      else if (cpuLoad > 20) fanAnim.className = 'fan-animation fan-spinning';
      else fanAnim.className = 'fan-animation';
    }

    // Thermal Assessment Message
    const assessEl = document.getElementById('thermalAssessment');
    const maxTemp = Math.max(cpuTemp || 40, data.GPU.TemperatureC || 40);
    if (maxTemp > 85) {
      assessEl.textContent = '⚠️ CẢNH BÁO: Máy tính đang quá nhiệt (>85°C)! Nên vệ sinh quạt tản nhiệt và tra lại keo tản nhiệt (Thermal Paste).';
      assessEl.style.color = '#ef4444';
    } else if (maxTemp > 72) {
      assessEl.textContent = '🟠 Tình trạng: Máy đang tải tác vụ nặng hoặc nhiệt độ hơi ấm (70-85°C), quạt tản nhiệt đang hoạt động bình thường.';
      assessEl.style.color = '#f97316';
    } else if (maxTemp > 50) {
      assessEl.textContent = '🟡 Tình trạng: Nhiệt độ hoàn toàn bình thường khi làm việc / xem phim (50-70°C). Tản nhiệt hoạt động tốt.';
      assessEl.style.color = '#f59e0b';
    } else {
      assessEl.textContent = '🟢 Tình trạng: Máy tính rất mát mẻ (<50°C). Hệ thống làm mát xuất sắc!';
      assessEl.style.color = '#10b981';
    }

  } catch (e) {}
}

function setupStressFanControls() {
  const btn15 = document.getElementById('btnStress15s');
  const btn30 = document.getElementById('btnStress30s');
  const btnStop = document.getElementById('btnStopStress');
  const statusText = document.getElementById('stressStatusText');
  const fanAnim = document.getElementById('fanAnim');

  async function triggerStress(duration) {
    statusText.textContent = `⚡ Đang chạy tải CPU trong ${duration}s... Hãy lắng nghe tiếng quạt tăng tốc!`;
    fanAnim.className = 'fan-animation fan-spinning-fast';

    try {
      await fetch('/api/stress_fan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration })
      });

      let remaining = duration;
      clearInterval(state.activeStressTimer);
      state.activeStressTimer = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          statusText.textContent = `⚡ Đang chạy tải... Còn ${remaining} giây (Nhiệt độ và quạt đang tăng)`;
          loadThermalInfo();
        } else {
          clearInterval(state.activeStressTimer);
          statusText.textContent = '✅ Đã hoàn tất bài kiểm tra tải quạt!';
          fanAnim.className = 'fan-animation fan-spinning';
          setTimeout(loadThermalInfo, 1000);
        }
      }, 1000);
    } catch (e) {
      statusText.textContent = 'Lỗi kích hoạt stress: ' + e;
    }
  }

  btn15.addEventListener('click', () => triggerStress(15));
  btn30.addEventListener('click', () => triggerStress(30));

  btnStop.addEventListener('click', async () => {
    clearInterval(state.activeStressTimer);
    try {
      await fetch('/api/stop_stress', { method: 'POST' });
      statusText.textContent = '🛑 Đã dừng tải kiểm tra quạt.';
      fanAnim.className = 'fan-animation';
      loadThermalInfo();
    } catch (e) {}
  });
}

/* ==============================================================
   8. SYSTEM SPECS MODULE
   ============================================================== */
async function loadSpecsInfo(forceRefresh = false) {
  try {
    const res = await fetch(`/api/specs${forceRefresh ? '?refresh=true' : ''}`);
    const data = await res.json();
    if (!data.Success) return;

    // 1. System & Board
    document.getElementById('specSysBrand').textContent = data.System.Manufacturer;
    document.getElementById('specSysModel').textContent = data.System.Model;
    document.getElementById('specBoardModel').textContent = `${data.Motherboard.Product} (${data.Motherboard.Manufacturer})`;
    document.getElementById('specBoardSerial').textContent = data.Motherboard.SerialNumber || 'N/A';
    document.getElementById('specBiosVersion').textContent = `${data.BIOS.Version} (Phát hành: ${data.BIOS.ReleaseDate})`;

    // 2. CPU
    document.getElementById('specCpuName').textContent = data.CPU.Name;
    document.getElementById('specCpuCores').textContent = `${data.CPU.NumberOfCores} Nhân vật lý (Cores) / ${data.CPU.NumberOfLogicalProcessors} Luồng xử lý (Threads)`;
    document.getElementById('specCpuClock').textContent = `Xung cơ bản: ${data.CPU.MaxClockSpeedMHz} MHz • Bộ nhớ đệm L3: ${Math.round(data.CPU.L3CacheSizeKB / 1024)} MB`;

    // 3. RAM
    document.getElementById('specRamTotal').innerHTML = `<strong style="color:#10b981;">${data.Memory.TotalGB} GB</strong> (${data.Memory.UsedSlots} thanh x ${data.Memory.Sticks[0]?.CapacityGB || 16}GB) • Khả dụng: ${data.Memory.UsableGB} GB`;
    document.getElementById('specRamSlots').textContent = `${data.Memory.UsedSlots} / ${data.Memory.TotalSlots} khe cắm RAM`;
    
    const ramSticksHtml = data.Memory.Sticks.map((s, idx) => `
      <div style="margin-bottom: 6px;">
        • <strong>Khe ${idx + 1} (${s.Slot}):</strong> <span class="tag tag-blue">${s.CapacityGB} GB ${s.Type}</span> @ <strong>${s.SpeedMHz} MHz</strong> — Hãng: <strong>${s.Manufacturer}</strong> ${s.PartNumber ? `[${s.PartNumber}]` : ''} (SN: ${s.SerialNumber || 'N/A'})
      </div>
    `).join('');
    document.getElementById('specRamSticks').innerHTML = ramSticksHtml || 'Không xác định được chi tiết khe cắm';

    // 4. GPUs
    const gpuTable = document.getElementById('specGpuTable');
    gpuTable.innerHTML = '';
    data.GPUs.forEach((g, idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="prop-name">GPU ${idx + 1}</td>
        <td class="prop-val">
          <strong style="color:#38bdf8; font-size:14px;">${g.Name}</strong> • VRAM: <strong style="color:#10b981; font-size:14px;">${g.VRAM_GB} GB</strong> • Driver: ${g.DriverVersion} • Màn hình: ${g.Resolution}
        </td>
      `;
      gpuTable.appendChild(row);
    });

    // 5. Storage
    const storageTable = document.getElementById('specStorageTable');
    storageTable.innerHTML = '';
    
    // Physical disks
    data.Storage.PhysicalDisks.forEach((d, idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="prop-name">Ổ Cứng ${idx + 1} (${d.MediaType})</td>
        <td class="prop-val">
          <span class="tag tag-blue" style="font-size:12px;">${d.CommercialSize || (d.SizeGB + ' GB')}</span> <strong>${d.MediaType} [${d.BusType}]</strong> — Model: <em>${d.Model}</em> (${d.SizeGB} GB khả dụng) • Trạng thái: <span class="tag tag-green">${d.Health}</span>
        </td>
      `;
      storageTable.appendChild(row);
    });

    // Partitions
    const partRow = document.createElement('tr');
    const partList = data.Storage.Partitions.map(p => `<strong>${p.DriveLetter}</strong> (${p.VolumeName} ${p.FileSystem}): Còn trống ${p.FreeGB} GB / ${p.TotalGB} GB`).join(' | ');
    partRow.innerHTML = `
      <td class="prop-name">Phân Vùng Ổ Đĩa</td>
      <td class="prop-val">${partList}</td>
    `;
    storageTable.appendChild(partRow);

    // 6. OS & Network
    document.getElementById('specOsCaption').textContent = `${data.OS.Caption} (${data.OS.OSArchitecture}) - Build ${data.OS.BuildNumber}`;
    
    const netList = data.Network.map(n => `${n.Name} (IP: ${n.IP || 'Chưa cấp'}) [MAC: ${n.MAC}]`).join('<br>');
    document.getElementById('specNetwork').innerHTML = netList || 'Không có kết nối mạng';

  } catch (e) {}
}

document.getElementById('btnRefreshSpecs').addEventListener('click', () => {
  loadSpecsInfo(true);
});

/* ==============================================================
   9. DRIVER BY SERIAL MODULE
   ============================================================== */
async function loadDriverInfo() {
  try {
    const res = await fetch('/api/driver_info');
    const data = await res.json();
    state.driverData = data;

    document.getElementById('driverOemType').textContent = data.OEMType;
    document.getElementById('driverBrandSub').textContent = `Hãng máy: ${data.Brand || 'Chính hãng'} (${data.Model || 'System'})`;

    const serial = data.CleanSerial || data.Serial || 'Không có trong BIOS';
    document.getElementById('driverSerialDisplay').textContent = serial;

    document.getElementById('driverGuideText').innerHTML = `
      <strong>Hướng Dẫn:</strong> ${data.Guide}<br>
      <span style="color: #38bdf8; font-size: 12px; margin-top: 6px; display: inline-block;">
        Đường dẫn hỗ trợ: <a href="${data.DriverURL}" target="_blank" style="color: #38bdf8;">${data.DriverURL}</a>
      </span>
    `;

  } catch (e) {}
}

function setupDriverControls() {
  // Copy Serial Button
  document.getElementById('btnCopySerial').addEventListener('click', () => {
    const serial = document.getElementById('driverSerialDisplay').textContent;
    if (serial && serial !== 'Đang đọc...') {
      navigator.clipboard.writeText(serial).then(() => {
        alert(`Đã sao chép Số Serial: [${serial}] vào bộ nhớ tạm!`);
      });
    }
  });

  // Open Driver URL
  document.getElementById('btnOpenDriverUrl').addEventListener('click', async () => {
    if (state.driverData && state.driverData.DriverURL) {
      await fetch('/api/open_action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'url', url: state.driverData.DriverURL })
      });
    }
  });

  // Quick Action Buttons
  document.getElementById('btnDevMgmt').addEventListener('click', async () => {
    await fetch('/api/open_action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'devmgmt' })
    });
  });

  const openWinUpdate = async () => {
    await fetch('/api/open_action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'winupdate' })
    });
  };

  document.getElementById('btnWinUpdate').addEventListener('click', openWinUpdate);
  document.getElementById('btnOpenWinUpdate2').addEventListener('click', openWinUpdate);

  // Export Report Button
  document.getElementById('btnExportReport').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/export_report', { method: 'POST' });
      const data = await res.json();
      if (data.Success) {
        alert(`✅ Đã xuất báo cáo kiểm tra máy thành công ra Màn hình chính (Desktop)!\n\nĐường dẫn: ${data.FilePath}`);
      } else {
        alert('Lỗi xuất báo cáo: ' + data.Error);
      }
    } catch (e) {
      alert('Lỗi xuất báo cáo: ' + e);
    }
  });
}

/* ==============================================================
   APP INITIALIZATION
   ============================================================== */
window.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initKeyboardTest();
  initLcdTest();
  initSpeakerTest();
  setupMicRecordControls();
  setupCameraControls();
  setupDriverControls();

  // Load initial data
  loadBatteryInfo();
  loadSpecsInfo();
  loadDriverInfo();
});
