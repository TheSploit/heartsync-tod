const socket = io();

let currentRoom = '';
let currentPlayer = '';
let selectedBody = '🧸';
let userFaceData = null;

// Audio Synthesizer (SFX Alami tanpa file MP3 eksternal)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
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
      userFaceData = e.target.result;
      const previewFace = document.getElementById('preview-face');
      previewFace.src = userFaceData;
      previewFace.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }
}

function renderBoard() {
  const board = document.getElementById('board');
  if (!board) return;
  board.innerHTML = '';

  for (let i = 30; i >= 1; i--) {
    const tile = document.createElement('div');
    tile.id = `tile-${i}`;
    tile.className = `h-12 md:h-16 rounded-xl flex flex-col items-center justify-between p-1 text-[10px] md:text-xs font-bold relative border transition-all`;

    if ([3, 9, 16].includes(i)) {
      tile.classList.add('bg-emerald-100', 'border-emerald-300', 'text-emerald-700');
    } else if ([14, 21, 28].includes(i)) {
      tile.classList.add('bg-amber-100', 'border-amber-300', 'text-amber-700');
    } else if ([5, 8, 12, 19, 23, 27].includes(i)) {
      tile.classList.add('bg-rose-200', 'border-rose-300', 'text-rose-700');
    } else {
      tile.classList.add('bg-white', 'border-rose-100', 'text-gray-500');
    }

    let badge = i;
    if ([3, 9, 16].includes(i)) badge = `${i} 🪜`;
    if ([14, 21, 28].includes(i)) badge = `${i} 🐍`;
    if ([5, 8, 12, 19, 23, 27].includes(i)) badge = `${i} ❓`;

    tile.innerHTML = `<span>${badge}</span><div id="pawns-${i}" class="flex gap-1 z-10 items-center justify-center"></div>`;
    board.appendChild(tile);
  }
}

function updatePawns(players) {
  for (let i = 1; i <= 30; i++) {
    const pawnsContainer = document.getElementById(`pawns-${i}`);
    if (pawnsContainer) pawnsContainer.innerHTML = '';
  }

  players.forEach(p => {
    const pawnsContainer = document.getElementById(`pawns-${p.position}`);
    if (pawnsContainer) {
      const pawnWrapper = document.createElement('div');
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
  });
}

function joinRoom() {
  const nameInput = document.getElementById('username').value.trim();
  const roomInput = document.getElementById('room-id').value.trim().toUpperCase();

  if (roomInput) {
    currentPlayer = nameInput || "Pemain Tanpa Nama";
    currentRoom = roomInput;

    socket.emit('join_room', { 
      roomId: roomInput, 
      playerName: currentPlayer,
      avatarBody: selectedBody,
      avatarFace: userFaceData
    });

    document.getElementById('login-sec').classList.add('hidden');
    document.getElementById('waiting-sec').classList.remove('hidden');
    document.getElementById('waiting-room-code').innerText = roomInput;
  }
}

function rollDice() {
  playSound('dice');
  socket.emit('roll_dice', { roomId: currentRoom, player: currentPlayer });
}

function sendEmoji(emoji) {
  socket.emit('send_emoji', { roomId: currentRoom, emoji: emoji, player: currentPlayer });
}

function closeModal() {
  document.getElementById('event-modal').classList.add('hidden');
}

// Animasi Emoji Melayang
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

socket.on('dice_rolled', (data) => {
  document.getElementById('dice-view').innerText = data.diceValue;
  document.getElementById('dice-result-text').innerText = `${data.player} maju ${data.diceValue} langkah!`;
  document.getElementById('turn-display').innerText = data.turnPlayer;

  const isMyTurn = data.turnPlayer === currentPlayer;
  document.getElementById('roll-btn').disabled = !isMyTurn;

  updatePawns(data.players);

  if (data.eventData) {
    if (data.eventData.type.includes('TANGGA')) playSound('ladder');
    if (data.eventData.type.includes('ULAR')) playSound('snake');

    setTimeout(() => {
      document.getElementById('event-badge').innerText = data.eventData.type;
      document.getElementById('event-title').innerText = data.eventData.title;
      document.getElementById('event-text').innerText = `"${data.eventData.text}"`;
      document.getElementById('event-modal').classList.remove('hidden');
    }, 600);
  }
});

socket.on('room_data', (data) => {
  const playersHtml = data.players.map(p => {
    return p.face 
      ? `<span class="flex items-center gap-1"><img src="${p.face}" class="w-4 h-4 rounded-full object-cover"/> ${p.name}</span>`
      : `<span>${p.body} ${p.name}</span>`;
  }).join(' vs ');

  document.getElementById('players-list').innerHTML = playersHtml || 'Menunggu...';

  if (data.isStarted) {
    document.getElementById('waiting-sec').classList.add('hidden');
    document.getElementById('game-sec').classList.remove('hidden');
    document.getElementById('room-display').innerText = currentRoom;
    renderBoard();

    const turnPlayer = data.players[data.turnIndex].name;
    document.getElementById('turn-display').innerText = turnPlayer;
    document.getElementById('roll-btn').disabled = turnPlayer !== currentPlayer;
    updatePawns(data.players);
  }
});
