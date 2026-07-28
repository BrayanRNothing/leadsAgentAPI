-- CreateEnum
CREATE TYPE "PipelineState" AS ENUM ('NEW', 'SELECTED', 'CONTACTING', 'SENT', 'REPLIED', 'INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP', 'DISCARDED');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "sitioWeb" TEXT,
    "correo" TEXT,
    "direccion" TEXT,
    "categoria" TEXT,
    "terminoBusqueda" TEXT NOT NULL,
    "ubicacion" TEXT,
    "calificacion" DOUBLE PRECISION,
    "reviews" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "redesSociales" JSONB,
    "fuente" TEXT DEFAULT 'maps',
    "status" TEXT NOT NULL DEFAULT 'active',
    "pipelineState" "PipelineState" NOT NULL DEFAULT 'NEW',
    "contactoEstado" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampanaCorreo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'draft',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampanaCorreo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadMensaje" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "campanaId" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pending',
    "mensajeId" TEXT,
    "enviadoEn" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "LeadMensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InegiLead" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "sitioWeb" TEXT,
    "correo" TEXT,
    "direccion" TEXT,
    "categoria" TEXT,
    "terminoBusqueda" TEXT NOT NULL,
    "ubicacion" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InegiLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- AddForeignKey
ALTER TABLE "LeadMensaje" ADD CONSTRAINT "LeadMensaje_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadMensaje" ADD CONSTRAINT "LeadMensaje_campanaId_fkey" FOREIGN KEY ("campanaId") REFERENCES "CampanaCorreo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
