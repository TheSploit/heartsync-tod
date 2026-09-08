function joinRoom() {
  const nameInput = document.getElementById('username').value.trim();
  const roomInput = document.getElementById('room-id').value.trim().toUpperCase();

  // Validasi Wajib Isi Nama
  if (!nameInput) {
    showNotice("Isi nama panggilan manismu dulu ya! 💕");
    document.getElementById('username').focus();
    return;
  }

  // Validasi Wajib Isi Kode Room
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
