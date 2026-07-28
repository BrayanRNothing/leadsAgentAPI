# Contexto del Proyecto: Leads Agent API (CRM Automatizado)

## 📌 Objetivo General
Un CRM inteligente automatizado para prospección B2B. El sistema extrae prospectos (Leads) masivamente de fuentes como Google Maps y DENUE (INEGI), gestiona campañas de correos electrónicos en frío (Outbound) simulando comportamiento humano a través de n8n, y utiliza Inteligencia Artificial (Groq/LLaMA 3) para leer, interpretar y clasificar automáticamente las respuestas de los clientes (Inbound).

## 🛠️ Tech Stack
- **Frontend:** React (Vite), TailwindCSS, Framer Motion (Diseño Premium Glassmorphism).
- **Backend:** Node.js (Express).
- **Base de Datos:** PostgreSQL manejado con Prisma ORM.
- **Infraestructura:** Desplegado como Monorepo en Railway (`https://leadsagentapi-production.up.railway.app`).
- **Automatización:** n8n (Manejo de triggers de Gmail y loops de envío).
- **Inteligencia Artificial:** SDK de Groq (modelo `llama-3.1-8b-instant`).

## 🏗️ Arquitectura y Flujo de Vida de un Lead
El sistema opera en 5 etapas claramente definidas:

### 1. La Mina (Base Gigante)
- Los prospectos se extraen y almacenan en las tablas `Lead` y `InegiLead` con un `pipelineState` inicial de `NEW`.
- El frontend tiene vistas separadas para mapear (ScrapingView) y para consultar el padrón de INEGI (InegiView).

### 2. La Cola de Espera (Campañas)
- Al iniciar una campaña, se seleccionan leads y se mueven al estado `CONTACTING`.
- A partir de este momento, están listos para ser consumidos por el sistema de envíos.

### 3. El Cartero (n8n Outbound Workflow)
- **Trigger:** Schedule Trigger (ej. cada 15 minutos).
- **Proceso:** n8n consume el endpoint `/api/n8n/leads-outbound?limit=5`. Recibe un lote de leads.
- **Bucle y Retraso (Vital):** Usa un nodo `Loop` y un nodo `Wait` de 45-60 segundos entre cada envío usando el nodo de `Gmail`. Esto previene baneos por SPAM.
- **Confirmación:** Una vez enviado, n8n hace un POST a `/api/n8n/mark-sent` para pasar el lead al estado `SENT`.

### 4. El Recepcionista (n8n Inbound Workflow)
- **Trigger:** `Gmail Trigger (On new Email)`. Está permanentemente dormido hasta que un correo llega a la bandeja de entrada (INBOX).
- **Webhook:** Inmediatamente envía el cuerpo del correo y el remitente al backend mediante el endpoint `/api/n8n/webhooks/email-reply`.

### 5. El Cerebro IA (Clasificación)
- **Filtro de SPAM/Errores:** Si el correo recibido es del propio usuario (ej. un correo saliente que Gmail detectó) o no está en la BD de leads, el backend lo ignora silenciosamente devolviendo `success: true, ignored: true`.
- **Análisis Groq:** Si el lead existe, se le pasa el texto (limpio de historial) al modelo de Groq junto con un JSON llamado `knowledgeBase` (que contiene info de la empresa, servicios, precios y enlaces).
- **Clasificación:**
  - `INTERESTED` -> Pasa a Interesados.
  - `MEETING` -> Pasa a Interesados. Genera correo sugiriendo cita en Calendly e instruyendo poner en CC a `cesar.zd@gmail.com`.
  - `DOUBT` -> Vuelve a la columna `REPLIED`. Genera respuesta sugerida.
  - `NOT_INTERESTED` -> Estado `discarded`. En el frontend (PipelineView) se renderiza tachado y opaco.

## 📊 Interfaz y UI (Frontend)
- **BentoGrid (Home):** Muestra el estado global de la base de datos, incluyendo una barra de progreso que lee del endpoint `/api/ai-stats` para contabilizar los tokens gastados en las peticiones a Groq frente a un límite virtual (ej. 500,000).
- **PipelineView:** Un tablero estilo Kanban súper estilizado (Glassmorphism, animaciones suaves con Framer Motion, avatares y botones) para gestionar visualmente a los leads que respondieron.

## 🚀 Estado Actual y Siguientes Pasos
**Estado:** La Fase 1 (Extracción, Encolado, Envío, Recepción y Clasificación Visual) está **completa, testeada y estable**.

**Siguientes pasos sugeridos:**
1. **Acciones Inbound Automáticas:** Lograr que la sugerencia que genera la IA para estados como `DOUBT` o `MEETING` se envíe automáticamente de vuelta al cliente llamando de nuevo a n8n desde el backend, cerrando el ciclo completamente de forma autónoma.
2. **Edición dinámica del Knowledge Base:** Crear una vista en el Frontend para que el usuario pueda editar el JSON de `knowledgeBase` (servicios, precios, Calendly) sin tocar el código de `n8n.js`.
