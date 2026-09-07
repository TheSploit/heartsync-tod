const socket = io();

let currentRoom = '';
let currentPlayer = '';

function joinRoom() {
  const name = document.getElementById('username').value.trim();
  const room = document.getElementById('room-id').value.trim().toUpperCase();

  if (name && room) {
    currentPlayer = name;
    currentRoom = room;

    socket.emit('join_room', { roomId: room, playerName: name });

    document.getElementById('login-sec').classList.add('hidden');
    document.getElementById('game-sec').classList.remove('hidden');
    document.getElementById('room-display').innerText = room;
  }
}

function sendChoice(type) {
  socket.emit('draw_card', {
    roomId: currentRoom,
    player: currentPlayer,
    type: type
  });
}

function triggerPass() {
  socket.emit('pass_action', {
    roomId: currentRoom,
    player: currentPlayer
  });
}

function toggleCustomForm() {
  const form = document.getElementById('custom-form');
  form.classList.toggle('hidden');
}

function addCustomCard() {
  const type = document.getElementById('custom-type').value;
  const text = document.getElementById('custom-text').value.trim();

  if (text) {
    socket.emit('add_custom_card', {
      roomId: currentRoom,
      type: type,
      text: text,
      author: currentPlayer
    });
    document.getElementById('custom-text').value = '';
    toggleCustomForm();
  }
}

socket.on('card_drawn', (data) => {
  const cardBox = document.getElementById('card-box');
  
  cardBox.classList.remove('card-shake');
  void cardBox.offsetWidth;
  cardBox.classList.add('card-shake');

  document.getElementById('card-category').innerText = `[${data.category}]`;
  document.getElementById('card-title').innerText = `${data.player} (${data.type})`;
  document.getElementById('card-text').innerText = `"${data.text}"`;
  document.getElementById('card-player').innerText = `Status: ${data.player}`;
});

socket.on('custom_card_added', (data) => {
  alert(`Kartu rahasia dari ${data.author} berhasil ditambahkan ke dalam game! 🤫`);
});

socket.on('room_data', (data) => {
  const players = data.players.map(p => p.name).join(' & ');
  document.getElementById('players-list').innerText = players || 'Menunggu...';
});