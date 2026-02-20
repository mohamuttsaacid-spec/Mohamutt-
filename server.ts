import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";
import Database from "better-sqlite3";

const PORT = 3000;
const db = new Database("footyduel.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS high_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const saveScore = db.prepare("INSERT INTO high_scores (name, score) VALUES (?, ?)");
const getTopScores = db.prepare("SELECT name, score FROM high_scores ORDER BY score DESC LIMIT 10");

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // Game State
  const rooms = new Map<string, {
    players: Map<string, { name: string, score: number, ws: WebSocket }>,
    currentQuestion: any,
    status: 'waiting' | 'playing' | 'finished'
  }>();

  wss.on("connection", (ws) => {
    let currentRoomId: string | null = null;
    let playerId: string | null = null;

    ws.on("message", (message) => {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case "JOIN_ROOM": {
          const { roomId, playerName } = data;
          currentRoomId = roomId;
          playerId = Math.random().toString(36).substring(7);

          if (!rooms.has(roomId)) {
            rooms.set(roomId, {
              players: new Map(),
              currentQuestion: null,
              status: 'waiting'
            });
          }

          const room = rooms.get(roomId)!;
          room.players.set(playerId, { name: playerName, score: 0, ws });

          broadcast(roomId, {
            type: "ROOM_UPDATE",
            players: Array.from(room.players.entries()).map(([id, p]) => ({
              id,
              name: p.name,
              score: p.score
            })),
            status: room.status
          });
          break;
        }

        case "START_GAME": {
          if (currentRoomId && rooms.has(currentRoomId)) {
            const room = rooms.get(currentRoomId)!;
            room.status = 'playing';
            broadcast(currentRoomId, { type: "GAME_STARTED" });
          }
          break;
        }

        case "SUBMIT_ANSWER": {
          if (currentRoomId && playerId && rooms.has(currentRoomId)) {
            const room = rooms.get(currentRoomId)!;
            const player = room.players.get(playerId);
            if (player && data.isCorrect) {
              player.score += 10;
              // Save to global high scores
              try {
                saveScore.run(player.name, player.score);
              } catch (e) {
                console.error("Failed to save score", e);
              }
            }
            broadcast(currentRoomId, {
              type: "ROOM_UPDATE",
              players: Array.from(room.players.entries()).map(([id, p]) => ({
                id,
                name: p.name,
                score: p.score
              })),
              status: room.status
            });
          }
          break;
        }

        case "NEW_QUESTION": {
          if (currentRoomId && rooms.has(currentRoomId)) {
            const room = rooms.get(currentRoomId)!;
            room.currentQuestion = data.question;
            broadcast(currentRoomId, {
              type: "QUESTION_UPDATE",
              question: data.question
            });
          }
          break;
        }
      }
    });

    ws.on("close", () => {
      if (currentRoomId && playerId && rooms.has(currentRoomId)) {
        const room = rooms.get(currentRoomId)!;
        room.players.delete(playerId);
        if (room.players.size === 0) {
          rooms.delete(currentRoomId);
        } else {
          broadcast(currentRoomId, {
            type: "ROOM_UPDATE",
            players: Array.from(room.players.entries()).map(([id, p]) => ({
              id,
              name: p.name,
              score: p.score
            })),
            status: room.status
          });
        }
      }
    });
  });

  function broadcast(roomId: string, message: any) {
    const room = rooms.get(roomId);
    if (room) {
      const payload = JSON.stringify(message);
      room.players.forEach((player) => {
        if (player.ws.readyState === WebSocket.OPEN) {
          player.ws.send(payload);
        }
      });
    }
  }

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/leaderboard", (req, res) => {
    const scores = getTopScores.all();
    res.json(scores);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
