"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import config from "@/config/config.json";

type TextStyle = {
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
};

type TemplateConfig = {
  page: {
    width: number;
    height: number;
  };
  texts: Record<string, TextStyle>;
  images: {
    signature: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
};

const templateSource = String.raw`<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>شهادة دلني</title>
    <style>
      @page {
        size: A4 landscape;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        overflow: hidden;
      }

      body {
        direction: rtl;
        font-family: "Cairo", sans-serif;
        line-height: 1.2;
      }

      .page {
        width: 1123px;
        height: 794px;
        margin: 0 auto;
        position: relative;
        overflow: hidden;
        background: transparent;
      }

      .bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 0;
      }

      .logo-left,
      .logo-right {
        position: absolute;
        top: 26px;
        z-index: 2;
      }

      .logo-left {
        left: 56px;
      }

      .logo-right {
        right: 56px;
      }

      .logo {
        height: 78px;
        width: auto;
        object-fit: contain;
        display: block;
      }

      .text-node {
        position: absolute;
        white-space: pre-wrap;
        z-index: 2;
      }

      .signature-wrap {
        position: absolute;
        left: 70px;
        bottom: 30px;
        width: 240px;
        height: 170px;
        z-index: 2;
      }

      .signature {
        position: absolute;
        left: 0;
        bottom: 0;
        width: 240px;
        height: auto;
        z-index: 2;
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <img class="bg" src="/certificate-bg.png" alt="" onerror="this.style.display='none'" />

      <div class="logo-left">
        <img class="logo" src="/dulani_logo_transparent.png" alt="" onerror="this.style.display='none'" />
      </div>
      <div class="logo-right">
        <img class="logo" src="/sdb-logo-removebg-preview.png" alt="" onerror="this.style.display='none'" />
      </div>

      <div class="text-node" style="left: {{title_x}}px; top: {{title_y}}px; font-size: {{title_fontSize}}px; font-family: {{title_fontFamily}}; font-weight: {{title_fontWeight}}; color: {{title_color}}; text-align: {{title_align}}; transform: {{title_transform}};">يشهد مركز دلني للأعمال حضور</div>
      <div class="text-node" style="left: {{name_x}}px; top: {{name_y}}px; font-size: {{name_fontSize}}px; font-family: {{name_fontFamily}}; font-weight: {{name_fontWeight}}; color: {{name_color}}; text-align: {{name_align}}; transform: {{name_transform}};">{{name}}</div>
      <div class="text-node" style="left: {{program_x}}px; top: {{program_y}}px; font-size: {{program_fontSize}}px; font-family: {{program_fontFamily}}; font-weight: {{program_fontWeight}}; color: {{program_color}}; text-align: {{program_align}}; transform: {{program_transform}};">البرنامج التطويري</div>
      <div class="text-node" style="left: {{course_x}}px; top: {{course_y}}px; font-size: {{course_fontSize}}px; font-family: {{course_fontFamily}}; font-weight: {{course_fontWeight}}; color: {{course_color}}; text-align: {{course_align}}; transform: {{course_transform}};">" {{course}} "</div>
      <div class="text-node" style="left: {{date_x}}px; top: {{date_y}}px; font-size: {{date_fontSize}}px; font-family: {{date_fontFamily}}; font-weight: {{date_fontWeight}}; color: {{date_color}}; text-align: {{date_align}}; transform: {{date_transform}};">{{date_text}}</div>
      <div class="text-node" style="left: {{hours_x}}px; top: {{hours_y}}px; font-size: {{hours_fontSize}}px; font-family: {{hours_fontFamily}}; font-weight: {{hours_fontWeight}}; color: {{hours_color}}; text-align: {{hours_align}}; transform: {{hours_transform}};">{{hours_text}}</div>
      <div class="text-node" style="left: {{closing_x}}px; top: {{closing_y}}px; font-size: {{closing_fontSize}}px; font-family: {{closing_fontFamily}}; font-weight: {{closing_fontWeight}}; color: {{closing_color}}; text-align: {{closing_align}}; transform: {{closing_transform}};">سائلين المولى التوفيق والسداد</div>
      <div class="text-node" style="left: {{signer_title_x}}px; top: {{signer_title_y}}px; font-size: {{signer_title_fontSize}}px; font-family: {{signer_title_fontFamily}}; font-weight: {{signer_title_fontWeight}}; color: {{signer_title_color}}; text-align: {{signer_title_align}}; transform: {{signer_title_transform}};">المدير العام</div>
      <div class="text-node" style="left: {{signer_name_x}}px; top: {{signer_name_y}}px; font-size: {{signer_name_fontSize}}px; font-family: {{signer_name_fontFamily}}; font-weight: {{signer_name_fontWeight}}; color: {{signer_name_color}}; text-align: {{signer_name_align}}; transform: {{signer_name_transform}};">أ. أسامة السلوم</div>

      <div class="signature-wrap">
        <img class="signature" src="/Screenshot_2026-03-02_210456-removebg-preview.png" alt="" onerror="this.style.display='none'" />
      </div>
    </div>
  </body>
</html>`;

function injectTemplate(template: string, cfg: TemplateConfig, data: Record<string, string>) {
  const replacements: Record<string, string> = { ...data };

  for (const [key, value] of Object.entries(cfg.texts)) {
    replacements[`${key}_x`] = String(value.x);
    replacements[`${key}_y`] = String(value.y);
    replacements[`${key}_fontSize`] = String(value.fontSize);
    replacements[`${key}_fontFamily`] = `'${value.fontFamily}', sans-serif`;
    replacements[`${key}_fontWeight`] = String(value.fontWeight);
    replacements[`${key}_color`] = value.color;
    replacements[`${key}_align`] = value.align;
    replacements[`${key}_transform`] = value.align === "center" ? "translateX(-50%)" : "none";
  }

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, token: string) => replacements[token] ?? "");
}

function formatName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

function PreviewContent() {
  const searchParams = useSearchParams();
  const printMode = searchParams.get("print") === "1";

  const data: Record<string, string> = {
    name: formatName(searchParams.get("name") || "ياسمين صالح الخليفي"),
    course: searchParams.get("course") || "تجسير",
    date_text: searchParams.get("date_text") || "من تاريخ 2026/2/24 م حتى 2026/2/26 م",
    hours_text: searchParams.get("hours_text") || "بواقع (20) ساعة تدريبية واستشارية",
  };

  const html = injectTemplate(templateSource, config as TemplateConfig, data);

  if (printMode) {
    return (
      <main
        dir="rtl"
        style={{
          margin: 0,
          padding: 0,
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <div
          style={{ width: config.page.width, height: config.page.height }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-[1200px] space-y-4">
        <h1 className="text-xl font-bold">معاينة الشهادة</h1>
        <p className="text-sm text-slate-600">المعاينة تعتمد على config مع بيانات تجريبية ثابتة.</p>

        <div className="overflow-auto rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
          <div
            className="mx-auto"
            style={{ width: config.page.width, minWidth: config.page.width, height: config.page.height }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </main>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={null}>
      <PreviewContent />
    </Suspense>
  );
}
