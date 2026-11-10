"""M-06: visualisasi hasil analisis.

- png.py         : ekspor Manhattan/QQ plot ke PNG (FR-09), butuh matplotlib
- downsample.py  : smart downsampling titik Manhattan plot (tanpa matplotlib)

png diimpor saat dibutuhkan saja, agar modul lain tetap bisa dipakai walau
matplotlib belum terpasang.
"""
from pipeline.visualization.downsample import smart_downsample

__all__ = ["manhattan_png", "qq_png", "smart_downsample"]


def __getattr__(name):
    if name in ("manhattan_png", "qq_png"):
        from pipeline.visualization import png

        return getattr(png, name)
    raise AttributeError(name)
