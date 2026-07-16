import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Support health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!apiKey,
    time: new Date().toISOString(),
  });
});

// Helper for generating standard guidelines for CP 2026 per grade
function getGradeCP2026Guidelines(kelas: string, materi: string): string {
  if (kelas.includes("VII")) {
    return `
Khusus Kelas VII (Fase D awal):
- Sesuaikan tingkat kesulitan untuk peserta didik yang baru transisi dari SD memasuki SMP.
- Fokus pada pemahaman konsep dasar (mental model dasar), visualisasi, dan aktivitas unplugged atau semi-plugged.
- Jika materi Berpikir Komputasional: fokus pada pengenalan persoalan sehari-hari yang mengandung struktur data sederhana (list, stack, queue) secara intuitif, pengenalan algoritma sederhana, dekomposisi masalah sederhana.
- Jika materi Sistem Komputer: pengenalan perangkat keras (hardware) dan perangkat lunak (software) serta interaksi dasar manusia dengan komputer.
- Jika materi Algoritma Pemrograman: gunakan pemrograman visual block-based seperti Scratch atau Blockly dengan logika runtutan (sequencing) dasar.
- Hubungkan dengan konteks transisi SMP yang bersahabat dan kolaboratif.
`;
  } else if (kelas.includes("VIII")) {
    return `
Khusus Kelas VIII (Fase D menengah):
- Tekankan pada penguatan konsep, penerapan praktis, dan proyek kolaboratif yang lebih menantang.
- Peserta didik sudah mampu berpikir abstrak lebih baik.
- Jika materi Analisis Data: fokus pada pengolahan data dengan perkakas pengolah lembar kerja (spreadsheet), visualisasi data, pengelompokan data, serta interpretasi hasil analisis sederhana.
- Jika materi Jaringan Komputer dan Internet: fokus pada konektivitas internet (kabel/nirkabel), transmisi data, enkripsi sederhana, proteksi data pribadi.
- Jika materi Algoritma Pemrograman: gunakan pemrograman visual yang lebih kompleks dengan percabangan (kondisional) dan perulangan (looping), atau mulai mengenali konsep dasar teks (Python dasar).
- Hubungkan dengan proyek praktis atau masalah kontekstual di SMP Negeri 2 Kalibaru Banyuwangi.
`;
  } else {
    // Kelas IX
    return `
Khusus Kelas IX (Fase D akhir/lanjut):
- Fokus pada pemecahan masalah (problem solving) yang kompleks, integrasi antarkonsep informatika, proyek autentik/kemasyarakatan, serta kesiapan menuju jenjang SMA/SMK.
- Jika materi Algoritma Pemrograman: fokus pada struktur kontrol yang kompleks, fungsi, list/array dasar menggunakan bahasa teks populer seperti Python.
- Jika materi Dampak Sosial Informatika: analisis mendalam mengenai media sosial, cyberbullying, hak kekayaan intelektual, lisensi produk, kolaborasi digital, kejahatan siber.
- Jika materi Kecerdasan Artifisial (AI): pemahaman dasar cara kerja AI, machine learning sederhana, penerapan AI yang etis, bias AI, serta dampaknya pada masa depan pekerjaan.
- Tuntut kemandirian tinggi, pemecahan masalah sistematis, dan presentasi hasil karya (produk nyata).
`;
  }
}

// API endpoint for streaming Modul Ajar generation via SSE
app.post("/api/modul-ajar/generate", async (req, res) => {
  if (!ai) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is not configured. Please add it in the Settings > Secrets panel.",
    });
  }

  const { 
    kelas, 
    materi, 
    model, 
    semester, 
    alokasi, 
    customDirectives
  } = req.body;

  const namaSekolah = req.body.namaSekolah || "SMP Negeri 2 Kalibaru";
  const kabupaten = req.body.kabupaten || "Banyuwangi";
  const namaGuru = req.body.namaGuru || "Eko Widodo, S.Pd.";
  const nipGuru = req.body.nipGuru || "197803152014071003";
  const namaKepalaSekolah = req.body.namaKepalaSekolah || "..................................................";
  const nipKepalaSekolah = req.body.nipKepalaSekolah || "..................................................";

  if (!kelas || !materi) {
    return res.status(400).json({ error: "Kelas dan Materi wajib diisi." });
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const cpGuideline = getGradeCP2026Guidelines(kelas, materi);

  const prompt = `
Anda adalah Guru Ahli Informatika SMP sekaligus Pengembang Kurikulum Nasional Indonesia yang ahli dalam menyusun Modul Ajar Kurikulum Merdeka terbaru (CP 2026) dengan pendekatan Pembelajaran Mendalam (Deep Learning) Format 8334.

Susunlah sebuah **Modul Ajar yang Sangat Lengkap, Terstruktur Rinci, dan Siap Pakai** berdasarkan data berikut:
- Sekolah: ${namaSekolah}
- Kabupaten: ${kabupaten}
- Guru: ${namaGuru}
- NIP Guru: ${nipGuru}
- Kepala Sekolah: ${namaKepalaSekolah}
- NIP Kepala Sekolah: ${nipKepalaSekolah}
- Fase: D
- Kelas: ${kelas}
- Semester: ${semester || "1 (Satu)"}
- Alokasi Waktu: ${alokasi || "2 JP (2 x 40 menit)"}
- Mata Pelajaran: Informatika
- Materi Pokok / Topik: ${materi}
- Model Pembelajaran: ${model || "Problem Based Learning (PBL)"}
${customDirectives ? `- Catatan Tambahan/Fokus Khusus: ${customDirectives}` : ""}

---
${cpGuideline}

---
PEDOMAN FORMAT 8334 (PEMBELAJARAN MENDALAM) & STRUKTUR MODUL AJAR:
Anda harus menghasilkan output dokumen utuh dalam bahasa Indonesia yang baik, ramah, komunikatif, tidak kaku, dan siap pakai.
Struktur Modul harus ditulis secara runut dari huruf A sampai T dengan isi yang detail (DILARANG menggunakan placeholder seperti "[Tuliskan di sini]" atau "[Isi materi]"). Semua bagian harus diisi lengkap dengan contoh kasus nyata, soal, rubrik, langkah pembelajaran yang konkret, dan lembar kerja yang siap dicetak oleh Pak Eko.

Integrasikan konteks lokal Kabupaten Banyuwangi (seperti Kawah Ijen, pariwisata Banyuwangi, pertanian kopi/buah naga Kalibaru, seni Gandrung, atau pengelolaan data sekolah di SMP Negeri 2 Kalibaru) ke dalam studi kasus atau latihan Computational Thinking atau LKPD agar modul ajar terasa autentik dan bermakna bagi siswa setempat!

Berikut adalah 20 Bagian (A-T) yang WAJIB ada di dalam dokumen:

A. Informasi Umum
   - Identitas Modul (Nama Guru, Sekolah, Kabupaten, Fase, Kelas, Mapel, Semester, Alokasi Waktu)
   - Materi Pokok
   - Kompetensi Prasyarat (Apa yang harus dikuasai siswa sebelum materi ini)
   - Sarana dan Prasarana (Sebutkan alat teknologi dan non-teknologi yang spesifik dan realistis untuk sekolah di Kalibaru Banyuwangi)
   - Target Peserta Didik (misal: Reguler, Kesulitan Belajar, atau Pencapaian Tinggi)

B. Capaian Pembelajaran (CP 2026)
   - Tuliskan Capaian Pembelajaran Informatika Fase D terbaru yang relevan dengan ${kelas} dan topik ${materi}. Pastikan akurat, relevan dengan elemen CP (seperti BK, SK, JKI, AD, AP, DSI, PLB, atau TIK).

C. Tujuan Pembelajaran
   - Rumuskan minimal 3–5 tujuan pembelajaran yang spesifik, operasional, berurutan, menggunakan kata kerja operasional (KKO) yang terukur (Taksonomi Bloom atau SOLO), mencakup aspek kognitif, psikomotor, atau afektif.

D. Indikator Ketercapaian Tujuan Pembelajaran (IKTP)
   - Tuliskan indikator ketercapaian yang konkret, terukur, dan selaras dengan Tujuan Pembelajaran.

E. Profil Lulusan (8 Dimensi)
   - Hubungkan pembelajaran secara bermakna dengan 8 Dimensi Profil Lulusan:
     1. Keimanan (Akhlak mulia, rasa syukur atas teknologi)
     2. Kewargaan (Etika digital, hak/kewajiban di dunia siber)
     3. Penalaran Kritis (Analisis data, pemecahan masalah logis)
     4. Kreativitas (Inovasi solusi, pemrograman kreatif)
     5. Kolaborasi (Kerjasama tim dalam diskusi/proyek)
     6. Kemandirian (Eksplorasi mandiri, tanggung jawab belajar)
     7. Komunikasi (Presentasi ide, dokumentasi karya)
     8. Kesehatan (Ergonomi komputer, keseimbangan screen time)

F. Integrasi 7 Kebiasaan Anak Indonesia Hebat
   - Hubungkan pembelajaran dengan nilai-nilai dari 7 Kebiasaan Anak Indonesia Hebat secara eksplisit (misalnya: Kejujuran, Disiplin, Kerjasama, Sopan Santun, dsb).

G. Pembelajaran Mendalam (Deep Learning - 8334)
   - 8 Profil Lulusan Dominan: Jelaskan dimensi mana yang paling dominan di dalam modul ini dan mengapa.
   - 3 Prinsip (Mindful, Meaningful, Joyful): Jelaskan bagaimana masing-masing prinsip ini diwujudkan dalam aktivitas kelas Anda.
   - 3 Pengalaman Belajar:
     * Memahami (Bagaimana cara siswa memahami konsep esensial secara mendalam?)
     * Mengaplikasi (Aktivitas penerapan konsep ke dalam situasi baru atau praktek nyata?)
     * Merefleksi (Bagaimana siswa mengevaluasi pemahaman dan proses belajarnya?)
   - 4 Kerangka Desain:
     * Praktik Pedagogis (Strategi mengajar guru)
     * Kemitraan (Hubungan guru-murid-orang tua, atau kolaborasi kelompok)
     * Lingkungan Belajar (Kondisi ruang kelas yang kondusif, fisik maupun virtual)
     * Teknologi Digital (Alat bantu digital yang dimanfaatkan untuk belajar aktif)

H. Langkah-Langkah Pembelajaran
   - Buat langkah pembelajaran yang terperinci menggunakan sintaks model pembelajaran "${model}".
   - Bagilah menjadi:
     1. Kegiatan Pendahuluan (Orientasi, Apersepsi, Motivasi, Acuan) - Alokasi Waktu.
     2. Kegiatan Inti (Langkah-langkah terperinci sesuai sintaks ${model}) - Alokasi Waktu. Pastikan ada interaksi aktif, bimbingan, dan pengerjaan tugas.
     3. Kegiatan Penutup (Simpulan, Evaluasi, Refleksi, Rencana Tindak Lanjut) - Alokasi Waktu.

I. Pembelajaran Berdiferensiasi
   - Rancang strategi diferensiasi konkret:
     * Diferensiasi Konten (Pilihan materi/media belajar bagi siswa berdaya tangkap lambat vs cepat)
     * Diferensiasi Proses (Cara pendampingan kelompok, scaffolding terarah bagi yang membutuhkan)
     * Diferensiasi Produk (Pilihan hasil tugas/karya siswa sesuai minat/kemampuan mereka)

J. Computational Thinking (Berpikir Komputasional)
   - Hubungkan materi ini secara eksplisit dengan 4 pilar CT:
     * Dekomposisi (Bagaimana memecah masalah besar topik ini menjadi bagian kecil?)
     * Pengenalan Pola (Pola apa saja yang dikenali dari masalah serupa?)
     * Abstraksi (Bagaimana mengabaikan detail tidak penting dan fokus pada esensi?)
     * Algoritma (Bagaimana langkah-langkah sistematis untuk menyelesaikan masalah?)

K. Koding (Coding)
   - Berikan panduan koding sederhana yang relevan dengan topik ini (misal: kode Python dasar, blok Scratch, atau pseudo-code sistematis). Tuliskan kodenya dan berikan penjelasannya secara rinci agar mudah diajarkan. Jika materi tidak langsung tentang pemrograman, buatlah integrasi logika algoritma pemecahan masalah dalam bentuk kode/pseudo-code.

L. Kecerdasan Artifisial (AI) dalam Pembelajaran
   - Berikan contoh bagaimana guru atau siswa dapat menggunakan alat AI (seperti Gemini, chatbot, dll) secara etis, kreatif, dan kritis dalam topik ini, termasuk cara menghindari plagiarisme dan mengevaluasi kebenaran informasi AI.

M. Asesmen
   - Asesmen Diagnostik (Pertanyaan pemantik non-kognitif dan kognitif di awal pembelajaran).
   - Asesmen Formatif (Bentuk observasi, penilaian antarteman, kuis singkat selama proses).
   - Asesmen Sumatif (Tugas proyek atau tes tertulis di akhir pembelajaran). Berikan soal-soal konkret pilihan ganda atau esai HOTS (minimal 3-5 soal beserta kunci jawaban).
   - Rubrik Penilaian (Tampilkan dalam format tabel Markdown yang rapi dengan kriteria nilai: Sangat Baik, Baik, Cukup, Perlu Bimbingan).

N. Lembar Kerja Peserta Didik (LKPD)
   - Buatlah LKPD utuh yang siap dicetak! Harus berisi: Judul Kegiatan, Tujuan, Alat & Bahan, Petunjuk Kerja, Studi Kasus/Pertanyaan Diskusi kelompok yang seru, dan Lembar Jawaban Siswa. DILARANG memotong bagian LKPD! Buat LKPD ini sangat menarik dengan instruksi yang jelas.

O. Pengayaan
   - Aktivitas belajar tambahan yang menantang bagi peserta didik dengan pencapaian tinggi.

P. Remedial
   - Kegiatan bimbingan dan pengerjaan ulang yang disederhanakan bagi peserta didik yang belum mencapai ketuntasan.

Q. Refleksi Guru
   - Daftar pertanyaan reflektif untuk mengevaluasi efektivitas mengajar Guru ${namaGuru}.

R. Refleksi Peserta Didik
   - Daftar pertanyaan reflektif bagi siswa untuk mengukur pemahaman diri dan emosi belajar mereka.

S. Glosarium
   - Istilah-istilah penting informatika dan definisinya yang ada di dalam materi ini.

T. Daftar Pustaka
   - Sumber referensi buku paket informatika SMP Kurikulum Merdeka Kemendikbudristek dan sumber internet tepercaya.

Setelah bagian T, Anda WAJIB menyertakan Halaman Pengesahan (Signature block) persis seperti format berikut di bagian paling akhir dokumen, tanpa pengantar atau penutup lain:

### HALAMAN PENGESAHAN

Kalibaru, ..........................

Mengetahui,
Kepala ${namaSekolah}

**${namaKepalaSekolah}**
NIP. ${nipKepalaSekolah}

Guru Mata Pelajaran Informatika

**${namaGuru}**
NIP. ${nipGuru}

Gunakan format markdown yang indah, rapi, terstruktur, serta berikan penanda-penanda emosional yang hangat.
Mulai tulis sekarang!
`;

  try {
    const chat = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction: "Anda adalah Guru Ahli Informatika SMP sekaligus pengembang Kurikulum Nasional Indonesia yang menulis Modul Ajar sangat lengkap, detail, penuh isi kreatif, dan terstruktur tanpa singkatan atau teks kosong placeholder. Gaya bahasa Anda ramah, penuh inspirasi, mendidik, dan siap pakai mengajar.",
      },
    });

    const responseStream = await chat.sendMessageStream({ message: prompt });

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write("event: end\ndata: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("Error generating Modul Ajar:", error);
    res.write(`data: ${JSON.stringify({ error: error.message || "Unknown error occurred" })}\n\n`);
    res.end();
  }
});

// API endpoint for editing a specific Modul Ajar or section via SSE
app.post("/api/modul-ajar/edit", async (req, res) => {
  if (!ai) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is not configured. Please add it in the Settings > Secrets panel.",
    });
  }

  const { 
    currentContent, 
    instruction, 
    targetSection
  } = req.body;

  const namaSekolah = req.body.namaSekolah || "SMP Negeri 2 Kalibaru";
  const kabupaten = req.body.kabupaten || "Banyuwangi";
  const namaGuru = req.body.namaGuru || "Eko Widodo, S.Pd.";
  const nipGuru = req.body.nipGuru || "197803152014071003";
  const namaKepalaSekolah = req.body.namaKepalaSekolah || "..................................................";
  const nipKepalaSekolah = req.body.nipKepalaSekolah || "..................................................";

  if (!currentContent || !instruction) {
    return res.status(400).json({ error: "Konten saat ini dan Instruksi wajib diisi." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const prompt = `
Anda adalah Guru Ahli Informatika SMP dan Pengembang Kurikulum Nasional Indonesia yang hebat.
Tugas Anda adalah merevisi atau memodifikasi modul ajar yang diberikan di bawah ini berdasarkan instruksi perubahan dari pengguna.

INFORMASI TAMBAHAN REVISI:
- Bagian yang ingin difokuskan/diedit: ${targetSection || "Semua bagian yang relevan"}
- Instruksi Perubahan: "${instruction}"

Berikut adalah isi modul ajar saat ini dalam format Markdown:
---
${currentContent}
---

Tugas Anda:
1. Analisis instruksi perubahan secara cermat.
2. Lakukan pengeditan dan penyempurnaan isi modul ajar pada bagian yang relevan dengan instruksi tersebut.
3. Tetap pertahankan format 20 bagian (A sampai T) dan pertahankan detail-detail bagus lainnya yang sudah ada dalam dokumen asal, kecuali jika instruksi meminta penghapusan atau perombakan total.
4. Pastikan teks hasil revisi tetap lengkap, tidak menggunakan placeholder singkat, rapi, terstruktur, siap pakai, dan mempertahankan identitas sekolah ${namaSekolah}, Kabupaten ${kabupaten}, serta guru ${namaGuru}.
5. Di bagian paling akhir dokumen (setelah Daftar Pustaka), Anda WAJIB memastikan adanya Halaman Pengesahan (Signature block) dengan format berikut, tanpa pengantar atau penutup lain:

### HALAMAN PENGESAHAN

Kalibaru, ..........................

Mengetahui,
Kepala ${namaSekolah}

**${namaKepalaSekolah}**
NIP. ${nipKepalaSekolah}

Guru Mata Pelajaran Informatika

**${namaGuru}**
NIP. ${nipGuru}

6. Kembalikan seluruh konten modul ajar yang baru hasil revisi lengkap dari huruf A sampai T secara utuh dalam format Markdown agar dapat langsung digunakan oleh guru.

Mulailah menulis modul ajar hasil revisi sekarang!
`;

  try {
    const chat = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction: "Anda adalah Guru Ahli Informatika SMP sekaligus pengembang Kurikulum Nasional Indonesia. Anda menerima modul ajar lama, memperbaikinya sesuai permintaan guru, dan mengembalikan seluruh modul ajar utuh (dari A sampai T) dalam format Markdown yang rapi dan siap pakai.",
      },
    });

    const responseStream = await chat.sendMessageStream({ message: prompt });

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write("event: end\ndata: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("Error editing Modul Ajar:", error);
    res.write(`data: ${JSON.stringify({ error: error.message || "Unknown error occurred" })}\n\n`);
    res.end();
  }
});

// Start the server
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
