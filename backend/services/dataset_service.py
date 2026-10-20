"""Penyimpanan berkas unggahan dan pengisian tabel data (M-02, FR-02, FR-11)."""
import shutil
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.models import (
    SNP,
    AnalysisLog,
    AssociationResult,
    Dataset,
    Genotype,
    Phenotype,
    Sample,
    VisualizationResult,
)
from pipeline.errors import ValidationError
from pipeline.validation import GenotypeData, PhenotypeData

GENOTYPE_EXT = (".vcf", ".vcf.gz")
PLINK_EXT = (".bed", ".bim", ".fam")


def analysis_dir(analysis_id: int) -> Path:
    return settings.UPLOAD_DIR / f"analysis_{analysis_id}"


def check_extensions(genotype_name: str, phenotype_name: str) -> None:
    g, p = (genotype_name or "").lower(), (phenotype_name or "").lower()
    errors = []
    if g.endswith(PLINK_EXT):
        errors.append("Format PLINK biner (.bed/.bim/.fam) belum didukung pada versi ini; "
                      "gunakan berkas VCF (.vcf atau .vcf.gz).")
    elif not g.endswith(GENOTYPE_EXT):
        errors.append(f"Berkas genotipe '{genotype_name}' harus berformat .vcf atau .vcf.gz.")
    if not p.endswith(".csv"):
        errors.append(f"Berkas fenotipe '{phenotype_name}' harus berformat .csv.")
    if errors:
        raise ValidationError("Format berkas tidak didukung.", errors)


def save_upload(upload: UploadFile, target: Path) -> None:
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    written = 0
    with open(target, "wb") as out:
        while chunk := upload.file.read(1024 * 1024):
            written += len(chunk)
            if written > limit:
                raise ValidationError(
                    f"Ukuran berkas '{upload.filename}' melebihi batas {settings.MAX_UPLOAD_MB} MB."
                )
            out.write(chunk)
    if written == 0:
        raise ValidationError(f"Berkas '{upload.filename}' kosong.")


def clear_analysis_data(db: Session, analysis_id: int) -> None:
    """Menghapus data unggahan dan hasil lama milik satu analisis."""
    clear_results(db, analysis_id)
    ds_ids = select(Dataset.dataset_id).where(Dataset.analysis_id == analysis_id)
    sample_ids = select(Sample.sample_id).where(Sample.dataset_id.in_(ds_ids))
    db.execute(delete(Genotype).where(Genotype.sample_id.in_(sample_ids)), execution_options={"synchronize_session": False})
    db.execute(delete(Phenotype).where(Phenotype.sample_id.in_(sample_ids)), execution_options={"synchronize_session": False})
    db.execute(delete(SNP).where(SNP.dataset_id.in_(ds_ids)), execution_options={"synchronize_session": False})
    db.execute(delete(Sample).where(Sample.dataset_id.in_(ds_ids)), execution_options={"synchronize_session": False})
    db.execute(delete(Dataset).where(Dataset.analysis_id == analysis_id), execution_options={"synchronize_session": False})


def clear_results(db: Session, analysis_id: int) -> None:
    db.execute(delete(AssociationResult).where(AssociationResult.analysis_id == analysis_id), execution_options={"synchronize_session": False})
    db.execute(delete(VisualizationResult).where(VisualizationResult.analysis_id == analysis_id), execution_options={"synchronize_session": False})
    db.execute(delete(AnalysisLog).where(AnalysisLog.analysis_id == analysis_id), execution_options={"synchronize_session": False})


def store_datasets(
    db: Session,
    analysis_id: int,
    genotype_name: str,
    genotype_path: Path,
    phenotype_name: str,
    phenotype_path: Path,
    geno: GenotypeData,
    pheno: PhenotypeData,
) -> dict:
    ds_geno = Dataset(analysis_id=analysis_id, file_name=genotype_name, file_type="vcf",
                      file_path=str(genotype_path), validation_status="valid")
    ds_pheno = Dataset(analysis_id=analysis_id, file_name=phenotype_name, file_type="phenotype_csv",
                       file_path=str(phenotype_path), validation_status="valid")
    db.add_all([ds_geno, ds_pheno])
    db.flush()

    samples = [Sample(dataset_id=ds_geno.dataset_id, sample_code=s, variety=pheno.variety.get(s))
               for s in geno.samples]
    db.add_all(samples)
    snps = [SNP(dataset_id=ds_geno.dataset_id, variant_code=geno.ids[j], chromosome=geno.chrom[j],
                position=geno.pos[j], ref_allele=geno.ref[j], alt_allele=geno.alt[j])
            for j in range(geno.n_snps)]
    db.add_all(snps)
    db.flush()

    sample_pk = {s.sample_code: s.sample_id for s in samples}
    genotype_stored = geno.n_samples * geno.n_snps <= settings.MAX_GENOTYPE_ROWS
    if genotype_stored:
        rows = []
        for i, s in enumerate(geno.samples):
            for j, snp in enumerate(snps):
                v = geno.dosage[i, j]
                rows.append({"sample_id": sample_pk[s], "snp_id": snp.snp_id,
                             "genotype_value": None if v != v else int(v)})
        db.execute(insert(Genotype), rows)

    pheno_rows = []
    for trait, values in pheno.traits.items():
        for idx, s in enumerate(pheno.samples):
            v = values[idx]
            pheno_rows.append({"sample_id": sample_pk[s], "trait_name": trait,
                               "phenotype_value": None if v != v else float(v)})
    db.execute(insert(Phenotype), pheno_rows)

    return {
        "genotipe": {
            "nama_berkas": genotype_name,
            "jumlah_sampel": geno.n_samples,
            "jumlah_snp": geno.n_snps,
            "varian_dilewati": geno.skipped,
            "genotipe_disimpan_ke_tabel": genotype_stored,
        },
        "fenotipe": {
            "nama_berkas": phenotype_name,
            "jumlah_sampel": len(pheno.samples),
            "sifat_tersedia": pheno.trait_names,
            "varietas_tercatat": len(pheno.variety),
        },
    }


def available_traits(db: Session, analysis_id: int) -> list[str]:
    stmt = (
        select(Phenotype.trait_name)
        .join(Sample, Sample.sample_id == Phenotype.sample_id)
        .join(Dataset, Dataset.dataset_id == Sample.dataset_id)
        .where(Dataset.analysis_id == analysis_id)
        .distinct()
    )
    return sorted(db.scalars(stmt).all())


def dataset_paths(db: Session, analysis_id: int) -> tuple[str | None, str | None]:
    rows = db.scalars(select(Dataset).where(Dataset.analysis_id == analysis_id)).all()
    geno = next((d.file_path for d in rows if d.file_type == "vcf"), None)
    pheno = next((d.file_path for d in rows if d.file_type == "phenotype_csv"), None)
    return geno, pheno


def remove_dir(analysis_id: int) -> None:
    shutil.rmtree(analysis_dir(analysis_id), ignore_errors=True)
