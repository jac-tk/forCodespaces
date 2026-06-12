const fs = require("fs");
const path = require("path");
const webpush = require("web-push");

const CSV_PATH = path.join(__dirname, "target_list.csv");
const SUBJECT = process.env.WEBPUSH_SUBJECT || "mailto:example@example.com";
const PUBLIC_KEY = process.env.WEBPUSH_PUBLIC_KEY;
const PRIVATE_KEY = process.env.WEBPUSH_PRIVATE_KEY;

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  values.push(current.trim());
  return values;
}

function loadTargets(csvFilePath) {
  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`CSV file not found: ${csvFilePath}`);
  }

  const raw = fs.readFileSync(csvFilePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const firstRow = parseCsvLine(lines[0]).map((v) => v.toLowerCase());
  const isHeader =
    firstRow.length >= 3 &&
    firstRow[0] === "auth" &&
    firstRow[1] === "vapid" &&
    firstRow[2] === "endpoint";

  const dataLines = isHeader ? lines.slice(1) : lines;

  return dataLines.map((line, idx) => {
    const cols = parseCsvLine(line);
    return {
      rowNumber: idx + (isHeader ? 2 : 1),
      auth: cols[0] || "",
      vapid: cols[1] || "",
      endpoint: cols[2] || "",
    };
  });
}

async function sendAll(message) {
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    throw new Error(
      "WEBPUSH_PUBLIC_KEY and WEBPUSH_PRIVATE_KEY must be set as environment variables"
    );
  }

  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);

  const targets = loadTargets(CSV_PATH);
  if (targets.length === 0) {
    console.log("No targets in target_list.csv");
    return;
  }

  const payload = JSON.stringify({ message });

  for (const target of targets) {
    if (!target.auth || !target.vapid || !target.endpoint) {
      console.warn(
        `Skip row ${target.rowNumber}: auth/vapid/endpoint has empty value`
      );
      continue;
    }

    const subscription = {
      endpoint: target.endpoint,
      keys: {
        auth: target.auth,
        p256dh: target.vapid,
      },
    };

    try {
      const res = await webpush.sendNotification(subscription, payload);
      console.log(`OK row ${target.rowNumber}: ${res.statusCode}`);
    } catch (error) {
      const statusCode = error.statusCode || "unknown";
      const body = error.body ? ` body=${error.body}` : "";
      console.error(`NG row ${target.rowNumber}: ${statusCode}${body}`);
    }
  }
}

async function main() {
  const message = process.argv.slice(2).join(" ").trim();

  if (!message) {
    console.error('Usage: npm run push -- "送りたいメッセージ"');
    process.exit(1);
  }

  try {
    await sendAll(message);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
