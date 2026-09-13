# Rancangan: AI Video Generation Platform (MVP)

> Status: **konsep/desain — belum ada implementasi kode.** Dokumen ini adalah source of truth sebelum masuk ke Prisma schema & pembuatan halaman. Update dokumen ini kalau ada keputusan yang berubah.

---

## 1. Analisis Masalah

**Apa yang sebenarnya dijual produk ini?** Bukan "generate 1 video AI" — itu sudah banyak tool-nya (Runway, Pika, dll). Yang jadi nilai jual adalah **konsistensi lintas episode**: karakter yang sama, gaya visual yang sama, dan cerita yang nyambung dari episode 1 ke episode 50, dijalankan sebagai pipeline semi-otomatis per project.

Konsekuensinya, dua entity paling kritis di sistem ini adalah:
- **`character_bible`** — identity lock (deskripsi visual + reference image) yang dipakai berulang di setiap prompt generation supaya karakter tidak "drift" antar episode.
- **`continuity_state`** — ringkasan naratif ("apa yang sudah terjadi") yang jadi konteks buat idea engine episode berikutnya.

Kalau dua hal ini tidak dirancang dengan baik sejak awal, seluruh pipeline generation di atasnya jadi tidak berguna (hasil video bagus per-episode tapi tidak nyambung sebagai series). Maka desain data model harus dimulai dari sini, bukan dari CRUD project/episode.

**Tantangan teknis utama yang harus diantisipasi dari awal:**

| Tantangan | Kenapa penting | Implikasi desain |
|---|---|---|
| Generation itu **long-running** (bisa menitan–puluhan menit per episode) | Request-response biasa (Server Action / Route Handler) akan timeout | Perlu job/queue system async, bukan synchronous call |
| Tiap stage bisa **regenerate independen** | User approve stage 1, reject stage 3 → jangan re-run semua dari awal | Episode harus disimpan sebagai state machine per-stage, bukan 1 kolom status |
| Asset yang dihasilkan (image, audio, video) **besar** | Tidak masuk akal disimpan sebagai blob di Postgres | Perlu object storage (S3-compatible), DB cuma simpan URL/metadata |
| Tiap generation **memanggil API berbayar** (LLM, image gen, voice gen, music gen, render) | Biaya bisa membengkak tanpa disadari kalau user spam regenerate | Perlu tracking cost per stage/episode, minimal buat log |
| **Provider AI bisa ganti-ganti** (image model, voice model, dll) | Settings halaman 6 punya "API keys (model provider)" → berarti harus pluggable | Service layer harus abstraksi per capability (text-to-image, tts, music, video-assembly), bukan hardcode 1 vendor |
| **continuity_state bisa membengkak** seiring makin banyak episode | Kalau semua histori dimasukkan mentah ke prompt LLM, kena limit token & jadi mahal | Perlu strategi ringkasan (rolling summary), bukan append log mentah |

---

## 2. Target Pengguna & Lingkup MVP

- Pengguna: single user/creator per akun (auth sudah tersedia dari template — `NextAuth`), belum perlu multi-tenant/team.
- Jenis konten: kartun anak episodic, self-face reels, realistic short, short film — dibedakan lewat `project.type` yang menentukan default config (bukan halaman terpisah per jenis).
- **Di luar lingkup MVP** (sengaja ditunda): analytics, publishing scheduler ke sosmed, multi-user/team, billing/subscription.

---

## 3. Arsitektur Informasi (6 Halaman)

```
/dashboard                          → 1. Dashboard
/projects/new                       → 2. New Project (wizard)
/projects/[id]                      → 3. Project Detail
/projects/[id]/edit                 → 2. Edit Project (form sama, mode edit)
/projects/[id]/episodes/[epId]      → 4. Episode Detail / Review
/projects/[id]/assets                → 5. Character/Asset Library
/settings                           → 6. Settings
```

Mengikuti [STRUCTURE.md](../blueprint/STRUCTURE.md), semua di bawah `src/app/[locale]/(protected)/...`, data lewat Service layer (bukan fetch langsung di komponen), form pakai Zod schema, state server via TanStack Query, state UI lokal (step wizard, modal) via Zustand kalau perlu lintas komponen.

### 3.1 Dashboard
- Grid card project: nama, jenis, thumbnail episode terakhir, jumlah episode, status ringkas.
- Empty state kalau belum ada project.
- CTA "+ New Project".

### 3.2 New / Edit Project
Form (Zod schema `projectSchema`):

| Field | Tipe | Catatan |
|---|---|---|
| `name` | string | required |
| `type` | enum: `KIDS_CARTOON` \| `SELF_FACE` \| `REALISTIC` \| `SHORT_FILM` | menentukan default video config & style preset |
| `referenceImage` | file upload | jadi seed `character_bible` |
| `premise` | text area | story premise / world description |

**Video Config** (bagian dari project, bukan global settings — tiap project beda kebutuhan durasi/rasio):

| Field | Contoh | Constraint |
|---|---|---|
| `aspectRatio` | `9:16` / `16:9` / `1:1` | enum |
| `resolution` | `720p` / `1080p` / `4K` | enum |
| `targetTotalDuration` | detik, misal 60 / 300 | integer, min 1 |
| `sceneDurationMin` / `sceneDurationMax` | detik, default 4–8 | integer, `min <= max` |

Validasi turunan (dijalankan di client & service layer):
```
estimatedScenes = round(targetTotalDuration / avgSceneDuration)
```
Kalau `estimatedScenes < 3` → tampilkan warning non-blocking: "Kombinasi durasi ini mungkin menghasilkan cerita yang kurang nyambung (~N scene)."

Submit → create `Project` row + trigger job `generate_character_bible` (async, lihat §5) → redirect ke Project Detail dengan status "Character bible sedang dibuat".

### 3.3 Project Detail
- Header: info project + tombol edit config.
- Tabel episode: nomor, status (`DRAFT` / `GENERATING` / `READY_FOR_REVIEW` / `DONE` / `FAILED`), tanggal, tombol lanjut ke detail.
- Tombol "+ Generate New Episode" → create `Episode` row, mulai pipeline dari stage `IDEA`.

### 3.4 Episode Detail / Review
Halaman paling penting untuk kontrol kualitas. Tiap **stage** adalah unit terpisah, bukan progress bar tunggal:

```
IDEA → SCRIPT → SCENES → VOICE → MUSIC → RENDER
```

Tiap stage card menampilkan:
- Status: `PENDING` / `GENERATING` / `READY` / `APPROVED` / `FAILED`
- Preview hasil (text untuk Idea/Script, gambar/video untuk Scenes, audio player untuk Voice/Music, video player untuk Render)
- Tombol **Approve** (lanjut ke stage berikutnya) / **Regenerate** (ulang stage ini saja, pakai input yang sama)
- Auto-lanjut ke stage berikutnya kalau user approve tanpa mengubah apa pun — tapi tetap butuh 1 klik approve per stage di MVP (bukan full-auto), sesuai instruksi awal: kontrol kualitas per-stage lebih penting daripada kecepatan.

Status generation berjalan async → UI polling via TanStack Query (`refetchInterval`) selama status stage = `GENERATING`.

### 3.5 Character/Asset Library
- List reference image, voice ID/sample, style reference yang sudah dikunci di `character_bible`.
- Tombol "Reset/Update" per asset — dengan warning bahwa ini bisa mempengaruhi konsistensi episode berikutnya (bukan episode yang sudah jadi).

### 3.6 Settings
- API keys per provider (disimpan terenkripsi, bukan plaintext — lihat §6 catatan keamanan).
- Default negative prompt template.
- Koneksi n8n webhook (URL + secret, untuk notifikasi status pipeline selesai/gagal).

---

## 4. Data Model (Konseptual)

Level ERD dulu — belum ditulis sebagai `.prisma` final (itu langkah setelah dokumen ini disetujui).

```
Project 1---N Episode
Project 1---1 CharacterBible   (bisa versioned: CharacterBible 1---N CharacterBibleVersion, kalau reset)
Project 1---1 ContinuityState  (accumulating summary, di-update tiap episode selesai)
Episode 1---N EpisodeStage     (6 row per episode: IDEA/SCRIPT/SCENES/VOICE/MUSIC/RENDER)
EpisodeStage 1---N Asset       (gambar/audio/video yang dihasilkan stage tsb, simpan URL ke object storage)
Project 1---N ApiKey           (per provider, terenkripsi)
```

Field penting yang perlu dipikirkan sejak schema (bukan ditambah belakangan):
- `EpisodeStage.status`, `EpisodeStage.attempt` (counter regenerate — buat cost tracking), `EpisodeStage.costEstimate`
- `CharacterBible.lockedTraits` (JSON: deskripsi visual terkunci) + `referenceImageUrl`
- `ContinuityState.summary` (text yang di-update tiap episode approved) — strategi: LLM merangkum ulang tiap kali, bukan append tak terbatas
- `Project.videoConfig` sebagai embedded JSON atau kolom terpisah (`aspectRatio`, `resolution`, `targetTotalDuration`, `sceneDurationMin/Max`)

---

## 5. Pipeline Generate Episode (Async)

```
[Trigger: user klik "Generate Episode" / "Approve" stage sebelumnya]
        │
        ▼
Job Queue (background worker, BUKAN inline di Server Action)
        │
        ├─ IDEA:   story_bible + continuity_state → LLM → beat ide
        ├─ SCRIPT: LLM → scene breakdown JSON
        │           jumlah scene dihitung dari videoConfig (§3.2)
        ├─ SCENES: loop tiap scene → compose prompt (character_bible + style) → text-to-image/video provider
        ├─ VOICE:  dialog/narration → TTS provider (pakai voice ID dari Asset Library)
        ├─ MUSIC:  generate atau ambil preset backsound
        ├─ RENDER: assembly semua asset jadi 1 video sesuai aspectRatio & resolution project
        └─ update ContinuityState, set Episode.status = READY_FOR_REVIEW
```

**Keputusan arsitektur yang perlu diambil sebelum implementasi** (belum diputuskan — lihat §7):
- Job queue pakai apa: worker terpisah (BullMQ + Redis), platform durable-execution (Inngest/Trigger.dev), atau full-delegasi ke n8n sebagai orchestrator (Settings sudah menyediakan slot n8n webhook, jadi n8n bisa dipakai bukan cuma buat notifikasi tapi jadi orchestrator pipeline itu sendiri)
- Video assembly: ffmpeg di server sendiri vs service pihak ketiga (Shotstack, Remotion render, dll)
- Storage: S3-compatible mana (Cloudflare R2 / AWS S3 / Supabase Storage)

---

## 6. Catatan Keamanan & Biaya

- API key provider di Settings **harus dienkripsi at-rest** (jangan simpan plaintext di kolom Postgres) — pakai `crypto` Node dengan key dari env var, bukan hash (karena perlu dibaca ulang untuk dipakai).
- Setiap pemanggilan provider berbayar dicatat sebagai log biaya minimal (provider, stage, timestamp, estimasi cost) supaya user bisa lihat "kenapa bill saya segini" — tidak perlu dashboard analytics penuh di MVP, cukup kolom `costEstimate` di `EpisodeStage`.

---

## 7. Open Questions → RESOLVED

Keputusan arsitektur ini sudah dijawab di [README.md](./README.md) ("Default stack decisions") dan [ARCHITECTURE.md](./ARCHITECTURE.md). Ringkas:

1. Orchestrator: **LangGraph.js** (state graph + Postgres checkpointer), dijalankan durable via **Inngest**. n8n dipakai untuk notifikasi/automation, bukan pipeline runner utama.
2. Provider AI: **fal.ai / Replicate** sebagai aggregator (banyak model image/video di satu API), **ElevenLabs** untuk TTS, **Claude** untuk reasoning/scripting — semua pluggable lewat provider registry ([T03](./tasks/T03-provider-registry.md)).
3. Video assembly: **ffmpeg** untuk MVP (Remotion opsi lanjutan).
4. Object storage: **Cloudflare R2** (S3-compatible).
5. MVP tetap **single-user** (pakai auth yang sudah ada), tapi setiap tabel sudah punya `ownerId`/`projectId` sehingga migrasi ke multi-tenant nanti minim perubahan.

> Arsitektur lengkap (MCP + LangChain + multi-provider + asset-mention) ada di [ARCHITECTURE.md](./ARCHITECTURE.md); breakdown task di [tasks/](./tasks/).

---

## 8. Fase Pengembangan (usulan urutan build)

1. **Fase 0** — Prisma schema (`Project`, `Episode`, `EpisodeStage`, `CharacterBible`, `ContinuityState`, `Asset`, `ApiKey`) + auth yang sudah ada.
2. **Fase 1** — Halaman 1, 2, 3 (CRUD project + list episode), tanpa generation asli dulu (stub/mock character_bible).
3. **Fase 2** — Halaman 4 (Episode Detail) dengan stage state machine + tombol approve/regenerate, generation masih manual-trigger per stage (belum full pipeline otomatis).
4. **Fase 3** — Sambungkan job queue/orchestrator asli + provider AI asli, full pipeline `IDEA → RENDER`.
5. **Fase 4** — Halaman 5 & 6 (Asset Library, Settings + n8n webhook + enkripsi API key).

---

## Referensi Terkait

- [docs/blueprint/DATABASE.md](../blueprint/DATABASE.md) — konvensi Prisma & auth yang harus diikuti saat schema dibuat
- [docs/blueprint/SERVICES.md](../blueprint/SERVICES.md) — pola service layer untuk provider abstraction
- [docs/blueprint/STATE.md](../blueprint/STATE.md) — Zustand untuk state UI (wizard, stage panel)
