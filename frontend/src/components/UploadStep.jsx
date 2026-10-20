import { useState } from "react";

export default function UploadStep({ onNext }) {
  const [genotypeFile, setGenotypeFile] = useState(null);
  const [phenotypeFile, setPhenotypeFile] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Validasi format genotipe (.vcf, .vcf.gz, atau biner PLINK: .bed, .bim, .fam)
  const handleGenotypeChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowed = [".vcf", ".gz", ".bed", ".bim", ".fam"];
    const isValid = allowed.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!isValid) {
      setErrorMsg("Format berkas genotipe harus .vcf, .vcf.gz, atau format PLINK (.bed/.bim/.fam)!");
      setGenotypeFile(null);
    } else {
      setErrorMsg("");
      setGenotypeFile(file);
    }
  };

  // Validasi format fenotipe (.csv)
  const handlePhenotypeChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMsg("Format berkas fenotipe harus berekstensi .csv!");
      setPhenotypeFile(null);
    } else {
      setErrorMsg("");
      setPhenotypeFile(file);
    }
  };

  const handleContinue = (e) => {
    e.preventDefault();
    if (genotypeFile && phenotypeFile) {
      onNext?.({ genotypeFile, phenotypeFile });
    }
  };

  return (
    <section className="panel" style={{ marginTop: "1.5rem" }}>
      <h2>1. Unggah Berkas Analisis</h2>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Unggah berkas genomik genotipe dan metadata fenotipe sampel bawang putih.
      </p>

      {errorMsg && (
        <div style={{ background: "#7f1d1d", color: "#fca5a5", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem" }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleContinue}>
        {/* Upload Genotipe */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem" }}>
            Berkas Genotipe (VCF / PLINK)
          </label>
          <input
            type="file"
            onChange={handleGenotypeChange}
            style={{ display: "block", width: "100%", padding: "0.5rem", background: "rgba(255,255,255,0.05)", borderRadius: "6px" }}
          />
          {genotypeFile && (
            <small style={{ color: "#4ade80", display: "block", marginTop: "0.25rem" }}>
              ✓ Terpilih: {genotypeFile.name} ({(genotypeFile.size / 1024).toFixed(1)} KB)
            </small>
          )}
        </div>

        {/* Upload Fenotipe */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem" }}>
            Berkas Fenotipe (.CSV)
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handlePhenotypeChange}
            style={{ display: "block", width: "100%", padding: "0.5rem", background: "rgba(255,255,255,0.05)", borderRadius: "6px" }}
          />
          {phenotypeFile && (
            <small style={{ color: "#4ade80", display: "block", marginTop: "0.25rem" }}>
              ✓ Terpilih: {phenotypeFile.name} ({(phenotypeFile.size / 1024).toFixed(1)} KB)
            </small>
          )}
        </div>

        <button
          type="submit"
          disabled={!genotypeFile || !phenotypeFile}
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: genotypeFile && phenotypeFile ? "#2563eb" : "#475569",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: "600",
            cursor: genotypeFile && phenotypeFile ? "pointer" : "not-allowed",
          }}
        >
          Lanjut ke Konfigurasi Parameter →
        </button>
      </form>
    </section>
  );
}