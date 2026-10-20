"""Skema masukan API (Pydantic). Keterangan field tampil di Swagger UI."""
from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$",
                          examples=["isnaini"])
    email: str = Field(max_length=120, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
                       examples=["isnaini@apps.ipb.ac.id"])
    password: str = Field(min_length=8, max_length=128, examples=["rahasia123"])


class LoginIn(BaseModel):
    username: str = Field(description="Username atau email", examples=["isnaini"])
    password: str = Field(examples=["rahasia123"])


class AnalysisCreate(BaseModel):
    analysis_name: str = Field(min_length=1, max_length=150,
                               examples=["GWAS bobot umbi bawang putih"])
