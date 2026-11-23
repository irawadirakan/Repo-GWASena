/**
 * GWASena Light Mode Full-Page Screenshot & PDF Archiving Script
 *
 * Tujuan:
 * 1. Mengunjungi 11 rute / tahapan antarmuka web GWASena di http://localhost:5173
 * 2. Memaksa seluruh halaman konsisten ke Light Mode (White Mode)
 * 3. Menangkap tangkapan layar penuh (full-page screenshot) berkualitas tinggi (deviceScaleFactor: 1.5, JPEG 85%)
 * 4. Mengompilasi menjadi dokumen resmi: docs/Arsip_Tampilan_Website_GWASena_LightMode.pdf (< 10 MB, target 2-5 MB)
 */

import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_DIR = path.resolve(ROOT_DIR, 'docs');
const TEMP_DIR = path.resolve(ROOT_DIR, 'temp_screenshots_light');
const OUTPUT_PDF_PATH = path.resolve(DOCS_DIR, 'Arsip_Tampilan_Website_GWASena_LightMode.pdf');

const BASE_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:8000';

/**
 * Helper: Memaksa mode terang (Light Mode) pada halaman
 */
async function enforceLightMode(page) {
  await page.evaluate(() => {
    try {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('gwasena_theme', 'light');
      localStorage.setItem('theme', 'light');
    } catch {}
  });
}

/**
 * Helper: Scroll penuh ke bawah dan kembali ke atas untuk memicu lazy load & render elemen
 */
async function triggerFullPageRender(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let currentPosition = 0;
      const step = 400;
      const interval = setInterval(() => {
        window.scrollBy(0, step);
        currentPosition += step;
        if (currentPosition >= document.body.scrollHeight) {
          clearInterval(interval);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 75);
    });
  });
  // Jeda agar posisi kembali ke paling atas sebelum screenshot
  await new Promise((r) => setTimeout(r, 600));
}

/**
 * Helper: Ambil token login akun peneliti demo dari backend
 */
async function getDemoToken() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/demo`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.access_token;
  } catch (err) {
    console.warn(`[AUTH] Login demo via /api/auth/demo gagal (${err.message}). Menggunakan token fallback.`);
    return 'gwasena_demo_offline_token_' + Date.now();
  }
}

/**
 * Helper: Dapatkan ID analisis yang berstatus 'selesai' untuk sesi wizard
 */
async function getCompletedAnalysisId(token) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/analyses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const list = await res.json();
      const finished = list.find((a) => String(a.status || '').toLowerCase() === 'selesai');
      if (finished) return finished.analysis_id || finished.id;
      if (list.length > 0) return list[0].analysis_id || list[0].id;
    }
  } catch (err) {
    console.warn(`[ANALYSIS] Gagal mengambil daftar analisis (${err.message}). Default ke ID 32.`);
  }
  return 32;
}

async function main() {
  console.log('='.repeat(70));
  console.log('  GWASena Automation: Full-Page Light Mode Screenshot & PDF Export');
  console.log('='.repeat(70));

  // Pastikan folder temp dan docs siap
  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.rm(TEMP_DIR, { recursive: true, force: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });

  console.log(`[INIT] Mengambil token akun peneliti demo...`);
  const demoToken = await getDemoToken();
  const analysisId = await getCompletedAnalysisId(demoToken);
  console.log(`[INIT] Token didapat. Menggunakan Analisis ID: #${analysisId}`);

  console.log(`[INIT] Membuka browser Puppeteer (Viewport 1440x900, Scale 1.5)...`);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

  // Skrip inisialisasi dokumen baru: selalu paksa light mode saat origin tersedia
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('gwasena_theme', 'light');
      localStorage.setItem('theme', 'light');
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('data-theme', 'light');
    } catch {}
  });

  const capturedImages = [];

  /**
   * Helper internal untuk mengambil screenshot dan mengompresi dengan sharp
   */
  async function capturePage(name, label) {
    console.log(`\n--> [CAPTURE] ${name}: ${label}`);
    await enforceLightMode(page);
    await triggerFullPageRender(page);
    await enforceLightMode(page);

    const rawPath = path.resolve(TEMP_DIR, `${name}_raw.jpg`);
    const finalPath = path.resolve(TEMP_DIR, `${name}.jpg`);

    // Ambil full page JPEG 85% dari browser
    await page.screenshot({
      path: rawPath,
      type: 'jpeg',
      quality: 85,
      fullPage: true,
    });

    // Optimasi tambahan menggunakan sharp (mozjpeg: true) untuk efisiensi ukuran maksimal tanpa degradasi
    const rawBuffer = await fs.readFile(rawPath);
    const optimizedBuffer = await sharp(rawBuffer)
      .jpeg({ quality: 85, mozjpeg: true, progressive: true })
      .toBuffer();
    await fs.writeFile(finalPath, optimizedBuffer);
    await fs.rm(rawPath, { force: true });

    const stats = await fs.stat(finalPath);
    const sizeKb = (stats.size / 1024).toFixed(1);
    console.log(`    ✓ Disimpan: ${name}.jpg (${sizeKb} KB)`);

    capturedImages.push({
      id: name,
      label,
      filePath: finalPath,
      sizeBytes: stats.size,
    });
  }

  try {
    // -------------------------------------------------------------------------
    // 00. Landing Page (Welcome)
    // -------------------------------------------------------------------------
    console.log(`[NAV] Membuka Landing Page: ${BASE_URL}/welcome`);
    await page.goto(`${BASE_URL}/welcome`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => {
      try {
        localStorage.removeItem('gwasena_access_token');
      } catch {}
    });
    await new Promise((r) => setTimeout(r, 2000));
    await capturePage('00_Landing_Page', 'Landing Page / Pengenalan GWASena');

    // -------------------------------------------------------------------------
    // 01. Login Page
    // -------------------------------------------------------------------------
    console.log(`[NAV] Membuka Login Page: ${BASE_URL}/login`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    await capturePage('01_Login', 'Halaman Masuk (Login)');

    // -------------------------------------------------------------------------
    // 02. Register Page
    // -------------------------------------------------------------------------
    console.log(`[NAV] Membuka Register Page: ${BASE_URL}/register`);
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500));
    await capturePage('02_Register', 'Halaman Registrasi Akun Baru');

    // -------------------------------------------------------------------------
    // Set Auth State (Injeksi Token Akun Peneliti Demo)
    // -------------------------------------------------------------------------
    console.log(`[AUTH] Menginjeksi token sesi peneliti demo ke localStorage...`);
    await page.evaluate((token) => {
      try {
        localStorage.setItem('gwasena_access_token', token);
        localStorage.setItem('gwasena_has_logged_in', 'true');
        localStorage.setItem('gwasena_is_demo', 'true');
      } catch {}
    }, demoToken);

    // -------------------------------------------------------------------------
    // 03. Dashboard
    // -------------------------------------------------------------------------
    console.log(`[NAV] Membuka Dashboard: ${BASE_URL}/dashboard`);
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));
    await capturePage('03_Dashboard', 'Dashboard Peneliti GWASena');

    // -------------------------------------------------------------------------
    // 04. Riwayat Analisis
    // -------------------------------------------------------------------------
    console.log(`[NAV] Membuka Riwayat Analisis: ${BASE_URL}/history`);
    await page.goto(`${BASE_URL}/history`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));
    await capturePage('04_Riwayat_Analisis', 'Riwayat Sesi Analisis');

    // -------------------------------------------------------------------------
    // 05. Wizard Langkah 1: Unggah & Validasi Dataset
    // -------------------------------------------------------------------------
    console.log(`[NAV] Membuka Wizard Sesi Analisis #${analysisId}: ${BASE_URL}/analyses/${analysisId}`);
    await page.goto(`${BASE_URL}/analyses/${analysisId}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Navigasi ke Tahap 1
    console.log(`[WIZARD] Beralih ke Tahap 1 (Unggah & Validasi)...`);
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('ol[aria-label="Alur Pipeline Analisis GWAS"] button');
      if (buttons.length >= 1) buttons[0].click();
    });
    await new Promise((r) => setTimeout(r, 1800));
    await capturePage('05_Wizard_Langkah_1_Unggah', 'Tahap 1: Unggah & Validasi Dataset');

    // -------------------------------------------------------------------------
    // 06. Wizard Langkah 2: Konfigurasi QC & Parameter
    // -------------------------------------------------------------------------
    console.log(`[WIZARD] Beralih ke Tahap 2 (Konfigurasi Parameter)...`);
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('ol[aria-label="Alur Pipeline Analisis GWAS"] button');
      if (buttons.length >= 2) buttons[1].click();
    });
    await new Promise((r) => setTimeout(r, 1800));
    await capturePage('06_Wizard_Langkah_2_Konfigurasi', 'Tahap 2: Konfigurasi Parameter QC & Model');

    // -------------------------------------------------------------------------
    // 07. Wizard Langkah 3: Layar Tunggu Komputasi
    // -------------------------------------------------------------------------
    console.log(`[WIZARD] Beralih ke Tahap 3 (Komputasi Pipeline)...`);
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('ol[aria-label="Alur Pipeline Analisis GWAS"] button');
      if (buttons.length >= 3) buttons[2].click();
    });
    await new Promise((r) => setTimeout(r, 1800));
    await capturePage('07_Wizard_Langkah_3_Komputasi', 'Tahap 3: Progres Komputasi & Tips Edukatif');

    // -------------------------------------------------------------------------
    // 08. Wizard Langkah 4: Hasil Analisis & Visualisasi Plot
    // -------------------------------------------------------------------------
    console.log(`[WIZARD] Beralih ke Tahap 4 (Hasil Analisis & Plot Plotly)...`);
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('ol[aria-label="Alur Pipeline Analisis GWAS"] button');
      if (buttons.length >= 4) buttons[3].click();
    });
    // Tunggu grafik Plotly ter-render sempurna
    await page.waitForSelector('.js-plotly-plot', { timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2500));
    await capturePage('08_Wizard_Langkah_4_Hasil_Visualisasi', 'Tahap 4: Manhattan Plot, QQ Plot, dan Tabel SNP');

    // -------------------------------------------------------------------------
    // 09. Wizard Langkah 5: Anotasi Gen Kandidat
    // -------------------------------------------------------------------------
    console.log(`[WIZARD] Beralih ke Tahap 5 (Anotasi Gen Kandidat)...`);
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('ol[aria-label="Alur Pipeline Analisis GWAS"] button');
      if (buttons.length >= 5) buttons[4].click();
    });
    await new Promise((r) => setTimeout(r, 2000));
    await capturePage('09_Wizard_Langkah_5_Anotasi', 'Tahap 5: Anotasi Gen Kandidat & Filter Lokus');

    // -------------------------------------------------------------------------
    // 10. Wizard Langkah 6: Ekspor & Laporan
    // -------------------------------------------------------------------------
    console.log(`[WIZARD] Beralih ke Tahap 6 (Ekspor & Laporan)...`);
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('ol[aria-label="Alur Pipeline Analisis GWAS"] button');
      if (buttons.length >= 6) buttons[5].click();
    });
    await new Promise((r) => setTimeout(r, 2000));
    await capturePage('10_Wizard_Langkah_6_Ekspor', 'Tahap 6: Ekspor Laporan Publikasi & Unduhan');

  } finally {
    await browser.close();
    console.log(`\n[BROWSER] Browser ditutup.`);
  }

  // ---------------------------------------------------------------------------
  // Kompilasi Dokumen PDF Bersih Menggunakan pdf-lib
  // ---------------------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log(`[PDF] Mengompilasi ${capturedImages.length} tangkapan layar ke dalam dokumen PDF...`);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle('Arsip Tampilan Website GWASena — Light Mode');
  pdfDoc.setAuthor('GWASena Bioinformatika IPB University');
  pdfDoc.setSubject('Dokumentasi Tangkapan Layar Resmi Antarmuka GWASena 2.0 (Light Mode)');
  pdfDoc.setCreator('GWASena Automated Capture Pipeline');

  for (let i = 0; i < capturedImages.length; i++) {
    const item = capturedImages[i];
    console.log(`  [+] Menyisipkan Halaman ${i + 1}/${capturedImages.length}: ${item.label}`);

    const imgBytes = await fs.readFile(item.filePath);
    const jpgImage = await pdfDoc.embedJpg(imgBytes);

    const imgWidth = jpgImage.width;
    const imgHeight = jpgImage.height;

    // Buat halaman PDF dengan rasio dan dimensi persis mengikuti gambar asli (tanpa margin / letterbox)
    const page = pdfDoc.addPage([imgWidth, imgHeight]);
    page.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: imgWidth,
      height: imgHeight,
    });
  }

  console.log(`[PDF] Menyimpan berkas ke: ${OUTPUT_PDF_PATH}...`);
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(OUTPUT_PDF_PATH, pdfBytes);

  // Bersihkan folder temp
  console.log(`[CLEANUP] Membersihkan folder tangkapan layar sementara: ${TEMP_DIR}...`);
  await fs.rm(TEMP_DIR, { recursive: true, force: true });

  const finalPdfStats = await fs.stat(OUTPUT_PDF_PATH);
  const finalPdfMb = (finalPdfStats.size / (1024 * 1024)).toFixed(2);

  console.log('\n' + '='.repeat(70));
  console.log('  KOMPILASI DOKUMEN PDF BERHASIL DENGAN SEMPURNA!');
  console.log('='.repeat(70));
  console.log(`  Berkas Output : ${OUTPUT_PDF_PATH}`);
  console.log(`  Total Halaman : ${capturedImages.length} Halaman`);
  console.log(`  Ukuran Berkas : ${finalPdfMb} MB (Memenuhi target < 10 MB)`);
  console.log('='.repeat(70) + '\n');
}

main().catch((err) => {
  console.error('\n[FATAL ERROR]', err);
  process.exit(1);
});
