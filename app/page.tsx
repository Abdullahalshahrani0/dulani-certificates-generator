"use client";

import { useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";

type SheetMapping = {
  sheetName: string;
  nameColumn: string;
};

export default function Home() {
  const [courseName, setCourseName] = useState("");
  const [dateText, setDateText] = useState("");
  const [hours, setHours] = useState("");

  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);

  const [selectedSheet, setSelectedSheet] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedNameColumn, setSelectedNameColumn] = useState("");

  const [selectedSheets, setSelectedSheets] = useState<SheetMapping[]>([]);

  const [rowsScanned, setRowsScanned] = useState(0);
  const [rawCount, setRawCount] = useState(0);
  const [cleanedUniqueCount, setCleanedUniqueCount] = useState(0);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);
  const [previewNames, setPreviewNames] = useState<string[]>([]);
  const [preparedNames, setPreparedNames] = useState<string[]>([]);

  const [uploadedFileName, setUploadedFileName] = useState("");
  const [isFileLocked, setIsFileLocked] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressValue, setProgressValue] = useState(0);

  const resetWorkbookDerivedState = () => {
    setSheetNames([]);
    setSelectedSheet("");
    setColumns([]);
    setSelectedNameColumn("");
    setSelectedSheets([]);

    setRowsScanned(0);
    setRawCount(0);
    setCleanedUniqueCount(0);
    setDuplicatesRemoved(0);
    setPreviewNames([]);
    setPreparedNames([]);
    setProgressValue(0);
    setSuccessMessage("");
  };

  const handleReplaceFile = () => {
    setWorkbook(null);
    setUploadedFileName("");
    setIsFileLocked(false);
    setErrorMessage("");
    setSuccessMessage("");
    resetWorkbookDerivedState();
    setFileInputKey((prev) => prev + 1);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    setErrorMessage("");
    setWorkbook(null);
    setUploadedFileName("");
    setIsFileLocked(false);
    setSuccessMessage("");
    resetWorkbookDerivedState();

    if (!file) {
      return;
    }

    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileNameLower = file.name.toLowerCase();
    const isValidExtension = validExtensions.some((ext) => fileNameLower.endsWith(ext));

    if (!isValidExtension) {
      setErrorMessage("الملف غير مدعوم. يرجى رفع XLSX أو XLS أو CSV.");
      event.target.value = "";
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const parsedWorkbook = XLSX.read(buffer, { type: "array" });

      if (!parsedWorkbook.SheetNames || parsedWorkbook.SheetNames.length === 0) {
        throw new Error("empty_sheets");
      }

      setWorkbook(parsedWorkbook);
      setSheetNames(parsedWorkbook.SheetNames);
      setUploadedFileName(file.name);
      setIsFileLocked(true);
    } catch {
      setErrorMessage("تعذر قراءة الملف. تأكد من أن الملف صالح وغير تالف.");
      event.target.value = "";
      setIsFileLocked(false);
    }
  };

  const handleSheetChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const sheetName = event.target.value;

    setSelectedSheet(sheetName);
    setSelectedNameColumn("");
    setColumns([]);
    setErrorMessage("");

    if (!workbook || !sheetName) {
      return;
    }

    try {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error("missing_sheet");
      }

      const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
        header: 1,
        blankrows: false,
      });

      const firstRow = rows[0] ?? [];
      const extractedColumns = firstRow
        .map((cell, index) => {
          const value = String(cell ?? "").trim();
          return value || `عمود ${index + 1}`;
        })
        .filter((value) => value.length > 0);

      if (extractedColumns.length === 0) {
        throw new Error("empty_headers");
      }

      setColumns(extractedColumns);
    } catch {
      setErrorMessage("تعذر قراءة أعمدة الشيت المحدد. تأكد من وجود صف عناوين في أول صف.");
    }
  };

  const handleAddSheet = () => {
    setErrorMessage("");

    if (!selectedSheet) {
      setErrorMessage("اختر شيت أولاً.");
      return;
    }

    if (!selectedNameColumn) {
      setErrorMessage("اختر عمود الاسم.");
      return;
    }

    const alreadyAdded = selectedSheets.some((item) => item.sheetName === selectedSheet);
    if (alreadyAdded) {
      setErrorMessage("تم إضافة الشيت مسبقاً.");
      return;
    }

    setSelectedSheets((prev) => [
      ...prev,
      {
        sheetName: selectedSheet,
        nameColumn: selectedNameColumn,
      },
    ]);

    setSelectedSheet("");
    setSelectedNameColumn("");
    setColumns([]);
  };

  const handleRemoveSheet = (sheetName: string) => {
    setSelectedSheets((prev) => prev.filter((item) => item.sheetName !== sheetName));
    setErrorMessage("");
  };

  const handlePrepareNames = () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!workbook) {
      setErrorMessage("يرجى رفع ملف أولاً.");
      return;
    }

    if (selectedSheets.length === 0) {
      setErrorMessage("أضف شيت واحد على الأقل قبل تجهيز الأسماء.");
      return;
    }

    try {
      let nextRowsScanned = 0;
      let nextRawCount = 0;
      const cleanedNames: string[] = [];

      for (const mapping of selectedSheets) {
        const worksheet = workbook.Sheets[mapping.sheetName];
        if (!worksheet) {
          continue;
        }

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: "",
          raw: false,
        });

        nextRowsScanned += rows.length;

        for (const row of rows) {
          const rawValue = row[mapping.nameColumn];
          if (rawValue === undefined || rawValue === null) {
            continue;
          }

          const textValue = String(rawValue).trim();
          if (!textValue) {
            continue;
          }

          const cleanedValue = textValue.replace(/\s+/g, " ");
          if (!cleanedValue) {
            continue;
          }

          nextRawCount += 1;
          cleanedNames.push(cleanedValue);
        }
      }

      const uniqueNames = Array.from(new Set(cleanedNames));
      const nextUniqueCount = uniqueNames.length;

      setRowsScanned(nextRowsScanned);
      setRawCount(nextRawCount);
      setCleanedUniqueCount(nextUniqueCount);
      setDuplicatesRemoved(nextRawCount - nextUniqueCount);
      setPreviewNames(uniqueNames.slice(0, 10));
      setPreparedNames(uniqueNames);
    } catch {
      setErrorMessage("حدث خطأ أثناء تجهيز الأسماء. تأكد من صحة الأعمدة المختارة.");
    }
  };

  const handleGenerateCertificates = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (preparedNames.length === 0) {
      setErrorMessage("قم بتجهيز الأسماء أولاً قبل إنشاء الشهادات.");
      return;
    }

    if (!courseName.trim()) {
      setErrorMessage("أدخل اسم الدورة أولاً.");
      return;
    }

    if (!dateText.trim()) {
      setErrorMessage("أدخل التاريخ أولاً.");
      return;
    }

    const hoursText = `بواقع (${hours || "0"}) ساعة تدريبية واستشارية`;

    try {
      setIsGenerating(true);
      setProgressValue(15);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          names: preparedNames,
          course: courseName,
          date_text: dateText,
          hours_text: hoursText,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || "تعذر إنشاء ملف الشهادات.");
      }

      setProgressValue(85);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "certificates.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setProgressValue(100);
      setSuccessMessage("تم إنشاء الشهادات وتنزيل الملف بنجاح.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إنشاء الشهادات.";
      setErrorMessage(message);
      setProgressValue(0);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main dir="rtl" className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_45%),radial-gradient(circle_at_80%_20%,_rgba(99,102,241,0.22),_transparent_42%),linear-gradient(180deg,_#020617_0%,_#0b1120_52%,_#020617_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.17] [background-image:radial-gradient(rgba(255,255,255,0.7)_0.5px,transparent_0.5px)] [background-size:4px_4px]" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="space-y-6 text-center lg:text-right">
          <span className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-1 text-xs font-semibold tracking-[0.22em] text-cyan-100/90">
            DULANI CERTIFICATES GENERATOR
          </span>

          <div className="space-y-4">
            <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-6xl">
              مولّد شهادات دلني
            </h1>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-slate-100 backdrop-blur-sm">
              <ShieldIcon />
              Security
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-slate-100 backdrop-blur-sm">
              <DeviceIcon />
              Offline-friendly
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-slate-100 backdrop-blur-sm">
              <BoltIcon />
              Fast
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl shadow-indigo-900/20 backdrop-blur-xl sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-wrap gap-3 border-b border-white/15 pb-5">
            <button
              type="button"
              className="rounded-xl border border-cyan-300/40 bg-cyan-300/20 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-sm shadow-cyan-500/20"
            >
              توليد الشهادات
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300"
            >
              عن القالب
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-2 lg:col-span-2">
                    <label htmlFor="file" className="block text-sm font-semibold text-slate-100">
                      ملف البيانات
                    </label>
                    <div className="relative overflow-hidden rounded-xl border border-dashed border-cyan-200/40 bg-slate-900/45 p-5 transition hover:border-cyan-200/55 hover:bg-slate-900/55">
                      <input
                        key={fileInputKey}
                        id="file"
                        name="file"
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        disabled={isFileLocked}
                        onChange={handleFileChange}
                        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                      />
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <UploadIcon />
                        <p className="text-sm font-semibold text-slate-100">اسحب الملف هنا أو اضغط للاختيار</p>
                        <p className="text-xs text-slate-400">يدعم: XLSX / XLS / CSV</p>
                        <p className="text-xs font-medium text-cyan-200">حد الرفع 10MB</p>
                      </div>
                    </div>

                    {uploadedFileName ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-300/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                          تم رفع الملف: {uploadedFileName}
                        </span>
                        <button
                          type="button"
                          onClick={handleReplaceFile}
                          className="inline-flex items-center rounded-lg border border-amber-300/40 bg-amber-300/15 px-2.5 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-300/25"
                        >
                          استبدال الملف
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="sheet" className="block text-sm font-semibold text-slate-100">
                      اسم الشيت
                    </label>
                    <div className="relative">
                      <select
                        id="sheet"
                        name="sheet"
                        disabled={sheetNames.length === 0}
                        value={selectedSheet}
                        onChange={handleSheetChange}
                        className="h-11 w-full appearance-none rounded-xl border border-white/15 bg-slate-900/45 px-3 text-sm text-slate-200 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        <option value="">اختر الشيت</option>
                        {sheetNames.map((sheetName) => (
                          <option key={sheetName} value={sheetName}>
                            {sheetName}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
                        <ChevronIcon />
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="nameColumn" className="block text-sm font-semibold text-slate-100">
                      عمود الاسم
                    </label>
                    <div className="relative">
                      <select
                        id="nameColumn"
                        name="nameColumn"
                        disabled={columns.length === 0}
                        value={selectedNameColumn}
                        onChange={(event) => {
                          setSelectedNameColumn(event.target.value);
                          setErrorMessage("");
                        }}
                        className="h-11 w-full appearance-none rounded-xl border border-white/15 bg-slate-900/45 px-3 text-sm text-slate-200 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        <option value="">اختر العمود</option>
                        {columns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
                        <ChevronIcon />
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddSheet}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/15 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/25"
                    >
                      <PlusIcon />
                      إضافة الشيت
                    </button>
                  </div>

                  <div className="space-y-2 lg:col-span-3">
                    <div className="grid gap-5 lg:grid-cols-3">
                      <div className="space-y-2">
                        <label htmlFor="courseName" className="block text-sm font-semibold text-slate-100">
                          اسم الدورة
                        </label>
                        <input
                          id="courseName"
                          name="courseName"
                          type="text"
                          value={courseName}
                          onChange={(event) => setCourseName(event.target.value)}
                          placeholder="مثال: برنامج التميّز في خدمة العملاء"
                          className="h-11 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="dateText" className="block text-sm font-semibold text-slate-100">
                          التاريخ
                        </label>
                        <input
                          id="dateText"
                          name="dateText"
                          type="text"
                          required
                          value={dateText}
                          onChange={(event) => setDateText(event.target.value)}
                          placeholder="مثال: 15 شعبان 1447هـ"
                          className="h-11 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="hours" className="block text-sm font-semibold text-slate-100">
                          عدد الساعات
                        </label>
                        <input
                          id="hours"
                          name="hours"
                          type="number"
                          min="0"
                          step="0.5"
                          value={hours}
                          onChange={(event) => setHours(event.target.value)}
                          placeholder="مثال: 10"
                          className="h-11 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
                        />
                        <p className="text-xs text-cyan-100/90">بواقع ({hours || "0"}) ساعة تدريبية واستشارية</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handlePrepareNames}
                    disabled={selectedSheets.length === 0 || isGenerating}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-500/25 px-4 text-sm font-semibold text-emerald-50 shadow-lg shadow-emerald-900/25 transition hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    تجهيز الأسماء
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateCertificates}
                    disabled={isGenerating || preparedNames.length === 0}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-indigo-300/25 bg-gradient-to-l from-indigo-500/50 to-cyan-500/50 px-4 text-sm font-semibold text-white/85 shadow-lg shadow-indigo-900/30 transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGenerating ? "جارِ إنشاء الشهادات..." : "إنشاء الشهادات"}
                  </button>
                </div>
              </form>

              <div className="mt-6 space-y-3 border-t border-white/15 pt-5">
                <div
                  className={
                    errorMessage
                      ? "rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100"
                      : successMessage
                        ? "rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100"
                        : "rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100"
                  }
                >
                  {errorMessage || successMessage || "لا توجد أخطاء."}
                </div>

                <div className={isGenerating ? "space-y-2" : "hidden space-y-2"} aria-hidden={!isGenerating}>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-cyan-300 transition-all duration-300" style={{ width: `${progressValue}%` }} />
                  </div>
                  <p className="text-xs text-slate-400">{progressValue}%</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/15 bg-slate-900/35 p-4">
                <h3 className="text-sm font-bold text-slate-100">الشيتات المختارة</h3>
                {selectedSheets.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">لم يتم إضافة أي شيت بعد.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {selectedSheets.map((item) => (
                      <li
                        key={item.sheetName}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                      >
                        <div className="text-sm text-slate-200">
                          <span className="font-semibold">{item.sheetName}</span>
                          <span className="mx-2 text-slate-500">•</span>
                          <span className="text-slate-300">{item.nameColumn}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSheet(item.sheetName)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300/30 bg-rose-400/15 px-2.5 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-400/25"
                        >
                          <TrashIcon />
                          حذف
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-white/15 bg-slate-900/35 p-4">
                <h3 className="text-sm font-bold text-slate-100">معاينة الأسماء (أول 10)</h3>
                {previewNames.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">لا توجد أسماء للعرض حتى الآن.</p>
                ) : (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {previewNames.map((name) => (
                      <li
                        key={name}
                        className="truncate rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
                        title={name}
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <aside className="space-y-3 rounded-2xl border border-white/15 bg-slate-900/35 p-4">
              <h2 className="text-sm font-bold tracking-wide text-slate-100">ملخص</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <SummaryCard title="عدد الصفوف" value={rowsScanned.toLocaleString("ar-SA")} />
                <SummaryCard title="القيم الخام" value={rawCount.toLocaleString("ar-SA")} />
                <SummaryCard title="الأسماء الفريدة" value={cleanedUniqueCount.toLocaleString("ar-SA")} />
                <SummaryCard title="المكررات المحذوفة" value={duplicatesRemoved.toLocaleString("ar-SA")} />
              </div>
            </aside>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-slate-950/30 backdrop-blur-sm sm:p-6">
          <h2 className="text-lg font-bold text-white">كيف يعمل؟</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <StepCard
              step="01"
              title="رفع الملف"
              description="قم بإرفاق ملف الأسماء بصيغة Excel أو CSV عبر منطقة الرفع."
            />
            <StepCard
              step="02"
              title="اختيار العمود"
              description="حدد الشيت وعمود الاسم ثم أضف الشيت إلى القائمة."
            />
            <StepCard
              step="03"
              title="تجهيز البيانات"
              description="اضغط تجهيز الأسماء لمراجعة الملخص والأسماء الفريدة قبل التوليد."
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-slate-300">{title}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="relative rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <span className="text-xs font-bold tracking-[0.2em] text-cyan-200">{step}</span>
      <h3 className="mt-2 text-base font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-cyan-200">
      <path d="M12 16V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.5 10.5L12 7l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="16" width="16" height="4" rx="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 10v8M12 10v8M16 10v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v5c0 5-3.1 8.7-7 10-3.9-1.3-7-5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 19h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2L5 14h6l-1 8 8-12h-6l1-8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
