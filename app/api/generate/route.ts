import archiver from "archiver";
import puppeteer from "puppeteer";
import { PassThrough } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GeneratePayload = {
  names: string[];
  course: string;
  date_text: string;
  hours_text: string;
};

function safeFilename(value: string): string {
  const normalized = value
    .trim()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return normalized || "certificate";
}

function formatName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

function toErrorDetails(error: unknown): string {
  if (error instanceof Error) return error.stack || error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

function toZipBuffer(output: PassThrough, archive: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    output.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    output.on("end", () => resolve(Buffer.concat(chunks)));
    output.on("error", reject);
    archive.on("error", reject);
  });
}

export async function POST(request: Request): Promise<Response> {
  let stage = "parse_body";
  let browser: any = null;

  try {
    const body = (await request.json()) as Partial<GeneratePayload>;
    const names = Array.isArray(body.names)
      ? body.names.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : [];
    const course = typeof body.course === "string" ? body.course.trim() : "";
    const dateText = typeof body.date_text === "string" ? body.date_text.trim() : "";
    const hoursText = typeof body.hours_text === "string" ? body.hours_text.trim() : "";

    if (names.length === 0 || !course || !dateText || !hoursText) {
      return new Response(
        JSON.stringify({
          ok: false,
          stage,
          message: "بيانات الإدخال غير مكتملة.",
          details: "Expected non-empty names, course, date_text, and hours_text.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        },
      );
    }

    stage = "load_template";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://127.0.0.1:3000";
    const previewUrl =
      `${baseUrl}/preview?print=1` +
      `&name=${encodeURIComponent(formatName(names[0]))}` +
      `&course=${encodeURIComponent(course)}` +
      `&date_text=${encodeURIComponent(dateText)}` +
      `&hours_text=${encodeURIComponent(hoursText)}`;

    stage = "launch_browser";
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setCacheEnabled(true);
    await page.setViewport({
      width: 1123,
      height: 794,
      deviceScaleFactor: 2,
    });

    await page.setRequestInterception(true);
    page.on("request", (req: any) => {
      const url = req.url();
      if (url.startsWith(baseUrl) || url.startsWith("data:") || url.startsWith("about:blank")) {
        req.continue();
        return;
      }
      req.abort();
    });

    await page.goto(previewUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".page", { timeout: 60000 });
    await page.evaluateHandle("document.fonts.ready");

    const output = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 9 } });
    const zipBufferPromise = toZipBuffer(output, archive);
    archive.pipe(output);

    const nameCollisions = new Map<string, number>();

    for (const name of names) {
      stage = "render_pdf";
      const certificateName = formatName(name);

      await page.evaluate(
        (payload: { name: string; course: string; dateText: string; hoursText: string }) => {
          const nodes = Array.from(document.querySelectorAll(".text-node"));
          const nameNode = nodes[1] as HTMLElement | undefined;
          const courseNode = nodes[3] as HTMLElement | undefined;
          const dateNode = nodes[4] as HTMLElement | undefined;
          const hoursNode = nodes[5] as HTMLElement | undefined;

          if (!nameNode || !courseNode || !dateNode || !hoursNode) {
            throw new Error("Certificate text nodes are missing.");
          }

          nameNode.textContent = payload.name;
          courseNode.textContent = `" ${payload.course} "`;
          dateNode.textContent = payload.dateText;
          hoursNode.textContent = payload.hoursText;
        },
        { name: certificateName, course, dateText, hoursText },
      );

      const pdf = await page.pdf({
        width: "1123px",
        height: "794px",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        pageRanges: "1",
        timeout: 60000,
      });

      const baseName = safeFilename(name);
      const usedCount = nameCollisions.get(baseName) ?? 0;
      const nextCount = usedCount + 1;
      nameCollisions.set(baseName, nextCount);
      const finalName = nextCount === 1 ? baseName : `${baseName}-${nextCount}`;

      archive.append(Buffer.from(pdf), { name: `${finalName}.pdf` });
    }

    stage = "zip_finalize";
    await archive.finalize();
    const zipBuffer = await zipBufferPromise;

    await page.close();

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="certificates.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        stage,
        message: "تعذر توليد الشهادات.",
        details: toErrorDetails(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
