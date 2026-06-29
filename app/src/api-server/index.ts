// Catch unhandled errors to prevent silent crashes
process.on("unhandledRejection", (err) => {
  console.error("[API] Unhandled rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("[API] Uncaught exception:", err);
  setTimeout(() => process.exit(1), 1000);
});

import("./server.js").then(({ startServer }) => startServer());
