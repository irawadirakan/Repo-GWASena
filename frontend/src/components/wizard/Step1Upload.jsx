import { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Dna,
  CheckCircle2,
  FileCheck2,
  ArrowRight,
  Loader2,
  Info,
  X,
} from 'lucide-react';
import { analysisService } from '../../services/analysisService.js';
import ErrorMessageArea from '../common/ErrorMessageArea.jsx';

/**
 * S-04: Step1Upload (Unggah & Validasi Data Genomik - Figma Aligned)
 * Modul: M-02 (FR-02, FR-11, BR-01, BR-02)
 * Acuan: 04 — Unggah Berkas & Validasi (Kosong).png & 04c — Unggah_ Valid (Boleh Lanjut).png
 */
export default function Step1Upload({ analysisId, onUploadSuccess, onNext }) {
  const [genotypeFile, setGenotypeFile] = useState(null);
  const [phenotypeFile, setPhenotypeFile] = useState(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);

  const [isDraggingGeno, setIsDraggingGeno] = useState(false);
  const [isDraggingPheno, setIsDraggingPheno] = useState(false);

  const genoInputRef = useRef(null);
  const phenoInputRef = useRef(null);

  // Validasi ekstensi genotipe (.vcf, .vcf.gz)
  const handleGenotypeSelect = (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.vcf') && !name.endsWith('.vcf.gz') && !name.endsWith('.gz')) {
      setError({
        message: 'Format berkas genotipe tidak didukung.',
        details: [
          `Berkas '${file.name}' harus berformat .vcf atau .vcf.gz.`,
          'Catatan: Format PLINK biner (.bed/.bim/.fam) belum didukung pada versi ini.',
        ],
      });
      setGenotypeFile(null);
      return;
    }
    setError(null);
    setGenotypeFile(file);
    setUploadResult(null);
  };

  // Validasi ekstensi fenotipe (.csv)
  const handlePhenotypeSelect = (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv')) {
      setError({
        message: 'Format berkas fenotipe tidak didukung.',
        details: [`Berkas '${file.name}' harus berformat .csv teks tabular.`],
      });
      setPhenotypeFile(null);
      return;
    }
    setError(null);
    setPhenotypeFile(file);
    setUploadResult(null);
  };

  const handleUploadAndValidate = async (e) => {
    e.preventDefault();
    if (!genotypeFile || !phenotypeFile) {
      setError('Mohon pilih kedua berkas (Genotipe dan Fenotipe) terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('genotipe', genotypeFile);
    formData.append('fenotipe', phenotypeFile);

    try {
      const res = await analysisService.uploadDataset(analysisId, formData);
      setUploadResult(res);
      onUploadSuccess?.(res);
    } catch (err) {
      setError(err);
      setUploadResult(null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header Langkah ── */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          1. Unggah & Validasi Dataset Bawang Putih
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Unggah data genotipe (varian SNP) dan data fenotipe (pengamatan sifat agronomi). Sistem
          akan memeriksa integritas format dan mencocokkan kesamaan 100% <em>Sample ID</em> (BR-02).
        </p>
      </div>

      <ErrorMessageArea error={error} onDismiss={() => setError(null)} />

      {/* ── Form Dropzone Grid (2 Kolom) ── */}
      <form onSubmit={handleUploadAndValidate} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ── Dropzone 1: Genotipe ── */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingGeno(true);
            }}
            onDragLeave={() => setIsDraggingGeno(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingGeno(false);
              if (e.dataTransfer.files?.[0]) handleGenotypeSelect(e.dataTransfer.files[0]);
            }}
            className={`flex flex-col justify-between rounded-3xl border-2 border-dashed p-6 transition-all ${
              isDraggingGeno
                ? 'border-[#06B6D4] bg-[#06B6D4]/10 scale-[1.005]'
                : genotypeFile
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#0F172E]/60 hover:border-[#5B4DFE] hover:bg-indigo-50/30 dark:hover:bg-white/5'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#06B6D4]/15 text-[#06B6D4]">
                    <Dna className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Berkas Genotipe (VCF)
                  </span>
                </div>
                <span className="text-[11px] font-mono rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#162142] px-2.5 py-0.5 text-slate-700 dark:text-slate-300">
                  .vcf / .vcf.gz
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                Format VCF standar (bialelik) berisi varian penanda SNP genom bawang putih (8 kromosom).
              </p>

              {genotypeFile ? (
                <div className="flex items-center justify-between rounded-2xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-[#121B38] p-3.5 shadow-sm animate-pop-in">
                  <div className="flex items-center gap-2.5 truncate">
                    <FileCheck2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {genotypeFile.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                        {(genotypeFile.size / (1024 * 1024)).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGenotypeFile(null);
                      setUploadResult(null);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white active:scale-95 transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => genoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0F172E]/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 active:scale-[0.99] transition-all text-center group"
                >
                  <UploadCloud className="h-8 w-8 text-[#06B6D4] mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-white">
                    Pilih atau Seret Berkas VCF ke Sini
                  </span>
                  <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Maksimal 200 MB</span>
                </div>
              )}

              <input
                ref={genoInputRef}
                type="file"
                accept=".vcf,.gz"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleGenotypeSelect(e.target.files[0]);
                }}
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 text-[#06B6D4]" />
              <span>Format PLINK biner (.bed/.bim/.fam) belum didukung pada rilis ini.</span>
            </div>
          </div>

          {/* ── Dropzone 2: Fenotipe ── */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingPheno(true);
            }}
            onDragLeave={() => setIsDraggingPheno(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingPheno(false);
              if (e.dataTransfer.files?.[0]) handlePhenotypeSelect(e.dataTransfer.files[0]);
            }}
            className={`flex flex-col justify-between rounded-3xl border-2 border-dashed p-6 transition-all ${
              isDraggingPheno
                ? 'border-[#5B4DFE] bg-[#5B4DFE]/10 scale-[1.005]'
                : phenotypeFile
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#0F172E]/60 hover:border-[#5B4DFE] hover:bg-indigo-50/30 dark:hover:bg-white/5'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#5B4DFE]/15 text-[#5B4DFE]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Berkas Fenotipe (CSV)
                  </span>
                </div>
                <span className="text-[11px] font-mono rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#162142] px-2.5 py-0.5 text-slate-700 dark:text-slate-300">
                  .csv
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                Tabel CSV memuat kolom ID sampel (<code>sample_id</code>) dan minimal 1 kolom sifat numerik (mis. <code>bobot_umbi_g</code>).
              </p>

              {phenotypeFile ? (
                <div className="flex items-center justify-between rounded-2xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-[#121B38] p-3.5 shadow-sm animate-pop-in">
                  <div className="flex items-center gap-2.5 truncate">
                    <FileCheck2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {phenotypeFile.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                        {(phenotypeFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhenotypeFile(null);
                      setUploadResult(null);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white active:scale-95 transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => phenoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0F172E]/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 active:scale-[0.99] transition-all text-center group"
                >
                  <UploadCloud className="h-8 w-8 text-[#5B4DFE] mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-white">
                    Pilih atau Seret Berkas CSV ke Sini
                  </span>
                  <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Encoding UTF-8</span>
                </div>
              )}

              <input
                ref={phenoInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handlePhenotypeSelect(e.target.files[0]);
                }}
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 text-[#5B4DFE]" />
              <span>Contoh kolom sifat: bobot_umbi_g, diameter_umbi_mm, jumlah_siung.</span>
            </div>
          </div>
        </div>

        {/* Tombol Unggah & Validasi (Figma Primary CTA) */}
        <div className="flex justify-center pt-2">
          <button
            type="submit"
            disabled={isUploading || !genotypeFile || !phenotypeFile}
            className="inline-flex items-center gap-2 rounded-xl bg-[#5B4DFE] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#5B4DFE]/30 hover:bg-[#4F46E5] hover:-translate-y-[1px] hover:shadow-xl active:scale-[0.97] active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all duration-100"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Memvalidasi Format & Mencocokkan Sample ID...</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                <span>Unggah & Validasi Berkas Sekarang</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Panel Hasil Validasi Sukses (200 OK - AC-02.1 with Reveal Animation) ── */}
      {uploadResult && (
        <div className="rounded-3xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 p-5 sm:p-7 shadow-xl backdrop-blur-md animate-pop-in space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200 dark:border-emerald-500/20 pb-3.5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Validasi Dataset Berhasil! (100% Sample ID Cocok)
                </h3>
                <span className="text-xs text-emerald-800 dark:text-emerald-400 font-medium">
                  {uploadResult.pesan || 'Berkas valid dan siap dikonfigurasi.'}
                </span>
              </div>
            </div>
            <span className="self-start sm:self-auto rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-3.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
              Status: Tervalidasi
            </span>
          </div>

          {/* Grid Metrik Dataset (Hero Stats dengan Neuton Serif) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-subcard p-3.5 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-sans font-medium">
                Sampel Cocok
              </span>
              <div className="font-serif text-2xl font-bold text-[#5B4DFE] dark:text-[#06B6D4] tabular-nums mt-1">
                {uploadResult.genotipe?.jumlah_sampel || uploadResult.kecocokan_sample_id?.jumlah_sampel_cocok || 0}
              </div>
            </div>

            <div className="glass-subcard p-3.5 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-sans font-medium">
                Jumlah SNP
              </span>
              <div className="font-serif text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
                {uploadResult.genotipe?.jumlah_snp || 0}
              </div>
            </div>

            <div className="glass-subcard p-3.5 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-sans font-medium">
                Varian Dilewati
              </span>
              <div className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400 mt-2">
                {uploadResult.genotipe?.varian_dilewati?.multialelik || 0} Multialelik
              </div>
            </div>

            <div className="glass-subcard p-3.5 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-sans font-medium">
                Varietas Tercatat
              </span>
              <div className="font-serif text-2xl font-bold text-[#5B4DFE] dark:text-[#38BDF8] tabular-nums mt-1">
                {uploadResult.fenotipe?.varietas_tercatat || 0}
              </div>
            </div>
          </div>

          {/* Sifat Fenotipe Tersedia */}
          {uploadResult.fenotipe?.sifat_tersedia && (
            <div className="glass-subcard p-4 space-y-2">
              <span className="text-xs font-semibold font-sans text-slate-700 dark:text-slate-300 block">
                Sifat Fenotipe yang Terdeteksi dalam CSV:
              </span>
              <div className="flex flex-wrap gap-2">
                {uploadResult.fenotipe.sifat_tersedia.map((trait) => (
                  <span
                    key={trait}
                    className="inline-flex items-center gap-1 rounded-xl border border-cyan-300 dark:border-[#06B6D4]/30 bg-cyan-50 dark:bg-[#06B6D4]/10 px-3 py-1 text-xs font-serif italic font-medium text-cyan-900 dark:text-[#06B6D4]"
                  >
                    <span>{trait}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tombol Lanjut ke Step 2 */}
          <div className="flex justify-end pt-3">
            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5B4DFE] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#5B4DFE]/30 hover:bg-[#4F46E5] hover:-translate-y-[1px] hover:shadow-xl active:scale-[0.97] active:brightness-95 transition-all duration-100"
            >
              <span>Lanjut ke Konfigurasi Parameter (Langkah 2)</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
