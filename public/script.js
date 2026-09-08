const socket = io({
  transports: ['websocket', 'polling']
});

let currentRoom = '';
let currentPlayer = '';
let currentTurnPlayer = '';
let selectedBody = '🧸';
let userFaceData = null;
let uploadedMemoryPhotos = [];
let isHost = false;
let isBGMPlaying = false;
let isSFXEnabled = true;
let bgmInterval = null;
let playerPositions = {};

let mediaRecorder = null;
let audioChunks = [];
let recordTimeout = null;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    const roomInput = document.getElementById('room-id');
    if (roomInput) {
      roomInput.value = roomParam.toUpperCase();
    }
  }

  setupVoiceRecorder();
});

function closeHint(hintId) {
  const el = document.getElementById(hintId);
  if (el) {
    el.classList.replace('animate__bounceIn', 'animate__fadeOut');
    setTimeout(() => el.remove(), 300);
  }
}

function copyInviteLink() {
  if (!currentRoom) return;
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoom}`;
  
  navigator.clipboard.writeText(inviteUrl).then(() => {
    showNotice(`Link Undangan (${currentRoom}) Berhasil Disalin! 💕`);
  }).catch(() => {
    showNotice(`Kode Room: ${currentRoom}`);
  });
}

function toggleSFX() {
  isSFXEnabled = !isSFXEnabled;
  const sfxIcon = document.getElementById('sfx-icon');
  if (isSFXEnabled) {
    sfxIcon.className = "fa-solid fa-volume-high text-rose-600";
    showNotice("Efek Suara (SFX) Menyala 🔊");
  } else {
    sfxIcon.className = "fa-solid fa-volume-xmark text-gray-400";
    showNotice("Efek Suara (SFX) Dimatikan 🔇");
  }
}

function toggleBGM() {
  if (!isHost) {
    showNotice("Hanya Room Master yang bisa mengatur musik latar! 🎵");
    return;
  }

  const newStatus = !isBGMPlaying;
  socket.emit('toggle_bgm', { roomId: currentRoom, isPlaying: newStatus });
}

function playBGMNotes() {
  if (!isBGMPlaying) return;
  const notes = [261.63, 329.63, 392.00, 523.25, 440.00, 349.23, 329.63, 293.66];
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      if (!isBGMPlaying) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    }, idx * 900);
  });
}

function playSound(type) {
  if (!isSFXEnabled) return;

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'dice') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } else if (type === 'ladder') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } else if (type === 'snake') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } else if (type === 'win') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } else if (type === 'warning') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.setValueAtTime(100, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  }
}

function setupVoiceRecorder() {
  const btn = document.getElementById('record-voice-btn');
  const txt = document.getElementById('record-text');
  if (!btn) return;

  const startRecording = async (e) => {
    e.preventDefault();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          socket.emit('send_voice', {
            roomId: currentRoom,
            audioData: reader.result,
            player: currentPlayer
          });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      txt.innerText = "Merekam... Lepas untuk Kirim 🔴";
      btn.classList.add('bg-red-600', 'animate-pulse');

      recordTimeout = setTimeout(() => {
        stopRecording();
      }, 20500);

    } catch (err) {
      showNotice("Izinkan akses mikrofon browser untuk kirim suara!");
    }
  };

  const stopRecording = (e) => {
    if (e) e.preventDefault();
    if (recordTimeout) clearTimeout(recordTimeout);

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      txt.innerText = "Tahan untuk Rekam Voice (20s)";
      btn.classList.remove('bg-red-600', 'animate-pulse');
    }
  };

  btn.addEventListener('mousedown', startRecording);
  btn.addEventListener('mouseup', stopRecording);
  btn.addEventListener('touchstart', startRecording);
  btn.addEventListener('touchend', stopRecording);
}

function changeTheme(themeName) {
  if (!isHost) {
    showNotice("Hanya Room Master yang bisa mengubah tema! 🎨");
    return;
  }
  socket.emit('change_theme', { roomId: currentRoom, theme: themeName });
}

function applyTheme(themeName) {
  const body = document.getElementById('app-body');
  const board = document.getElementById('board');

  if (themeName === 'midnight') {
    body.className = "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white min-h-screen flex items-center justify-center p-3 md:p-8 relative overflow-x-hidden transition-all duration-500 select-none";
    board.className = "md:col-span-3 grid grid-cols-5 gap-2 md:gap-3 p-3 md:p-4 bg-indigo-950/80 rounded-2xl border-2 border-indigo-700 relative";
  } else if (themeName === 'sunset') {
    body.className = "bg-gradient-to-br from-amber-100 via-orange-100 to-rose-200 min-h-screen flex items-center justify-center p-3 md:p-8 relative overflow-x-hidden transition-all duration-500 select-none";
    board.className = "md:col-span-3 grid grid-cols-5 gap-2 md:gap-3 p-3 md:p-4 bg-amber-100/80 rounded-2xl border-2 border-amber-300 relative";
  } else {
    body.className = "bg-gradient-to-br from-rose-100 via-pink-50 to-rose-200 min-h-screen flex items-center justify-center p-3 md:p-8 relative overflow-x-hidden transition-all duration-500 select-none";
    board.className = "md:col-span-3 grid grid-cols-5 gap-2 md:gap-3 p-3 md:p-4 bg-rose-100/60 rounded-2xl border-2 border-rose-200 relative";
  }
}

function selectBody(bodyEmoji) {
  selectedBody = bodyEmoji;
  document.getElementById('preview-body').innerText = bodyEmoji;
}

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 100;
        canvas.height = 100;
        ctx.drawImage(img, 0, 0, 100, 100);
        
        userFaceData = canvas.toDataURL('image/jpeg', 0.6);
        
        const previewFace = document.getElementById('preview-face');
        previewFace.src = userFaceData;
        previewFace.classList.remove('hidden');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function handleMemoryPhotosUpload(event) {
  const files = Array.from(event.target.files).slice(0, 3);
  uploadedMemoryPhotos = [];
  const previewContainer = document.getElementById('memory-preview-container');
  previewContainer.innerHTML = '';

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 300;
        canvas.height = 300;
        ctx.drawImage(img, 0, 0, 300, 300);
        
        const compressedData = canvas.toDataURL('image/jpeg', 0.6);
        uploadedMemoryPhotos.push(compressedData);

        const imgEl = document.createElement('img');
        imgEl.src = compressedData;
        imgEl.className = 'w-12 h-12 rounded-lg object-cover border border-purple-300 shadow-sm';
        previewContainer.appendChild(imgEl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function saveVoucherToWallet(voucherText) {
  let wallet = JSON.parse(localStorage.getItem('heartsync_vouchers') || '[]');
  const newVoucher = {
    id: Date.now(),
    text: voucherText,
    date: new Date().toLocaleDateString('id-ID')
  };
  wallet.unshift(newVoucher);
  localStorage.setItem('heartsync_vouchers', JSON.stringify(wallet));
}

function openVoucherWallet() {
  let wallet = JSON.parse(localStorage.getItem('heartsync_vouchers') || '[]');
  const walletList = document.getElementById('wallet-list');
  walletList.innerHTML = '';

  if (wallet.length === 0) {
    walletList.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Belum ada voucher yang didapatkan. Menangkan game untuk mengklaim voucher!</p>`;
  } else {
    wallet.forEach(item => {
      const card = document.createElement('div');
      card.className = 'bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-left text-xs space-y-1';
      card.innerHTML = `
        <div class="flex justify-between items-center text-[10px] text-amber-600 font-bold">
          <span>VOUCHER KHUSUS</span>
          <span>${item.date}</span>
        </div>
        <p class="font-bold text-amber-900 italic">"${item.text}"</p>
      `;
      walletList.appendChild(card);
    });
  }

  document.getElementById('wallet-modal').classList.remove('hidden');
}

function closeWalletModal() {
  document.getElementById('wallet-modal').classList.add('hidden');
}

function showNotice(text) {
  playSound('warning');
  const existingNotice = document.getElementById('turn-notice');
  if (existingNotice) existingNotice.remove();

  const notice = document.createElement('div');
  notice.id = 'turn-notice';
  notice.className = 'fixed top-12 left-1/2 -translate-x-1/2 bg-rose-500 text-white font-extrabold text-xs md:text-sm px-6 py-3 rounded-full shadow-2xl z-50 animate__animated animate__bounceIn flex items-center gap-2 border-2 border-white';
  notice.innerHTML = `<span>💌</span> <span>${text}</span>`;

  document.body.appendChild(notice);

  setTimeout(() => {
    notice.classList.replace('animate__bounceIn', 'animate__bounceOut');
    setTimeout(() => notice.remove(), 500);
  }, 2500);
}

function renderBoard() {
  const board = document.getElementById('board');
  if (!board) return;
  board.innerHTML = '';

  for (let i = 30; i >= 1; i--) {
    const tile = document.createElement('div');
    tile.id = `tile-${i}`;
    tile.className = `h-12 md:h-16 rounded-xl flex flex-col items-center justify-between p-1 text-[10px] md:text-xs font-bold relative border transition-all`;

    if (i === 30) {
      tile.classList.add('bg-amber-200', 'border-amber-400', 'text-amber-800');
    } else if ([3, 9, 16].includes(i)) {
      tile.classList.add('bg-emerald-100', 'border-emerald-300', 'text-emerald-700');
    } else if ([14, 21, 28].includes(i)) {
      tile.classList.add('bg-amber-100', 'border-amber-300', 'text-amber-700');
    } else if ([7, 17, 24].includes(i)) {
      tile.classList.add('bg-purple-200', 'border-purple-300', 'text-purple-700');
    } else if ([5, 8, 12, 19, 23, 27].includes(i)) {
      tile.classList.add('bg-rose-200', 'border-rose-300', 'text-rose-700');
    } else {
      tile.classList.add('bg-white', 'border-rose-100', 'text-gray-500');
    }

    let badge = i;
    if (i === 30) badge = `FINISH 👑`;
    if ([3, 9, 16].includes(i)) badge = `${i} 🪜`;
    if ([14, 21, 28].includes(i)) badge = `${i} 🐍`;
    if ([7, 17, 24].includes(i)) badge = `${i} 💖`;
    if ([5, 8, 12, 19, 23, 27].includes(i)) badge = `${i} ❓`;

    tile.innerHTML = `<span>${badge}</span><div id="pawns-${i}" class="flex gap-1 z-10 items-center justify-center"></div>`;
    board.appendChild(tile);
  }
}

function updatePawnsAnimated(players) {
  players.forEach(p => {
    const oldPos = playerPositions[p.name] || 1;
    const newPos = p.position;

    if (oldPos !== newPos) {
      let step = oldPos;
      const stepInterval = setInterval(() => {
        if (oldPos < newPos) step++;
        else step--;

        renderSinglePawn(p, step);

        if (step === newPos) {
          clearInterval(stepInterval);
          playerPositions[p.name] = newPos;
        }
      }, 250);
    } else {
      renderSinglePawn(p, newPos);
    }
  });
}

function renderSinglePawn(p, pos) {
  for (let i = 1; i <= 30; i++) {
    const container = document.getElementById(`pawns-${i}`);
    if (container) {
      const existing = container.querySelector(`[data-player="${p.name}"]`);
      if (existing) existing.remove();
    }
  }

  const pawnsContainer = document.getElementById(`pawns-${pos}`);
  if (pawnsContainer) {
    const pawnWrapper = document.createElement('div');
    pawnWrapper.setAttribute('data-player', p.name);
    pawnWrapper.className = `relative flex items-center justify-center animate__animated animate__bounceIn`;
    pawnWrapper.title = p.name;

    if (p.face) {
      pawnWrapper.innerHTML = `
        <div class="relative w-7 h-7 md:w-9 md:h-9 flex items-center justify-center">
          <span class="text-lg md:text-2xl">${p.body}</span>
          <img src="${p.face}" class="absolute -top-1 w-4 h-4 md:w-5 md:h-5 rounded-full border border-white object-cover shadow-sm" />
        </div>
      `;
    } else {
      pawnWrapper.innerHTML = `<span class="text-base md:text-xl">${p.body}</span>`;
    }

    pawnsContainer.appendChild(pawnWrapper);
  }
}

function joinRoom() {
  const nameInput = document.getElementById('username').value.trim();
  const roomInput = document.getElementById('room-id').value.trim().toUpperCase();

  if (!nameInput) {
    showNotice("Isi nama panggilan manismu dulu ya! 💕");
    document.getElementById('username').focus();
    return;
  }

  if (!roomInput) {
    showNotice("Isi kode room dulu ya! 🔑");
    document.getElementById('room-id').focus();
    return;
  }

  currentPlayer = nameInput;
  currentRoom = roomInput;

  socket.emit('join_room', { 
    roomId: roomInput, 
    playerName: currentPlayer,
    avatarBody: selectedBody,
    avatarFace: userFaceData,
    memoryPhotos: uploadedMemoryPhotos
  });
}

function rollDice() {
  if (currentTurnPlayer && currentTurnPlayer !== currentPlayer) {
    const messages = [
      `Eits, sabar ya manis! Lagi giliran ${currentTurnPlayer} nih~ 😘`,
      `Jangan curang dong! Tunggu ${currentTurnPlayer} lempar dadu dulu 😜`,
      `Sabar ya sayang! Gantian dulu sama ${currentTurnPlayer} 💕`
    ];
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];
    showNotice(randomMsg);
    return;
  }

  playSound('dice');
  socket.emit('roll_dice', { roomId: currentRoom, player: currentPlayer });
}

function requestRematch() {
  document.getElementById('victory-modal').classList.add('hidden');
  socket.emit('rematch_game', { roomId: currentRoom });
}

function sendEmoji(emoji) {
  socket.emit('send_emoji', { roomId: currentRoom, emoji: emoji, player: currentPlayer });
}

function sendQuickChat(msg) {
  socket.emit('send_quick_chat', { roomId: currentRoom, message: msg, player: currentPlayer });
}

function closeModal() {
  document.getElementById('event-modal').classList.add('hidden');
}

socket.on('receive_voice', (data) => {
  const audio = new Audio(data.audioData);
  audio.play().catch(() => {});

  const container = document.getElementById('emoji-container');
  const el = document.createElement('div');
  el.className = 'fixed bg-pink-500 text-white font-extrabold text-xs px-4 py-2 rounded-2xl shadow-xl animate__animated animate__bounceInUp flex items-center gap-2 border-2 border-white';
  el.style.left = `${Math.random() * 60 + 20}%`;
  el.style.bottom = '30%';
  el.innerHTML = `<i class="fa-solid fa-volume-high animate-bounce"></i> <span>${data.player} mengirim pesan suara!</span>`;

  container.appendChild(el);
  setTimeout(() => {
    el.classList.replace('animate__bounceInUp', 'animate__fadeOutUp');
    setTimeout(() => el.remove(), 500);
  }, 3500);
});

socket.on('theme_updated', (data) => {
  applyTheme(data.theme);
});

socket.on('error_message', (data) => {
  showNotice(data.message);
});

socket.on('receive_emoji', (data) => {
  const container = document.getElementById('emoji-container');
  const el = document.createElement('div');
  el.className = 'fixed text-4xl animate__animated animate__fadeOutUp';
  el.style.left = `${Math.random() * 80 + 10}%`;
  el.style.bottom = '20%';
  el.style.animationDuration = '2s';
  el.innerText = data.emoji;

  container.appendChild(el);
  setTimeout(() => el.remove(), 2000);
});

socket.on('receive_quick_chat', (data) => {
  const container = document.getElementById('emoji-container');
  const el = document.createElement('div');
  el.className = 'fixed bg-white/95 border-2 border-rose-300 text-rose-600 font-extrabold text-xs px-4 py-2 rounded-2xl shadow-xl animate__animated animate__bounceInUp';
  el.style.left = `${Math.random() * 60 + 20}%`;
  el.style.bottom = '30%';
  el.innerHTML = `<span>${data.player}:</span> "${data.message}"`;

  container.appendChild(el);
  setTimeout(() => {
    el.classList.replace('animate__bounceInUp', 'animate__fadeOutUp');
    setTimeout(() => el.remove(), 500);
  }, 2500);
});

socket.on('dice_rolled', (data) => {
  document.getElementById('dice-view').innerText = data.diceValue;
  document.getElementById('dice-result-text').innerText = `${data.player} maju ${data.diceValue} langkah!`;
  document.getElementById('turn-display').innerText = data.turnPlayer;

  currentTurnPlayer = data.turnPlayer;

  updatePawnsAnimated(data.players);

  if (data.winnerData) {
    playSound('win');
    saveVoucherToWallet(data.winnerData.voucher);

    if (typeof confetti === 'function') {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    setTimeout(() => {
      document.getElementById('winner-text').innerText = `${data.winnerData.winnerName} Berhasil Mencapai Petak 30 & Menang! 🎉`;
      document.getElementById('voucher-text').innerText = `"${data.winnerData.voucher}"`;
      
      if (data.winnerData.stats) {
        document.getElementById('stat-rolls').innerText = data.winnerData.stats.totalRolls;
        document.getElementById('stat-ladders').innerText = data.winnerData.stats.laddersHit;
        document.getElementById('stat-snakes').innerText = data.winnerData.stats.snakesHit;
        document.getElementById('stat-tod').innerText = data.winnerData.stats.todHit;
      }

      document.getElementById('victory-modal').classList.remove('hidden');
    }, 1500);
  } else if (data.eventData) {
    if (data.eventData.type.includes('TANGGA')) playSound('ladder');
    if (data.eventData.type.includes('ULAR')) playSound('snake');

    setTimeout(() => {
      document.getElementById('event-badge').innerText = `${data.eventData.type} (${data.eventData.targetPlayer})`;
      document.getElementById('event-title').innerText = data.eventData.title;
      document.getElementById('event-text').innerText = `"${data.eventData.text}"`;
      
      const photoContainer = document.getElementById('event-photo-container');
      const photoImg = document.getElementById('event-photo');

      if (data.eventData.photo) {
        photoImg.src = data.eventData.photo;
        photoContainer.classList.remove('hidden');
      } else {
        photoContainer.classList.add('hidden');
      }

      const closeBtn = document.getElementById('close-event-btn');
      if (data.eventData.isChallenge) {
        closeBtn.innerText = "Sudah Dikerjakan! ✅";
      } else {
        closeBtn.innerText = "Lanjutkan Permainan";
      }

      document.getElementById('event-modal').classList.remove('hidden');
    }, 1500);
  }
});

socket.on('game_reset', (data) => {
  document.getElementById('victory-modal').classList.add('hidden');
  document.getElementById('event-modal').classList.add('hidden');

  showNotice("Permainan Diulang Kembali ke Petak 1! 🔄");

  currentTurnPlayer = data.turnPlayer;
  document.getElementById('turn-display').innerText = currentTurnPlayer;
  document.getElementById('dice-view').innerText = '🎲';
  document.getElementById('dice-result-text').innerText = 'Gilirannya dimainkan!';

  playerPositions = {};
  updatePawnsAnimated(data.players);
});

socket.on('sync_bgm', (data) => {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const bgmIcon = document.getElementById('bgm-icon');
  isBGMPlaying = data.isPlaying;

  if (isBGMPlaying) {
    bgmIcon.className = "fa-solid fa-music text-rose-600 animate-spin";
    playBGMNotes();
    if (bgmInterval) clearInterval(bgmInterval);
    bgmInterval = setInterval(playBGMNotes, 8000);
  } else {
    if (bgmInterval) clearInterval(bgmInterval);
    bgmIcon.className = "fa-solid fa-music-slash";
  }
});

socket.on('player_status', (data) => {
  if (data.type === 'disconnect' && data.name !== currentPlayer) {
    showNotice(`⚠️ ${data.name} terputus dari jaringan/menutup game!`);
  }
});

socket.on('room_data', (data) => {
  if (data.players.length > 0 && data.players[0].name === currentPlayer) {
    isHost = true;
    document.getElementById('theme-selector').classList.remove('hidden');
  }

  document.getElementById('login-sec').classList.add('hidden');

  const playersHtml = data.players.map(p => {
    return p.face 
      ? `<span class="flex items-center gap-1"><img src="${p.face}" class="w-4 h-4 rounded-full object-cover"/> ${p.name}</span>`
      : `<span>${p.body} ${p.name}</span>`;
  }).join(' vs ');

  document.getElementById('players-list').innerHTML = playersHtml || 'Menunggu...';

  if (data.theme) {
    applyTheme(data.theme);
  }

  if (data.players.length >= 2 || data.isStarted) {
    document.getElementById('waiting-sec').classList.add('hidden');
    document.getElementById('game-sec').classList.remove('hidden');
    document.getElementById('room-display').innerText = currentRoom;
    renderBoard();

    currentTurnPlayer = data.players[data.turnIndex].name;
    document.getElementById('turn-display').innerText = currentTurnPlayer;
    updatePawnsAnimated(data.players);
  } else {
    document.getElementById('waiting-sec').classList.remove('hidden');
    document.getElementById('waiting-room-code').innerText = currentRoom;
  }
});
