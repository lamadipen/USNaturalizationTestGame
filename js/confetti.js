// Tiny dependency-free confetti burst.
function fireConfetti(rootEl) {
  const container = document.createElement("div");
  container.className = "confetti-container";
  (rootEl || document.body).appendChild(container);

  const colors = ["#B22234", "#FFFFFF", "#3C3B6E", "#FFD700"];
  const pieceCount = 80;

  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 0.4 + "s";
    piece.style.animationDuration = 2 + Math.random() * 1.5 + "s";
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 3500);
}
