import { useEffect, useState } from "react";
import Stepper from "./components/Stepper.jsx";
import StatusPanel from "./components/StatusPanel.jsx";
import UploadStep from "./components/UploadStep.jsx";
import { api } from "./services/api.js";

const STATUS_LABEL = {
  berfungsi: "berfungsi",
  sebagian: "sebagian",
  kerangka: "kerangka siap",
  belum: "belum dibuat",
};

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState(null);
  const [health, setHealth] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [h, m] = await Promise.all([api.health(), api.meta()]);
      setHealth(h);
      setMeta(m);
    } catch (e) {
      setHealth(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const handleUploadComplete = (files) => {
    setUploadedFiles(files);
    setCurrentStep(1); // Berpindah ke tahap 2: Konfigurasi
  };

  const org = meta?.organisme;

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">GWASena</span>
        <nav className="nav">
          <a href="#" aria-current="page">Dashboard</a>
          <a href="#">Riwayat Analisis</a>
        </nav>
      </header>

      <main className="content">
        <Stepper active={currentStep} />

        <h1>Analisis GWAS bawang putih</h1>
        <p className="lead">
          Platform analisis Genome-Wide Association Study terpadu untuk komoditas bawang putih.
        </p>

        {/* Form Upload & Validasi (Target Progres Minggu 7) */}
        {currentStep === 0 && (
          <UploadStep onNext={handleUploadComplete} />
        )}

        {/* Tampilan Konfigurasi jika form upload selesai */}
        {currentStep === 1 && (
          <section className="panel" style={{ marginTop: "1.5rem" }}>
            <h2>2. Konfigurasi Parameter QC & Model</h2>
            <p className="muted">Berkas berhasil divalidasi di browser:</p>
            <ul>
              <li>Genotipe: <strong>{uploadedFiles?.genotypeFile?.name}</strong></li>
              <li>Fenotipe: <strong>{uploadedFiles?.phenotypeFile?.name}</strong></li>
            </ul>
            <button
              onClick={() => setCurrentStep(0)}
              style={{ marginTop: "1rem", padding: "0.5rem 1rem", cursor: "pointer" }}
            >
              ← Kembali ke Unggah Berkas
            </button>
          </section>
        )}

        <StatusPanel health={health} error={error} loading={loading} onRefresh={load} />

        {org && (
          <section className="panel">
            <h2>Organisme target</h2>
            <p className="species">
              <em>{org.nama_ilmiah}</em> · {org.nama_umum}, {org.ploidi}, {org.jumlah_kromosom} kromosom
            </p>
            <p className="muted">Contoh sifat yang dianalisis:</p>
            <ul className="traits">
              {org.contoh_sifat_fenotipe.map((t) => (
                <li key={t.kolom}>
                  {t.label} <span className="muted">({t.satuan})</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {meta && (
          <section className="panel">
            <h2>Modul pipeline</h2>
            <ul className="modules">
              {meta.modul.map((m) => (
                <li key={m.id}>
                  <span className="mod-id">{m.id}</span>
                  <span>{m.nama}</span>
                  <span className={`badge ${m.status}`}>{STATUS_LABEL[m.status] || m.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}