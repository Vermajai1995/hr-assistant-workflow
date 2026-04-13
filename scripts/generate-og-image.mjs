import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const outputPath = path.join(publicDir, "og-image.png");
const logoPath = path.join(publicDir, "logo.png");

const width = 1200;
const height = 630;

mkdirSync(publicDir, { recursive: true });

const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");

ctx.fillStyle = "#f8fbff";
ctx.fillRect(0, 0, width, height);

const gradient = ctx.createLinearGradient(0, 0, width, height);
gradient.addColorStop(0, "rgba(10,102,194,0.14)");
gradient.addColorStop(1, "rgba(76,155,232,0.03)");
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);

ctx.fillStyle = "#d9e8f8";
ctx.beginPath();
ctx.arc(1080, 60, 180, 0, Math.PI * 2);
ctx.fill();

ctx.fillStyle = "#ffffff";
roundRect(ctx, 64, 58, 1072, 514, 36);
ctx.fill();

ctx.strokeStyle = "rgba(15,23,42,0.08)";
ctx.lineWidth = 2;
roundRect(ctx, 64, 58, 1072, 514, 36);
ctx.stroke();

ctx.fillStyle = "#ffffff";
roundRect(ctx, 100, 96, 1000, 74, 22);
ctx.fill();
ctx.strokeStyle = "rgba(15,23,42,0.07)";
ctx.stroke();

const logo = await loadImage(logoPath);
ctx.save();
roundRect(ctx, 130, 111, 42, 42, 12);
ctx.clip();
ctx.drawImage(logo, 130, 111, 42, 42);
ctx.restore();

ctx.fillStyle = "#111827";
ctx.font = "700 28px Arial";
ctx.fillText("HireFlow", 188, 139);

ctx.fillStyle = "#5f6b7a";
ctx.font = "400 18px Arial";
ctx.fillText("AI HR Requirement Extractor", 188, 163);

ctx.fillStyle = "#0a66c2";
ctx.font = "700 16px Arial";
ctx.fillText("STRUCTURE HIRING CALLS IN SECONDS", 118, 236);

ctx.fillStyle = "#0f172a";
ctx.font = "700 52px Arial";
ctx.fillText("HireFlow", 116, 298);

ctx.fillStyle = "#475467";
ctx.font = "400 24px Arial";
wrapText(
  ctx,
  "Paste or record hiring conversations and instantly generate HR briefs, job descriptions, polished emails, and WhatsApp-ready summaries.",
  118,
  344,
  500,
  34
);

drawPill(ctx, 118, 464, 170, 46, "#e8f1fb", "#0a66c2", "HR Brief");
drawPill(ctx, 302, 464, 122, 46, "#eef4fa", "#334155", "JD");
drawPill(ctx, 438, 464, 158, 46, "#eef4fa", "#334155", "Email");
drawPill(ctx, 610, 464, 184, 46, "#eef4fa", "#334155", "WhatsApp");

drawWindow(ctx, 700, 220, 340, 236);

writeFileSync(outputPath, canvas.toBuffer("image/png"));

function drawWindow(ctx, x, y, w, h) {
  ctx.fillStyle = "#f9fbfd";
  roundRect(ctx, x, y, w, h, 26);
  ctx.fill();
  ctx.strokeStyle = "rgba(15,23,42,0.08)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 26);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x + 18, y + 18, w - 36, 46, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(15,23,42,0.06)";
  roundRect(ctx, x + 18, y + 18, w - 36, 46, 16);
  ctx.stroke();

  drawDot(ctx, x + 36, y + 41, "#ef4444");
  drawDot(ctx, x + 56, y + 41, "#f59e0b");
  drawDot(ctx, x + 76, y + 41, "#22c55e");

  drawSection(ctx, x + 26, y + 84, w - 52, 56, "Capture", "#dbeafe");
  drawSection(ctx, x + 26, y + 152, w - 52, 42, "Review Fields", "#eff6ff");
  drawSection(ctx, x + 26, y + 206, w - 52, 22, "", "#dbeafe");
}

function drawSection(ctx, x, y, w, h, label, color) {
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(15,23,42,0.06)";
  roundRect(ctx, x, y, w, h, 16);
  ctx.stroke();

  ctx.fillStyle = color;
  roundRect(ctx, x + 14, y + 12, Math.max(90, w * 0.35), Math.max(12, h - 24), 10);
  ctx.fill();

  if (label) {
    ctx.fillStyle = "#0f172a";
    ctx.font = "600 18px Arial";
    ctx.fillText(label, x + 128, y + h / 2 + 6);
  }
}

function drawDot(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPill(ctx, x, y, w, h, bg, color, label) {
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, 23);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = "600 20px Arial";
  ctx.fillText(label, x + 22, y + 29);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let offsetY = 0;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth) {
      ctx.fillText(line, x, y + offsetY);
      line = word;
      offsetY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, x, y + offsetY);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
