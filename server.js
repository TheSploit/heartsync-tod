const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cards = require('./cards.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

// Daftar hukuman acak kalau pemain memilih PASS
const punishments = [
  "Traktir boba / makanan kesukaan lewat GoFood/GrabFood!",
  "Nurutin 1 permintaan pasangan tanpa bantah seharian ini!",
  "Kirim foto muka paling cemberut/konyol sekarang!",
  "Nyanyi lagu favorit pasangan penuh penghayatan di VN/Call!",
  "Puji pasangan setinggi langit selama 1 menit penuh!"
];

function getRandomCard(roomId, type) {
  // Gabungkan kartu bawaan dengan kartu rahasia buatan pemain di room ini
  const defaultCards = cards[type.toLowerCase()] || [];
  const customCards = rooms[roomId]?.customCards?.[type.toLowerCase()] || [];
  const allCards = [...defaultCards, ...customCards];

  if (allCards.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * allCards.length);
  return allCards[randomIndex];
}

io.on('connection', (socket) => {
  socket.on('join_room', ({ roomId, playerName }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { 
        players: [],
        customCards: { truth: [], dare: [] }
      };
    }

    rooms[roomId].players.push({ id: socket.id, name: playerName });
    io.to(roomId).emit('room_data', rooms[roomId]);
  });

  socket.on('draw_card', ({ roomId, player, type }) => {
    const selectedCard = getRandomCard(roomId, type);

    if (selectedCard) {
      const payload = {
        player: player,
        type: type.toUpperCase(),
        category: selectedCard.category || "Kartu Rahasia",
        text: selectedCard.text
      };

      io.to(roomId).emit('card_drawn', payload);
    }
  });

  // Event saat pemain klik tombol PASS
  socket.on('pass_action', ({ roomId, player }) => {
    const randomPunishment = punishments[Math.floor(Math.random() * punishments.length)];
    const payload = {
      player: player,
      type: "HUKUMAN / PASS 🙈",
      category: "Kena Hukuman!",
      text: randomPunishment
    };
    io.to(roomId).emit('card_drawn', payload);
  });

  // Event menambah kartu rahasia buatan sendiri
  socket.on('add_custom_card', ({ roomId, type, text, author }) => {
    if (rooms[roomId]) {
      rooms[roomId].customCards[type].push({
        id: Date.now(),
        category: `Rahasia dari ${author}`,
        text: text
      });
      io.to(roomId).emit('custom_card_added', { author });
    }
  });

  socket.on('disconnect', () => {
    console.log('User terputus:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server HeartSync berjalan di http://localhost:${PORT}`);
});