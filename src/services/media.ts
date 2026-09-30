import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "../core/types";
import { WorkLimiter } from "./limiter";

const conversionLimiter = new WorkLimiter(2, 8);
const maxPixels = 20_000_000;

async function probeDimensions(
  path: string,
  context: CommandContext,
): Promise<{ width: number; height: number }> {
  const args = [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    path,
  ];
  const child = spawn(context.config.media.ffprobePath, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  let tooLarge = false;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    if (stdout.length + chunk.length > 65_536) {
      tooLarge = true;
      child.kill("SIGKILL");
      return;
    }
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-2_000);
  });
  const code = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Media probe timed out."));
    }, 5_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      resolve(exitCode ?? 1);
    });
  });
  if (tooLarge) throw new Error("Media probe output was too large.");
  if (code !== 0) throw new Error(stderr || "Could not inspect the media file.");
  const data = JSON.parse(stdout) as { streams?: Array<{ width?: number; height?: number }> };
  const width = data.streams?.[0]?.width ?? 0;
  const height = data.streams?.[0]?.height ?? 0;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new Error("The attached file does not contain a supported image or video stream.");
  }
  if (width * height > maxPixels)
    throw new Error("The image dimensions exceed the safe conversion limit.");
  return { width, height };
}

async function convert(context: CommandContext): Promise<Buffer> {
  const media = await context.downloadMedia();
  if (!new Set(["image", "video"]).has(media.kind))
    throw new Error("Choose an image or a short video.");
  if (media.buffer.byteLength > context.config.media.maxBytes)
    throw new Error("That file is over the configured media size limit.");
  const dir = await mkdtemp(join(tmpdir(), "kiteframe-"));
  const input = join(dir, `${randomUUID()}.input`);
  const output = join(dir, `${randomUUID()}.webp`);
  try {
    await writeFile(input, media.buffer, { mode: 0o600 });
    await probeDimensions(input, context);
    const args =
      media.kind === "video"
        ? [
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-threads",
            "1",
            "-i",
            input,
            "-t",
            String(context.config.media.maxVideoSeconds),
            "-vf",
            "scale=512:512:force_original_aspect_ratio=decrease,fps=15",
            "-vcodec",
            "libwebp",
            "-loop",
            "0",
            "-an",
            "-fs",
            String(context.config.media.maxBytes),
            output,
          ]
        : [
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-threads",
            "1",
            "-i",
            input,
            "-vf",
            "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:-1:-1:color=0x00000000",
            "-vcodec",
            "libwebp",
            "-fs",
            String(context.config.media.maxBytes),
            output,
          ];
    const child = spawn(context.config.media.ffmpegPath, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-2_000);
    });
    const code = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("Media conversion timed out."));
      }, 20_000);
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("close", (exitCode) => {
        clearTimeout(timer);
        resolve(exitCode ?? 1);
      });
    });
    if (code !== 0) throw new Error(stderr || "Media conversion failed.");
    const result = await readFile(output);
    if (result.byteLength > context.config.media.maxBytes)
      throw new Error("The converted sticker exceeds the configured size limit.");
    return result;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function createSticker(context: CommandContext): Promise<Buffer> {
  return conversionLimiter.run(() => convert(context));
}
