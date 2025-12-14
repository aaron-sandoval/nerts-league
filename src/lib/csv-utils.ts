import type { Doc } from "../../convex/_generated/dataModel";

interface ExportData {
  users: Array<{ name: string; gamertag: string; _id: string }>;
  sessions: Array<Doc<"sessions">>;
  games: Array<Doc<"games">>;
}

export function generateCSV(data: ExportData): string {
  const lines: string[] = [];

  // Section 1: PLAYERS
  lines.push("PLAYERS");
  lines.push("name,gamertag");

  for (const user of data.users) {
    lines.push(`"${escapeCsvValue(user.name)}","${escapeCsvValue(user.gamertag)}"`);
  }

  lines.push("");

  // Section 2: SESSIONS
  lines.push("SESSIONS");
  lines.push("sessionId,name,date,isRanked,isPublic,notes,rules");

  for (const session of data.sessions) {
    const sessionId = session._id;
    const name = session.name || "";
    const date = session.date;
    const isRanked = session.isRanked;
    const isPublic = session.isPublic;
    const notes = session.notes || "";
    const rules = session.rules;

    lines.push(
      `"${escapeCsvValue(sessionId)}","${escapeCsvValue(name)}",${date},${isRanked},${isPublic},"${escapeCsvValue(notes)}","${escapeCsvValue(rules)}"`
    );
  }

  lines.push("");

  // Section 3: GAMES
  lines.push("GAMES");
  lines.push("sessionId,gameNumber,date,playerScores,nertsPlayerGamertag,winnerGamertag");

  // Create a map of userId -> gamertag
  const userIdToGamertag = new Map(
    data.users.map(u => [u._id, u.gamertag])
  );

  for (const game of data.games) {
    if (!game.sessionId) continue;

    const sessionId = game.sessionId;
    const gameNumber = game.gameNumber || 1;
    const date = game.date;

    // Encode playerScores as gamertag:score:handicap;gamertag:score:handicap
    const scoresStr = game.playerScores
      .map(ps => {
        const gamertag = userIdToGamertag.get(ps.playerId) || "unknown";
        return `${gamertag}:${ps.score}:${ps.handicap || 0}`;
      })
      .join(";");

    const nertsGamertag = game.nertsPlayerId
      ? userIdToGamertag.get(game.nertsPlayerId) || ""
      : "";

    const winnerGamertag = game.winnerId
      ? userIdToGamertag.get(game.winnerId) || ""
      : "";

    lines.push(
      `"${escapeCsvValue(sessionId)}",${gameNumber},${date},"${escapeCsvValue(scoresStr)}","${escapeCsvValue(nertsGamertag)}","${escapeCsvValue(winnerGamertag)}"`
    );
  }

  return lines.join("\n");
}

export interface ParsedImportData {
  users: Array<{ name: string; gamertag: string }>;
  sessions: Array<{
    sessionId: string;
    name?: string;
    date: number;
    isRanked: boolean;
    isPublic: boolean;
    notes?: string;
    rules: string;
  }>;
  games: Array<{
    sessionId: string;
    gameNumber: number;
    date: number;
    playerScores: Array<{
      gamertag: string;
      score: number;
      handicap: number;
    }>;
    nertsPlayerGamertag?: string;
    winnerGamertag?: string;
  }>;
}

export function parseCSV(csvContent: string): ParsedImportData {
  const lines = csvContent.split("\n").map(line => line.trim()).filter(line => line);

  const result: ParsedImportData = {
    users: [],
    sessions: [],
    games: [],
  };

  let currentSection: "players" | "sessions" | "games" | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === "PLAYERS") {
      currentSection = "players";
      i++; // Skip header line
      continue;
    }

    if (line === "SESSIONS") {
      currentSection = "sessions";
      i++; // Skip header line
      continue;
    }

    if (line === "GAMES") {
      currentSection = "games";
      i++; // Skip header line
      continue;
    }

    if (!currentSection) continue;

    const values = parseCsvLine(line);

    if (currentSection === "players") {
      if (values.length >= 2) {
        result.users.push({
          name: values[0],
          gamertag: values[1],
        });
      }
    } else if (currentSection === "sessions") {
      if (values.length >= 7) {
        result.sessions.push({
          sessionId: values[0],
          name: values[1] || undefined,
          date: parseInt(values[2]),
          isRanked: values[3] === "true",
          isPublic: values[4] === "true",
          notes: values[5] || undefined,
          rules: values[6],
        });
      }
    } else if (currentSection === "games") {
      if (values.length >= 6) {
        // Parse playerScores from "gamertag:score:handicap;gamertag:score:handicap"
        const playerScores = values[3]
          .split(";")
          .filter(s => s)
          .map(scoreStr => {
            const [gamertag, score, handicap] = scoreStr.split(":");
            return {
              gamertag,
              score: parseFloat(score),
              handicap: parseFloat(handicap),
            };
          });

        result.games.push({
          sessionId: values[0],
          gameNumber: parseInt(values[1]),
          date: parseInt(values[2]),
          playerScores,
          nertsPlayerGamertag: values[4] || undefined,
          winnerGamertag: values[5] || undefined,
        });
      }
    }
  }

  return result;
}

function escapeCsvValue(value: string): string {
  return value.replace(/"/g, '""');
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
