const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cards = require('./cards.json');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e8
});

app.use(express.static('public'));

const rooms = {};

const ladders = { 3: 11, 9: 18, 16: 25 };
const snakes = { 14: 4, 21: 10, 28: 12 };
const todTiles = [5, 8, 12, 19, 23, 27];
const memoryTiles = [7, 17, 24];

const vouchers = [
  "Bebas Minta Dimanja Seharian Full! ❤️",
  "Voucher Gratis Di-Gombalin 10 Kali! 😘",
  "Hak Pilih Tempat Makan / Kulineran Pas Ketemu Nanti! 🍕",
  "Bebas Minta Dibelikan Snack / Minuman Favorit! 🧋",
  "Voucher Minta Video Call Kapan Saja Bebas Ditolak! 📞"
];

function getRandomCard(type) {
  const cardList = cards[type.toLowerCase()] || [];
  if (cardList.length === 0) return null;
  return cardList[Math.floor(Math.random() * cardList.length)];
}

// Auto-cleanup background setiap 10 menit
setInterval(() => {
  const now = Date.now();
  for (const roomId in rooms) {
    if (rooms[roomId].players.length === 0 || (now - rooms[roomId].lastActive > 1800000)) {
      delete rooms[roomId];
      console.log(`[Auto-Cleanup] Room ${roomId} dibersihkan dari RAM.`);
    }
  }
}, 600000);

io.on('connection', (socket) => {

  socket.on('join_room', ({ roomId, playerName, avatarBody, avatarFace, memoryPhotos }) => {
    if (!playerName || !playerName.trim() || !roomId || !roomId.trim()) {
      socket.emit('error_message', { message: "Nama dan Kode Room wajib diisi!" });
      return;
    }

    const cleanName = playerName.trim();
    const cleanRoomId = roomId.trim().toUpperCase();

    if (!rooms[cleanRoomId]) {
      rooms[cleanRoomId] = { 
        players: [],
        turnIndex: 0,
        isStarted: false,
        theme: 'rose',
        lastActive: Date.now(),
        photos: [],
        stats: { totalRolls: 0, laddersHit: 0, snakesHit: 0, todHit: 0 }
      };
    }

    const currentRoom = rooms[cleanRoomId];
    currentRoom.lastActive = Date.now();

    // 1. BATASI MAKSIMAL 2 PEMAIN
    const existingPlayer = currentRoom.players.find(p => p.id === socket.id);
    if (!existingPlayer && currentRoom.players.length >= 2) {
      socket.emit('error_message', { 
        message: `Room ${cleanRoomId} sudah penuh (maksimal 2 pemain)! Gunakan kode room lain.` 
      });
      return;
    }

    // 2. CEK AVATAR UNIK
    const requestedBody = avatarBody || '🧸';
    const isAvatarTaken = currentRoom.players.some(p => p.id !== socket.id && p.body === requestedBody);
    if (isAvatarTaken) {
      socket.emit('error_message', { 
        message: `Avatar ${requestedBody} sudah dipakai pasanganmu! Pilih avatar lain ya 😉` 
      });
      return;
    }

    socket.join(cleanRoomId);

    if (memoryPhotos && Array.isArray(memoryPhotos) && memoryPhotos.length > 0) {
      currentRoom.photos = [...currentRoom.photos, ...memoryPhotos];
    }

    if (existingPlayer) {
      existingPlayer.name = cleanName;
      existingPlayer.body = requestedBody;
      existingPlayer.face = avatarFace || null;
    } else {
      currentRoom.players.push({ 
        id: socket.id, 
        name: cleanName,
        position: 1,
        body: requestedBody,
        face: avatarFace || null
      });
    }

    if (currentRoom.players.length >= 2) {
      currentRoom.isStarted = true;
    }

    io.sockets.in(cleanRoomId).emit('room_data', currentRoom);
    io.sockets.in(cleanRoomId).emit('player_status', { type: 'join', name: cleanName });
  });

  socket.on('roll_dice', ({ roomId, player }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.lastActive = Date.now();

    const currentPlayer = room.players[room.turnIndex];
    if (!currentPlayer || currentPlayer.name !== player) return;

    room.stats.totalRolls++;
    const diceValue = Math.floor(Math.random() * 6) + 1;
    let newPos = currentPlayer.position + diceValue;
    if (newPos > 30) newPos = 30;

    let eventData = null;
    let winnerData = null;

    if (newPos === 30) {
      const randomVoucher = vouchers[Math.floor(Math.random() * vouchers.length)];
      winnerData = {
        winnerName: currentPlayer.name,
        voucher: randomVoucher,
        stats: room.stats
      };
    } else if (ladders[newPos]) {
      room.stats.laddersHit++;
      const targetPos = ladders[newPos];
      eventData = {
        targetPlayer: currentPlayer.name,
        type: 'TANGGA 🪜',
        title: `Asik, ${currentPlayer.name} Naik Tangga!`,
        text: `Kamu mendarat di petak ${newPos} dan naik ke petak ${targetPos}! Sebutkan 1 hal manis tentang pasanganmu!`,
        targetPos: targetPos
      };
      newPos = targetPos;
    } else if (snakes[newPos]) {
      room.stats.snakesHit++;
      const targetPos = snakes[newPos];
      eventData = {
        targetPlayer: currentPlayer.name,
        type: 'ULAR 🐍',
        title: `Aduh, ${currentPlayer.name} Dipatok Ular!`,
        text: `Kamu terperosok dari petak ${newPos} ke petak ${targetPos}! Panggil pasanganmu 'Yang Mulia' di giliran selanjutnya.`,
        targetPos: targetPos
      };
      newPos = targetPos;
    } else if (memoryTiles.includes(newPos)) {
      const photoImg = room.photos.length > 0 
        ? room.photos[Math.floor(Math.random() * room.photos.length)] 
        : null;

      eventData = {
        targetPlayer: currentPlayer.name,
        type: 'MEMORY TILE 💖',
        title: `Petak Kenangan Manis!`,
        text: `Momen indah bareng pasangan! Beri kecupan manis atau pelukan hangat via layar sekarang!`,
        photo: photoImg,
        targetPos: newPos
      };
    } else if (todTiles.includes(newPos)) {
      room.stats.todHit++;
      const type = Math.random() < 0.5 ? 'truth' : 'dare';
      const card = getRandomCard(type);
      eventData = {
        targetPlayer: currentPlayer.name,
        type: `PETAK ${type.toUpperCase()} 📜`,
        title: `Tantangan ${type.toUpperCase()} untuk ${currentPlayer.name}!`,
        text: card ? card.text : "Lakukan gombalan manis selama 10 detik!",
        targetPos: newPos,
        isChallenge: true
      };
    }

    currentPlayer.position = newPos;
    room.turnIndex = (room.turnIndex + 1) % room.players.length;

    io.sockets.in(roomId).emit('dice_rolled', {
      player: currentPlayer.name,
      diceValue: diceValue,
      players: room.players,
      turnPlayer: room.players[room.turnIndex].name,
      eventData: eventData,
      winnerData: winnerData
    });
  });

  socket.on('change_theme', ({ roomId, theme }) => {
    if (rooms[roomId]) {
      rooms[roomId].theme = theme;
      io.sockets.in(roomId).emit('theme_updated', { theme });
    }
  });

  socket.on('rematch_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players.forEach(p => p.position = 1);
    room.turnIndex = 0;
    room.isStarted = true;
    room.stats = { totalRolls: 0, laddersHit: 0, snakesHit: 0, todHit: 0 };

    io.sockets.in(roomId).emit('game_reset', {
      players: room.players,
      turnPlayer: room.players[0].name,
      stats: room.stats
    });
  });

  socket.on('toggle_bgm', ({ roomId, isPlaying }) => {
    io.sockets.in(roomId).emit('sync_bgm', { isPlaying });
  });

  socket.on('send_emoji', ({ roomId, emoji, player }) => {
    io.sockets.in(roomId).emit('receive_emoji', { emoji, player });
  });

  socket.on('send_quick_chat', ({ roomId, message, player }) => {
    io.sockets.in(roomId).emit('receive_quick_chat', { message, player });
  });

  socket.on('send_voice', ({ roomId, audioData, player }) => {
    io.sockets.in(roomId).emit('receive_voice', { audioData, player });
  });

  // 3. LOGIKA DISCONNECT & AUTO CLEANUP INSTAN
  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (rooms[roomId]) {
        const room = rooms[roomId];
        const leavingPlayer = room.players.find(p => p.id === socket.id);

        if (leavingPlayer) {
          room.players = room.players.filter(p => p.id !== socket.id);

          io.sockets.in(roomId).emit('player_status', { 
            type: 'disconnect', 
            name: leavingPlayer.name 
          });

          if (room.players.length === 0) {
            delete rooms[roomId];
            console.log(`[Instant-Cleanup] Room ${roomId} dihapus karena semua pemain keluar.`);
          } else {
            room.turnIndex = 0;
            room.isStarted = false;
            io.sockets.in(roomId).emit('room_data', room);
          }
        }
      }
    }
  });

  // --- DEVELOPER DASHBOARD SOCKET HANDLERS (DI DALAM KONEKSI) ---
  socket.on('dev_get_rooms', ({ pin }) => {
    const DEV_PIN = process.env.DEV_PIN || "123456"; 
    if (pin !== DEV_PIN) {
      socket.emit('dev_error', { message: "PIN Developer Salah!" });
      return;
    }

    const roomDetails = [];
    const memoryUsage = process.memoryUsage();

    for (const roomId in rooms) {
      const r = rooms[roomId];
      roomDetails.push({
        roomId: roomId,
        playerCount: r.players.length,
        players: r.players.map(p => ({
          name: p.name,
          position: p.position,
          body: p.body,
          hasFace: !!p.face
        })),
        isStarted: r.isStarted,
        theme: r.theme,
        turnPlayer: r.players[r.turnIndex] ? r.players[r.turnIndex].name : '-',
        photoCount: r.photos ? r.photos.length : 0,
        lastActive: new Date(r.lastActive).toLocaleTimeString('id-ID'),
        stats: r.stats
      });
    }

    socket.emit('dev_rooms_data', {
      totalRooms: Object.keys(rooms).length,
      totalPlayers: roomDetails.reduce((sum, r) => sum + r.playerCount, 0),
      memoryUsageMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
      uptimeSeconds: Math.floor(process.uptime()),
      rooms: roomDetails
    });
  });

  socket.on('dev_force_delete_room', ({ roomId, pin }) => {
    const DEV_PIN = process.env.DEV_PIN || "123456";
    if (pin === DEV_PIN && rooms[roomId]) {
      delete rooms[roomId];
      io.sockets.in(roomId).emit('player_status', { type: 'disconnect', name: 'ADMIN (Room Ditutup)' });
      socket.emit('dev_notice', { message: `Room ${roomId} berhasil dihapus!` });
    }
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server HeartSync Pro berjalan di port ${PORT}`);
});
