import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const CREDENTIALS = {
  username: process.env.GWASENA_USERNAME || 'admin',
  password: process.env.GWASENA_PASSWORD || 'password123',
};

// Target analysis session for wizard steps (completed session with full results)
const TARGET_ANALYSIS_ID = process.env.TARGET_ANALYSIS_ID || 31;

const OUTPUT_PDF_ROOT = 'Dokumentasi_Frontend_GWASena.pdf';
const OUTPUT_PDF_DOCS = path.join('docs', 'Dokumentasi_Frontend_GWASena.pdf');
const SCREENSHOT_DIR = 'screenshots';

/**
 * Utility delay helper
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for network and visual stabilization
 */
async function stabilizePage(page, extraWaitMs = 1500) {
  try {
    await page.evaluateHandle('document.fonts.ready');
  } catch {
    // Ignore font readiness errors if already ready
  }

  // Inject subtle CSS override to prevent unsightly scrollbars in screenshots
  await page.addStyleTag({
    content: `
      ::-webkit-scrollbar { display: none !important; }
      * { scrollbar-width: none !important; }
    `,
  });

  await delay(extraWaitMs);
}

/**
 * Login handler with fallback token injection
 */
async function authenticate(page) {
  console.log(`\nMelakukan autentikasi di ${BASE_URL}/login...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#username', { timeout: 10000 });

  // Type credentials and submit
  await page.type('#username', CREDENTIALS.username, { delay: 20 });
  await page.type('#password', CREDENTIALS.password, { delay: 20 });
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  try {
    await page.waitForFunction(
      () => window.location.pathname.includes('/dashboard'),
      { timeout: 10000 }
    );
    console.log('      Berhasil login via UI form!');
  } catch (err) {
    console.warn('      Login via UI timeout, mencoba fallback token injection...');
    // Fallback: Login via direct REST endpoint & inject localStorage
    const res = await fetch('http://127.0.0.1:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CREDENTIALS),
    });
    const data = await res.json();
    if (data?.access_token) {
      await page.evaluate((token) => {
        localStorage.setItem('gwasena_access_token', token);
        localStorage.setItem('gwasena_has_logged_in', 'true');
      }, data.access_token);
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    }
  }

  await page.waitForSelector('h1, table, .figma-card', { timeout: 15000 });
  await stabilizePage(page, 1500);
}

async function main() {
  console.log('===============================================================');
  console.log('   GWASena 2.0 - Otomasi Full-Page Screenshot & PDF Generator  ');
  console.log('===============================================================');

  // Ensure output directories exist
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await fs.mkdir('docs', { recursive: true });

  console.log('Meluncurkan headless browser Chromium...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--window-size=1440,900',
    ],
  });

  const page = await browser.newPage();

  // Desktop viewport tajam (deviceScaleFactor: 2 untuk ketajaman Retina/HiDPI)
  await page.setViewport({
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
  });

  const capturedScreenshots = [];

  async function takeScreenshot(name, label) {
    console.log(`  -> Menangkap screenshot: ${label} (${name})...`);
    await stabilizePage(page, 1800);

    // Path in root as requested by user prompt pattern: screenshot_${pageName}.png
    const rootPath = `screenshot_${name}.png`;
    // Path in screenshots/ for organized persistence
    const dirPath = path.join(SCREENSHOT_DIR, `screenshot_${name}.png`);

    await page.screenshot({ path: rootPath, fullPage: true });
    // Also save copy to screenshots/ folder
    await fs.copyFile(rootPath, dirPath);

    capturedScreenshots.push({
      id: name,
      label,
      filePath: rootPath,
    });
    console.log(`     Tersimpan: ${rootPath}`);
  }

  try {
    // =========================================================================
    // 00. LANDING PAGE / INTRO (S-00)
    // =========================================================================
    console.log('\n[1/11] Mengakses Halaman Landing Page / Intro (S-00)...');
    try {
      await page.goto(`${BASE_URL}/welcome`, {
        waitUntil: 'networkidle0',
        timeout: 8000,
      });
    } catch {
      await page.goto(`${BASE_URL}/welcome`, { waitUntil: 'domcontentloaded' });
    }
    // Tunggu elemen hero "From Genotype to Discovery" dan kartu pilar selesai render
    await page.waitForFunction(
      () => document.body.innerText.includes('From Genotype to Discovery'),
      { timeout: 15000 }
    );
    await page.waitForSelector('h1, button, .rounded-3xl', { timeout: 10000 });
    await takeScreenshot('00_Landing_Intro', 'S-00 Landing Page / Pengenalan Utama');

    // =========================================================================
    // 01. LAYAR LOGIN (S-01)
    // =========================================================================
    console.log('\n[2/11] Mengakses Layar Login (S-01)...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('form, #username, .figma-card', { timeout: 10000 });
    await takeScreenshot('01_Login', 'S-01 Layar Login (Autentikasi)');

    // =========================================================================
    // 02. LAYAR REGISTRASI (S-02)
    // =========================================================================
    console.log('\n[3/11] Mengakses Layar Registrasi (S-02)...');
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('form, #email, .figma-card', { timeout: 10000 });
    await takeScreenshot('02_Register', 'S-02 Layar Registrasi Peneliti Baru');

    // =========================================================================
    // 03. LAYAR DASHBOARD (S-03)
    // =========================================================================
    console.log('\n[4/11] Autentikasi dan Mengakses Layar Dashboard (S-03)...');
    await authenticate(page);
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1, table, .figma-card', { timeout: 15000 });
    await takeScreenshot('03_Dashboard', 'S-03 Layar Dashboard Riset');

    // =========================================================================
    // WIZARD ANALISIS AKTIF (#31)
    // =========================================================================
    console.log(`\nNavigasi ke rute wizard analisis aktif (#${TARGET_ANALYSIS_ID})...`);
    await page.goto(`${BASE_URL}/analyses/${TARGET_ANALYSIS_ID}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('ol[aria-label="Alur Pipeline Analisis GWAS"]', {
      timeout: 20000,
    });
    await delay(2500);

    // 04. Langkah 1: Unggah & Validasi (Step 1 Upload)
    console.log('\n[5/11] Navigasi ke Langkah 1: Unggah & Validasi...');
    await page.evaluate(() => {
      const btns = Array.from(
        document.querySelectorAll('ol[aria-label="Alur Pipeline Analisis GWAS"] button')
      );
      if (btns[0]) btns[0].click();
    });
    await delay(1500);
    await takeScreenshot('04_Wizard_Unggah', 'Langkah 1: Unggah & Validasi Dataset');

    // 05. Langkah 2: Konfigurasi QC & Model (Step 2 Config)
    console.log('\n[6/11] Navigasi ke Langkah 2: Konfigurasi QC & Model...');
    await page.evaluate(() => {
      const btns = Array.from(
        document.querySelectorAll('ol[aria-label="Alur Pipeline Analisis GWAS"] button')
      );
      if (btns[1]) btns[1].click();
    });
    await delay(1500);
    await takeScreenshot('05_Wizard_Konfigurasi', 'Langkah 2: Konfigurasi QC & Model GWAS');

    // 06. Langkah 3: Komputasi Pipeline (Step 3 Computation)
    console.log('\n[7/11] Navigasi ke Langkah 3: Komputasi Pipeline...');
    await page.evaluate(() => {
      const btns = Array.from(
        document.querySelectorAll('ol[aria-label="Alur Pipeline Analisis GWAS"] button')
      );
      if (btns[2]) btns[2].click();
    });
    await delay(1500);
    await takeScreenshot('06_Wizard_Komputasi', 'Langkah 3: Status Pipeline Komputasi');

    // 07. Langkah 4: Visualisasi Manhattan & QQ Plot (Step 4 Results)
    console.log('\n[8/11] Navigasi ke Langkah 4: Visualisasi Manhattan & QQ Plot...');
    await page.evaluate(() => {
      const btns = Array.from(
        document.querySelectorAll('ol[aria-label="Alur Pipeline Analisis GWAS"] button')
      );
      if (btns[3]) btns[3].click();
    });
    // Tunggu Plotly WebGL menyelesaikan rendering titik SNP Manhattan & QQ Plot
    await page
      .waitForSelector('.js-plotly-plot', { timeout: 15000 })
      .catch(() => {});
    await delay(3000);
    await takeScreenshot(
      '07_Wizard_Visualisasi',
      'Langkah 4: Visualisasi Plot Manhattan & QQ Plot'
    );

    // 08. Langkah 5: Anotasi Gen (Step 5 Annotation)
    console.log('\n[9/11] Navigasi ke Langkah 5: Anotasi Gen...');
    await page.evaluate(() => {
      const btns = Array.from(
        document.querySelectorAll('ol[aria-label="Alur Pipeline Analisis GWAS"] button')
      );
      if (btns[4]) btns[4].click();
    });
    await delay(2000);
    await takeScreenshot('08_Wizard_Anotasi', 'Langkah 5: Pemetaan Anotasi Gen Fungsional');

    // 09. Langkah 6: Ekspor & Laporan (Step 6 Export)
    console.log('\n[10/11] Navigasi ke Langkah 6: Ekspor & Laporan...');
    await page.evaluate(() => {
      const btns = Array.from(
        document.querySelectorAll('ol[aria-label="Alur Pipeline Analisis GWAS"] button')
      );
      if (btns[5]) btns[5].click();
    });
    await delay(2000);
    await takeScreenshot('09_Wizard_Ekspor', 'Langkah 6: Ekspor Data & Publikasi Hasil');

    // =========================================================================
    // 10. LAYAR RIWAYAT (S-10 HistoryPage)
    // =========================================================================
    console.log('\n[11/11] Mengakses Layar Riwayat Analisis (S-10)...');
    await page.goto(`${BASE_URL}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1, table, .figma-card, input[placeholder*="Cari"]', {
      timeout: 15000,
    });
    await takeScreenshot('10_Riwayat', 'S-10 Layar Riwayat Analisis Pengguna');

    // =========================================================================
    // GENERASI DOKUMEN PDF LENGKAP
    // =========================================================================
    console.log('\n===============================================================');
    console.log('Menggabungkan 11 screenshot ke dalam file PDF Dokumentasi...');
    console.log('===============================================================');

    const pdfDoc = await PDFDocument.create();

    pdfDoc.setTitle('Dokumentasi Frontend GWASena 2.0');
    pdfDoc.setAuthor('GWASena Automation Suite');
    pdfDoc.setSubject('Dokumentasi Lengkap Antarmuka Pengguna & Pipeline GWAS');
    pdfDoc.setProducer('Puppeteer + pdf-lib');
    pdfDoc.setCreationDate(new Date());

    for (const item of capturedScreenshots) {
      console.log(`  -> Menyisipkan halaman PDF: ${item.label}...`);
      const imageBytes = await fs.readFile(item.filePath);
      const embeddedImage = await pdfDoc.embedPng(imageBytes);

      // Fit image size (1:1 aspect ratio preserving original high-definition scale)
      const pdfPage = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
      pdfPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: embeddedImage.width,
        height: embeddedImage.height,
      });
    }

    console.log('\nMenyimpan dan mengompresi struktur PDF...');
    const pdfBytes = await pdfDoc.save();

    // Simpan di root folder proyek
    await fs.writeFile(OUTPUT_PDF_ROOT, pdfBytes);
    console.log(`>>> Berhasil memperbarui PDF di root: ${path.resolve(OUTPUT_PDF_ROOT)}`);

    // Simpan di folder docs/
    await fs.writeFile(OUTPUT_PDF_DOCS, pdfBytes);
    console.log(`>>> Berhasil memperbarui PDF di docs/: ${path.resolve(OUTPUT_PDF_DOCS)}`);

    console.log('\n===============================================================');
    console.log('   PROSES SELESAI DENGAN SUKSES!                              ');
    console.log(`   Total Halaman Ditangkap: ${capturedScreenshots.length} Halaman`);
    console.log(`   Ukuran Dokumen PDF     : ${(pdfBytes.length / (1024 * 1024)).toFixed(2)} MB`);
    console.log('===============================================================');
  } catch (err) {
    console.error('\nTerjadi kesalahan selama otomasi:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
