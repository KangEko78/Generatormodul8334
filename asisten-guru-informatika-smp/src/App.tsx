import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  BookOpen, 
  FileText, 
  Plus, 
  Download, 
  Copy, 
  Printer, 
  ArrowRight, 
  Search, 
  Trash2, 
  AlertCircle, 
  Edit3, 
  Layers, 
  Compass, 
  Send, 
  Check, 
  ChevronRight, 
  GraduationCap, 
  X, 
  Eye, 
  Code,
  FileCheck,
  RefreshCw,
  Clock,
  MapPin,
  User,
  HeartHandshake,
  Settings,
  LogIn,
  LogOut,
  Cloud,
  CloudOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PRESET_TOPICS } from "./presets";
import { ModulAjar, PresetTopic, ChatMessage } from "./types";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "./firebase";
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, onSnapshot, query, orderBy } from "firebase/firestore";

// Cycle of reassurance messages during document generation
const REASSURANCE_MESSAGES = [
  "Menganalisis Kurikulum Merdeka Fase D (CP 2026 Terbaru)...",
  "Merancang Informasi Umum & Kompetensi Prasyarat untuk SMP Negeri 2 Kalibaru...",
  "Merumuskan 3-5 Tujuan Pembelajaran berbasis Kata Kerja Operasional (KKO)...",
  "Menyelaraskan 8 Dimensi Profil Lulusan yang relevan...",
  "Mengintegrasikan 7 Kebiasaan Anak Indonesia Hebat...",
  "Merangkai Pembelajaran Mendalam Format 8334 (Mindful, Meaningful, Joyful)...",
  "Menyusun Langkah Pembelajaran yang interaktif sesuai sintaks model...",
  "Mengembangkan Strategi Pembelajaran Berdiferensiasi (Konten, Proses, Produk)...",
  "Menyisipkan Logika Berpikir Komputasional (Dekomposisi, Pola, Abstraksi, Algoritma)...",
  "Menulis contoh Koding / Pseudo-code dan panduan implementasi...",
  "Merancang aktivitas Kecerdasan Artifisial yang etis dalam kelas...",
  "Menyusun Asesmen Diagnostik, Formatif, dan Sumatif berbasis HOTS...",
  "Membuat tabel rubrik penilaian kurikulum yang lengkap...",
  "Menyusun Lembar Kerja Peserta Didik (LKPD) yang terperinci dan siap cetak...",
  "Menyusun Pengayaan, Remedial, Refleksi, dan Glosarium lengkap..."
];

export default function App() {
  // Config States
  const [kelas, setKelas] = useState<"VII" | "VIII" | "IX">("VII");
  const [selectedPreset, setSelectedPreset] = useState<PresetTopic | null>(null);
  const [customMateri, setCustomMateri] = useState("");
  const [modelPembelajaran, setModelPembelajaran] = useState("Problem Based Learning (PBL)");
  const [semester, setSemester] = useState("1 (Satu)");
  const [alokasi, setAlokasi] = useState("2 JP (2 x 40 menit)");
  const [customDirectives, setCustomDirectives] = useState("");

  // Application Settings States (directly loaded from localStorage or standard defaults)
  const [namaSekolah, setNamaSekolah] = useState(() => localStorage.getItem("asisten_guru_namaSekolah") || "SMP Negeri 2 Kalibaru");
  const [kabupaten, setKabupaten] = useState(() => localStorage.getItem("asisten_guru_kabupaten") || "Banyuwangi");
  const [namaGuru, setNamaGuru] = useState(() => localStorage.getItem("asisten_guru_namaGuru") || "Eko Widodo, S.Pd.");
  const [nipGuru, setNipGuru] = useState(() => localStorage.getItem("asisten_guru_nipGuru") || "197803152014071003");
  const [namaKepalaSekolah, setNamaKepalaSekolah] = useState(() => localStorage.getItem("asisten_guru_namaKepala") || "");
  const [nipKepalaSekolah, setNipKepalaSekolah] = useState(() => localStorage.getItem("asisten_guru_nipKepala") || "");
  const [tanggalDokumen, setTanggalDokumen] = useState(() => localStorage.getItem("asisten_guru_tanggalDokumen") || "Juli 2026");
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Workflow States
  const [activeTab, setActiveTab] = useState<"create" | "library" | "settings">("create");
  const [modulList, setModulList] = useState<ModulAjar[]>([]);
  const [currentModul, setCurrentModul] = useState<ModulAjar | null>(null);
  const [generationStatus, setGenerationStatus] = useState<"idle" | "generating" | "editing" | "error">("idle");
  const [streamingText, setStreamingText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Reassurance messaging state
  const [reassuranceIndex, setReassuranceIndex] = useState(0);

  // Co-Pilot Chat Editor State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInstruction, setChatInstruction] = useState("");
  const [chatSection, setChatSection] = useState("Semua bagian (Modul Utuh)");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Search & view options
  const [searchQuery, setSearchQuery] = useState("");
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const [copied, setCopied] = useState(false);

  // Firebase Auth & Sync States
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Refs for auto-scroll and stream management
  const resultEndRef = useRef<HTMLDivElement>(null);
  const reassuranceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved Modul Ajars from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("asisten_guru_modul_ajars");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setModulList(parsed);
        if (parsed.length > 0) {
          setCurrentModul(parsed[0]);
        }
      } catch (e) {
        console.error("Gagal memuat pustaka dari localStorage", e);
      }
    } else {
      // If none, load a welcome mock/default modul to let Pak Eko explore immediately
      const defaultModul: ModulAjar = {
        id: "default-welcome",
        title: "Modul Ajar Informatika Kelas VII - Berpikir Komputasional",
        grade: "VII",
        materi: "Berpikir Komputasional (BK) - Struktur data List & Algoritma sederhana",
        model: "Problem Based Learning (PBL)",
        semester: "1 (Satu)",
        alokasi: "2 JP (2 x 40 menit)",
        createdAt: new Date().toLocaleDateString("id-ID"),
        content: `
# MODUL AJAR INFORMATIKA
## PEMBELAJARAN MENDALAM FORMAT 8334

---

### A. Informasi Umum
- **Identitas Modul**
  - Nama Sekolah: SMP Negeri 2 Kalibaru
  - Kabupaten: Banyuwangi
  - Nama Guru: Eko Widodo, S.Pd.
  - Fase / Kelas: D / VII
  - Mata Pelajaran: Informatika
  - Semester: 1 (Satu)
  - Alokasi Waktu: 2 JP (2 x 40 menit)
- **Materi Pokok**: Berpikir Komputasional (BK) - Struktur data List & Algoritma sederhana
- **Kompetensi Prasyarat**: Peserta didik telah mampu melakukan penyelesaian masalah logis sederhana dalam kehidupan sehari-hari (misal: mengantre tiket, membereskan tumpukan buku).
- **Sarana dan Prasarana**: Papan tulis, kertas HVS warna (oranye/biru untuk simulasi kartu), proyektor, koneksi internet, laptop guru.
- **Target Peserta Didik**: Reguler (32 siswa) / Pembelajaran difokuskan pada penguatan literasi berpikir logis.

---

### B. Capaian Pembelajaran (CP 2026)
Pada akhir Fase D, peserta didik mampu menerapkan berpikir komputasional untuk menyelesaikan persoalan sehari-hari secara sistematis yang mengandung struktur data (list, stack, queue) serta merancang algoritma langkah-demi-langkah yang logis untuk menyelesaikan persoalan tersebut.

---

### C. Tujuan Pembelajaran
Setelah mengikuti pembelajaran ini, peserta didik diharapkan mampu:
1. **Mengidentifikasi** masalah antrean (Queue) dan tumpukan (Stack) di lingkungan SMP Negeri 2 Kalibaru secara tepat.
2. **Membedakan** karakteristik struktur data List, Stack, dan Queue dengan analisis logis.
3. **Merancang** langkah-langkah algoritma sederhana untuk mengurutkan data (sorting) secara runtut dan sistematis.
4. **Merefleksikan** pentingnya berpikir komputasional dalam menyelesaikan masalah sehari-hari.

---

### D. Indikator Ketercapaian Tujuan Pembelajaran (IKTP)
1. Siswa dapat memberikan minimal 2 contoh peristiwa antrean (Queue) dan tumpukan (Stack) dalam lingkungan sekolah.
2. Siswa secara tepat mendemonstrasikan proses penyimpanan data menggunakan metode LIFO (Last In First Out) dan FIFO (First In First Out).
3. Siswa dapat menuliskan baris demi baris instruksi langkah urutan penyelesaian masalah (algoritma) pengurutan kartu secara mandiri.

---

### E. Profil Lulusan (8 Dimensi)
1. **Keimanan**: Mensyukuri nikmat berpikir logis yang diberikan Tuhan untuk membantu sesama.
2. **Penalaran Kritis**: Mengurai masalah rumit menjadi langkah kecil yang runut (dekomposisi).
3. **Kolaborasi**: Berdiskusi aktif menyusun urutan kartu angka dalam kelompok belajar.
4. **Kemandirian**: Bertanggung jawab menyelesaikan lembar refleksi individu secara jujur.

---

### F. Integrasi 7 Kebiasaan Anak Indonesia Hebat
- **Kerjasama**: Saling menghargai pendapat rekan sekelompok saat mengidentifikasi antrean kantin.
- **Disiplin**: Menggunakan waktu diskusi secara efisien dan tepat waktu saat guru memberi isyarat selesai.

---

### G. Pembelajaran Mendalam (Deep Learning - 8334)
- **8 Profil Lulusan Dominan**: *Penalaran Kritis* dan *Kolaborasi*. Siswa secara mendalam dipandu untuk membedakan Queue vs Stack dengan aktivitas fisik bertukar kartu (Kolaborasi) dan menganalisis efisiensinya (Penalaran Kritis).
- **3 Prinsip**:
  - *Mindful*: Siswa menyadari sepenuhnya tindakan mereka ketika memasukkan/mengeluarkan elemen dari antrean.
  - *Meaningful*: Belajar dari contoh nyata keseharian di Kalibaru, Banyuwangi (seperti antrean pembagian pupuk atau tumpukan buah naga di kebun).
  - *Joyful*: Aktivitas fisik interaktif "Bermain Kartu Komputasi" yang membuat siswa gembira dan aktif bergerak.
- **3 Pengalaman Belajar**:
  - *Memahami*: Menyimak demonstrasi guru mengenai tumpukan baki makanan.
  - *Mengaplikasi*: Mempraktikkan pengurutan kartu angka acak dalam kelompok.
  - *Merefleksi*: Mengisi lembar refleksi emosi belajar di akhir sesi.
- **4 Kerangka Desain**:
  - *Praktik Pedagogis*: Pendekatan Student-Centered dengan metode Unplugged.
  - *Kemitraan*: Siswa berpasangan (Peer Tutoring) untuk membantu teman yang kesulitan.
  - *Lingkungan Belajar*: Meja disusun melingkar untuk memfasilitasi diskusi.
  - *Teknologi Digital*: Pemanfaatan slide interaktif untuk menyajikan teka-teki logika.

---

### H. Langkah-Langkah Pembelajaran
**Model: Problem Based Learning (PBL)**

#### 1. Pendahuluan (15 Menit)
- Guru membuka kelas dengan salam, memeriksa kehadiran siswa, dan berdoa.
- **Apersepsi**: Guru menanyakan, "Siapa yang tadi pagi antre membeli jajanan di kantin? Siapa yang mendapat pelayanan pertama kali? Apakah yang datang terakhir dilayani duluan?"
- Guru menyampaikan tujuan pembelajaran hari ini dan menjelaskan pentingnya berpikir sistematis.

#### 2. Kegiatan Inti (50 Menit)
- **Fase 1: Orientasi Siswa pada Masalah**
  - Guru memberikan ilustrasi gambar tumpukan buku catatan di meja kelas dan antrean siswa mencuci tangan di wastafel sekolah.
  - Siswa dipicu berpikir kritis tentang perbedaan kedua pola tersebut.
- **Fase 2: Mengorganisasi Siswa untuk Belajar**
  - Siswa dibagi menjadi kelompok heterogen (4-5 orang).
  - Setiap kelompok dibagikan LKPD dan 1 set kartu angka acak.
- **Fase 3: Membimbing Penyelidikan Kelompok**
  - Kelompok dipandu untuk mempraktikkan simulasi: Bagaimana cara mengurutkan kartu dari terkecil ke terbesar menggunakan pilar dekomposisi.
  - Guru berkeliling memberikan motivasi dan membimbing kelompok yang mengalami hambatan (Scaffolding).
- **Fase 4: Mengembangkan dan Menyajikan Hasil Karya**
  - Salah satu kelompok mempresentasikan algoritma pengurutan kartu mereka di papan tulis.
  - Siswa lain menyimak dan memberikan tanggapan secara sopan.
- **Fase 5: Menganalisis dan Mengevaluasi Proses Pemecahan Masalah**
  - Guru mengonfirmasi konsep Queue (FIFO) dan Stack (LIFO).
  - Menghubungkannya dengan cara kerja komputer menyimpan memori pencarian browser.

#### 3. Kegiatan Penutup (15 Menit)
- Siswa bersama guru menyimpulkan perbedaan Queue, Stack, dan List.
- Siswa mengerjakan kuis diagnostik kognitif singkat secara individu.
- Guru menyampaikan rencana pembelajaran berikutnya (Sistem Komputer) dan mengakhiri sesi dengan salam penutup hangat.

---

### I. Pembelajaran Berdiferensiasi
- **Diferensiasi Konten**: Menyediakan teks bergambar untuk siswa visual, dan simulasi fisik kartu untuk siswa kinestetik.
- **Diferensiasi Proses**: Guru mendampingi kelompok siswa yang membutuhkan bantuan ekstra secara intensif, sementara kelompok mandiri diberikan tantangan kartu yang lebih banyak.
- **Diferensiasi Produk**: Kelompok boleh memilih mempresentasikan algoritma mereka dalam bentuk poster bagan alir, tulisan runtut, atau demonstrasi langsung di depan kelas.

---

### J. Computational Thinking (Berpikir Komputasional)
- **Dekomposisi**: Memecah langkah pengurutan kartu menjadi langkah-langkah membandingkan dua kartu saja dalam satu waktu.
- **Pengenalan Pola**: Menemukan bahwa kartu terkecil selalu bergeser ke arah kiri dalam setiap putaran pembandingan.
- **Abstraksi**: Mengabaikan warna, bahan, atau ukuran kartu fisik, dan fokus sepenuhnya pada nilai angka yang tertulis.
- **Algoritma**: Menyusun aturan baku: "Jika kartu kiri lebih besar dari kartu kanan, maka tukar posisinya. Ulangi sampai tidak ada kartu yang bertukar."

---

### K. Koding (Coding)
Sebagai pengenalan awal, berikut adalah pseudo-code algoritma pengurutan sederhana (*Bubble Sort*) yang dapat digunakan sebagai jembatan menuju koding pemrograman teks di kelas atas:
\`\`\`text
Algoritma UrutkanKartu
Input: Daftar angka A
Mulai:
  Tentukan panjang daftar N = jumlah elemen di A
  Ulangi i dari 0 sampai N-1:
    Ulangi j dari 0 sampai N-i-2:
      Jika A[j] > A[j+1] maka:
        Tukar posisi A[j] dengan A[j+1]
      Akhir Jika
    Akhir Ulangi
  Akhir Ulangi
Selesai
\`\`\`

---

### L. Kecerdasan Artifisial (AI) dalam Pembelajaran
*Contoh Pemanfaatan Etis AI*: Guru menyarankan siswa untuk berdiskusi dengan AI (seperti Gemini) menggunakan perintah (prompt): *"Berikan saya teka-teki logika sehari-hari tentang tumpukan buku yang menantang untuk anak SMP."* Siswa dilarang keras menyalin langsung jawaban AI untuk LKPD, melainkan menggunakannya untuk membandingkan logika berpikir mandiri dengan penalaran AI.

---

### M. Asesmen
#### 1. Asesmen Diagnostik (Sebelum Pembelajaran)
- Pertanyaan lisan: "Pernahkah kamu merapikan tumpukan piring makan? Piring mana yang kamu cuci terlebih dahulu?"
#### 2. Asesmen Formatif (Selama Proses)
- Observasi sikap kolaborasi kelompok menggunakan lembar ceklis kerja tim.
- Penilaian sejawat (Peer-assessment) tentang keaktifan diskusi kelompok.
#### 3. Asesmen Sumatif (Akhir Sesi)
- Soal Esai: "Sebutkan perbedaan mendasar antara Queue dan Stack dalam penyimpanan data! Berikan 1 contoh konkret di sekolah!"
- *Kunci Jawaban*: Queue bekerja dengan prinsip FIFO (yang pertama masuk adalah yang pertama keluar), contohnya antrean kantin. Stack bekerja dengan prinsip LIFO (yang terakhir masuk adalah yang pertama keluar), contohnya tumpukan buku tugas di meja guru.

#### Rubrik Penilaian Proyek Diskusi Kelompok
| Kriteria | Sangat Baik (A: 90-100) | Baik (B: 80-89) | Cukup (C: 70-79) | Perlu Bimbingan (D: <70) |
| :--- | :--- | :--- | :--- | :--- |
| **Penerapan Pilar CT** | Menggunakan 4 pilar CT secara sempurna dalam memecahkan soal urutan kartu. | Menggunakan 3 pilar CT dengan baik saat berdiskusi. | Hanya menggunakan 1-2 pilar CT dalam analisisnya. | Belum menunjukkan pemahaman pilar CT. |
| **Kolaborasi Tim** | Semua anggota aktif berpartisipasi dan saling memberi solusi konstruktif. | Mayoritas anggota kelompok aktif berdiskusi. | Hanya 1-2 orang yang mendominasi jalannya pengerjaan. | Pasif dan tidak bekerjasama dalam menyelesaikan masalah. |

---

### N. Lembar Kerja Peserta Didik (LKPD)
**MATA PELAJARAN: INFORMATIKA - BERPIKIR KOMPUTASIONAL**
**AKTIVITAS: SIMULASI TUMPUKAN DAN ANTREAN**

- **Nama Anggota Kelompok**:
  1. .................................................
  2. .................................................
  3. .................................................
  4. .................................................
- **Petunjuk Kerja**:
  1. Ambillah baki plastik yang berisi 5 buah buku catatan yang disediakan oleh guru.
  2. Susun buku-buku tersebut ke dalam baki (Tumpukan).
  3. Ambil buku satu per satu untuk dibagikan kembali ke pemiliknya. Catat urutan pengambilannya!
  4. Diskusikan dengan kelompokmu, buku mana yang pertama kali ditaruh di dalam baki, dan buku mana yang pertama kali dikeluarkan.
- **Pertanyaan Diskusi**:
  - Apakah metode pembagian buku di atas termasuk prinsip Stack atau Queue? Berikan alasan logismu!
  - ...........................................................................................................................

---

### O. Pengayaan
Siswa diberikan tantangan tambahan untuk menganalisis bagaimana cara kerja tombol "Undo" dan "Redo" pada Microsoft Word berdasarkan konsep struktur data Stack.

---

### P. Remedial
Siswa yang belum mencapai kriteria ketuntasan diberikan pendampingan personal oleh guru dengan menggunakan media fisik berupa tumpukan koin berwarna untuk mempraktikkan ulang konsep LIFO.

---

### Q. Refleksi Guru
- Apakah aktivitas permainan kartu dapat dipahami oleh seluruh peserta didik?
- Apa kendala terbesar yang dihadapi siswa dalam membedakan Queue dengan Stack?
- Bagaimana keaktifan siswa yang biasanya pasif di kelas hari ini?

---

### R. Refleksi Peserta Didik
- Bagian mana dari pembelajaran hari ini yang paling kamu sukai?
- Seberapa paham kamu tentang perbedaan Queue dan Stack (Skala 1-5 bintang)?
- Emosi apa yang paling menggambarkan perasaanmu saat berdiskusi kelompok? (Senang / Bingung / Bosan / Seru)

---

### S. Glosarium
- **Berpikir Komputasional**: Metode pemecahan masalah dengan menerapkan teknik ilmu komputer.
- **Stack (Tumpukan)**: Struktur data di mana elemen terakhir yang dimasukkan adalah yang pertama dikeluarkan (LIFO).
- **Queue (Antrean)**: Struktur data di mana elemen pertama yang dimasukkan adalah yang pertama dikeluarkan (FIFO).

---

### T. Daftar Pustaka
- Buku Paket Informatika SMP Kelas VII, Kemendikbudristek RI, 2021.
- Panduan Kurikulum Merdeka Fase D Informatika, Pusat Kurikulum dan Perbukuan Kemendikbudristek, 2026.
`
      };
      setModulList([defaultModul]);
      setCurrentModul(defaultModul);
    }
  }, []);

  // Synchronize Auth and Firestore database data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        setSyncing(true);
        const userId = currentUser.uid;

        // 1. Sync User Profile Settings
        try {
          const profileDocRef = doc(db, "users", userId);
          const profileSnap = await getDoc(profileDocRef);
          if (profileSnap.exists()) {
            const data = profileSnap.data();
            if (data.namaSekolah) setNamaSekolah(data.namaSekolah);
            if (data.kabupaten) setKabupaten(data.kabupaten);
            if (data.namaGuru) setNamaGuru(data.namaGuru);
            if (data.nipGuru) setNipGuru(data.nipGuru);
            if (data.namaKepalaSekolah) setNamaKepalaSekolah(data.namaKepalaSekolah);
            if (data.nipKepalaSekolah) setNipKepalaSekolah(data.nipKepalaSekolah);
            if (data.tanggalDokumen) setTanggalDokumen(data.tanggalDokumen);

            localStorage.setItem("asisten_guru_namaSekolah", data.namaSekolah || "");
            localStorage.setItem("asisten_guru_kabupaten", data.kabupaten || "");
            localStorage.setItem("asisten_guru_namaGuru", data.namaGuru || "");
            localStorage.setItem("asisten_guru_nipGuru", data.nipGuru || "");
            localStorage.setItem("asisten_guru_namaKepala", data.namaKepalaSekolah || "");
            localStorage.setItem("asisten_guru_nipKepala", data.nipKepalaSekolah || "");
            localStorage.setItem("asisten_guru_tanggalDokumen", data.tanggalDokumen || "");
          } else {
            // Document does not exist, initialize from current local settings
            await setDoc(profileDocRef, {
              namaSekolah,
              kabupaten,
              namaGuru,
              nipGuru,
              namaKepalaSekolah,
              nipKepalaSekolah,
              tanggalDokumen,
              updatedAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error("Gagal memuat profil guru dari Firestore:", err);
          handleFirestoreError(err, OperationType.GET, `users/${userId}`);
        }

        // 2. Sync Offline Moduls to Online Firestore Database
        const savedLocal = localStorage.getItem("asisten_guru_modul_ajars");
        let localModuls: ModulAjar[] = [];
        if (savedLocal) {
          try {
            localModuls = JSON.parse(savedLocal);
          } catch (e) {
            console.error(e);
          }
        }

        try {
          const subColRef = collection(db, "users", userId, "moduls");
          const querySnap = await getDocs(subColRef);
          const existingIds = new Set(querySnap.docs.map(doc => doc.id));

          for (const localModul of localModuls) {
            if (localModul.id !== "default-welcome" && !existingIds.has(localModul.id)) {
              await setDoc(doc(db, "users", userId, "moduls", localModul.id), localModul);
            }
          }
        } catch (err) {
          console.error("Gagal memigrasikan modul lokal ke Firestore:", err);
        }

        // 3. Set up real-time listener for Firestore changes
        const modulsColRef = collection(db, "users", userId, "moduls");
        const unsubscribeSnapshot = onSnapshot(modulsColRef, (snapshot) => {
          const firestoreModuls: ModulAjar[] = [];
          snapshot.forEach((doc) => {
            firestoreModuls.push(doc.data() as ModulAjar);
          });

          // Sort descending by id
          firestoreModuls.sort((a, b) => b.id.localeCompare(a.id));

          if (firestoreModuls.length > 0) {
            setModulList(firestoreModuls);
            setCurrentModul((curr) => {
              if (!curr) return firestoreModuls[0];
              const found = firestoreModuls.find(m => m.id === curr.id);
              return found || firestoreModuls[0];
            });
          } else {
            setModulList([]);
            setCurrentModul(null);
          }
          setSyncing(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${userId}/moduls`);
          setSyncing(false);
        });

        return () => {
          unsubscribeSnapshot();
        };
      } else {
        // Logged out: restore from localStorage
        const saved = localStorage.getItem("asisten_guru_modul_ajars");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setModulList(parsed);
            if (parsed.length > 0) {
              setCurrentModul(parsed[0]);
            }
          } catch (e) {
            console.error(e);
          }
        } else {
          setModulList([]);
          setCurrentModul(null);
        }
        setSyncing(false);
      }
    });

    return () => unsubscribe();
  }, [user === null]);


  // Save changes to localStorage whenever modulList updates
  const saveToLibrary = (list: ModulAjar[]) => {
    setModulList(list);
    localStorage.setItem("asisten_guru_modul_ajars", JSON.stringify(list));
  };

  const saveModul = async (modul: ModulAjar) => {
    // Optimistically save to local state and localStorage
    const withoutTarget = modulList.filter(m => m.id !== modul.id);
    const updatedList = [modul, ...withoutTarget];
    saveToLibrary(updatedList);

    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid, "moduls", modul.id), {
          id: modul.id,
          title: modul.title,
          grade: modul.grade,
          materi: modul.materi,
          model: modul.model,
          semester: modul.semester,
          alokasi: modul.alokasi,
          content: modul.content,
          createdAt: modul.createdAt,
          ...(modul.customDirectives ? { customDirectives: modul.customDirectives } : {})
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/moduls/${modul.id}`);
      }
    }
  };

  const deleteModul = async (id: string) => {
    const filtered = modulList.filter((m) => m.id !== id);
    saveToLibrary(filtered);

    if (user) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "moduls", id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/moduls/${id}`);
      }
    }
  };


  // Auto-scroll to bottom of streaming output during generation
  useEffect(() => {
    if (generationStatus === "generating" || generationStatus === "editing") {
      resultEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamingText, generationStatus]);

  // Interval reassurance message changer when generating
  useEffect(() => {
    if (generationStatus === "generating" || generationStatus === "editing") {
      reassuranceTimerRef.current = setInterval(() => {
        setReassuranceIndex((prev) => (prev + 1) % REASSURANCE_MESSAGES.length);
      }, 5000);
    } else {
      if (reassuranceTimerRef.current) {
        clearInterval(reassuranceTimerRef.current);
      }
    }

    return () => {
      if (reassuranceTimerRef.current) {
        clearInterval(reassuranceTimerRef.current);
      }
    };
  }, [generationStatus]);

  // Handle preset topic selection
  const handleSelectPreset = (topic: PresetTopic) => {
    setSelectedPreset(topic);
    setCustomMateri("");
  };

  // Generate Modul Ajar handler (SSE client)
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStreamingText("");
    setGenerationStatus("generating");
    setReassuranceIndex(0);

    const topicTitle = selectedPreset ? selectedPreset.title : customMateri;

    if (!topicTitle.trim()) {
      setErrorMessage("Silakan pilih materi atau tuliskan materi kustom terlebih dahulu.");
      setGenerationStatus("idle");
      return;
    }

    try {
      const response = await fetch("/api/modul-ajar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kelas: `Kelas ${kelas}`,
          materi: topicTitle,
          model: modelPembelajaran,
          semester,
          alokasi,
          customDirectives,
          namaSekolah,
          kabupaten,
          namaGuru,
          nipGuru,
          namaKepalaSekolah,
          nipKepalaSekolah,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Gagal menghubungi server untuk pembuatan modul.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Gagal membaca aliran data dari server.");
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonStr = line.slice(6);
              if (jsonStr.trim() === "[DONE]") continue;

              const data = JSON.parse(jsonStr);
              if (data.error) {
                throw new Error(data.error);
              }

              if (data.text) {
                setStreamingText((prev) => prev + data.text);
              }
            } catch (err: any) {
              if (line.includes("[DONE]")) continue;
              console.warn("Parse error on line:", line, err);
            }
          }
        }
      }

      // Check if we actually got content
      setStreamingText((finalText) => {
        if (!finalText.trim()) {
          throw new Error("Server mengembalikan respon kosong. Pastikan kunci API Gemini sudah terpasang.");
        }

        // Successfully generated
        const newModul: ModulAjar = {
          id: `modul-${Date.now()}`,
          title: `Modul Ajar Informatika Kelas ${kelas} - ${topicTitle.split(" (")[0]}`,
          grade: kelas,
          materi: topicTitle,
          model: modelPembelajaran,
          semester,
          alokasi,
          content: finalText,
          customDirectives: customDirectives || undefined,
          createdAt: new Date().toLocaleDateString("id-ID"),
        };

        saveModul(newModul);
        setCurrentModul(newModul);
        setGenerationStatus("idle");
        return finalText;
      });

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Terjadi kesalahan koneksi saat menyusun modul.");
      setGenerationStatus("error");
    }
  };

  // Edit Modul Ajar handler (SSE client for revision Co-Pilot)
  const handleEditWithAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentModul) return;
    if (!chatInstruction.trim()) return;

    setErrorMessage(null);
    const originalContent = currentModul.content;
    setStreamingText("");
    setGenerationStatus("editing");
    setReassuranceIndex(6); // Start at steps of pedagogis/Langkah-langkah

    // Add user message to history
    const userMsg: ChatMessage = {
      id: `chat-${Date.now()}`,
      role: "user",
      text: `[${chatSection}] ${chatInstruction}`,
      createdAt: new Date().toLocaleTimeString("id-ID"),
    };
    setChatHistory((prev) => [...prev, userMsg]);

    try {
      const response = await fetch("/api/modul-ajar/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentContent: originalContent,
          instruction: chatInstruction,
          targetSection: chatSection,
          namaSekolah,
          kabupaten,
          namaGuru,
          nipGuru,
          namaKepalaSekolah,
          nipKepalaSekolah,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Gagal menghubungi server untuk merevisi modul.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Gagal membaca aliran data revisi dari server.");
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonStr = line.slice(6);
              if (jsonStr.trim() === "[DONE]") continue;

              const data = JSON.parse(jsonStr);
              if (data.error) {
                throw new Error(data.error);
              }

              if (data.text) {
                setStreamingText((prev) => prev + data.text);
              }
            } catch (err: any) {
              if (line.includes("[DONE]")) continue;
              console.warn("Parse error on line:", line, err);
            }
          }
        }
      }

      setStreamingText((finalText) => {
        if (!finalText.trim()) {
          throw new Error("Server mengembalikan respon kosong untuk revisi.");
        }

        // Successfully edited
        const updatedModul: ModulAjar = {
          ...currentModul,
          content: finalText,
        };

        saveModul(updatedModul);
        setCurrentModul(updatedModul);
        setGenerationStatus("idle");

        // Add assistant confirmation to history
        const assistantMsg: ChatMessage = {
          id: `chat-${Date.now() + 1}`,
          role: "assistant",
          text: `Berhasil merombak Modul Ajar berdasarkan permintaan: "${chatInstruction}". Silakan periksa perubahan di layar utama!`,
          createdAt: new Date().toLocaleTimeString("id-ID"),
        };
        setChatHistory((prev) => [...prev, assistantMsg]);
        setChatInstruction(""); // clear input

        return finalText;
      });

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Terjadi kesalahan koneksi saat merevisi modul.");
      setGenerationStatus("error");

      const assistantErrorMsg: ChatMessage = {
        id: `chat-${Date.now() + 1}`,
        role: "assistant",
        text: `Maaf, saya menemui error saat merombak modul: ${err.message || "Gagal terhubung."}`,
        createdAt: new Date().toLocaleTimeString("id-ID"),
      };
      setChatHistory((prev) => [...prev, assistantErrorMsg]);
    }
  };

  // Utilities
  const getCleanContent = (content: string): string => {
    if (!content) return "";
    const signatureIndex = content.search(/###?\s*HALAMAN\s*PENGESAHAN/i);
    if (signatureIndex !== -1) {
      return content.substring(0, signatureIndex).trim();
    }
    return content.trim();
  };

  const getExportContent = (content: string): string => {
    const clean = getCleanContent(content);
    const sekolah = namaSekolah || "..................................................";
    const kepala = namaKepalaSekolah || "..................................................";
    const nipKepala = nipKepalaSekolah || "..................................................";
    const guru = namaGuru || "..................................................";
    const nipG = nipGuru || "..................................................";
    const tgl = tanggalDokumen || "..........................";
    return `${clean}

---

### HALAMAN PENGESAHAN

Kalibaru, ${tgl}

Mengetahui,
Kepala ${sekolah}


**${kepala}**
NIP. ${nipKepala}

Guru Mata Pelajaran Informatika


**${guru}**
NIP. ${nipG}
`;
  };

  const handleCopyMarkdown = () => {
    if (!currentModul) return;
    const contentToCopy = getExportContent(currentModul.content);
    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    if (!currentModul) return;
    const contentToDownload = getExportContent(currentModul.content);
    const blob = new Blob([contentToDownload], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${currentModul.title.replace(/\s+/g, "_")}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDeleteModul = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Apakah Anda yakin ingin menghapus modul ajar ini dari pustaka Anda?")) {
      await deleteModul(id);
      const filtered = modulList.filter((m) => m.id !== id);
      if (currentModul?.id === id) {
        setCurrentModul(filtered.length > 0 ? filtered[0] : null);
      }
    }
  };

  const filteredLibrary = modulList.filter((m) => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.materi.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-sky-100 selection:text-sky-900">
      
      {/* 1. HEADER (No-print area) */}
      <header className="bg-white text-slate-800 border-b border-slate-200/80 py-4 px-6 sticky top-0 z-40 no-print shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-slate-900 rounded-xl shadow-inner text-sky-400 flex items-center justify-center">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
                  Asisten Guru Informatika SMP
                </h1>
                <span className="text-xs bg-sky-50 text-sky-600 border border-sky-200 font-semibold px-2.5 py-0.5 rounded-full">
                  Fase D (CP 2026)
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-sky-500" /> {namaSekolah}, {kabupaten}
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-sky-500" /> Guru: {namaGuru}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab("create"); setChatOpen(false); }}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === "create" 
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Susun Modul
            </button>
            <button
              onClick={() => { setActiveTab("library"); setChatOpen(false); }}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === "library" 
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Pustaka Modul
              {modulList.length > 0 && (
                <span className="bg-sky-100 text-sky-800 text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {modulList.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab("settings"); setChatOpen(false); }}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === "settings" 
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Settings className="w-4 h-4" />
              Pengaturan
            </button>

            {/* 1B. FIREBASE AUTH & CLOUD SYNC WIDGET */}
            {authLoading ? (
              <div className="w-8 h-8 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
              </div>
            ) : !user ? (
              <button
                onClick={async () => {
                  try {
                    await signInWithPopup(auth, googleProvider);
                  } catch (err) {
                    console.error("Gagal masuk dengan Google:", err);
                  }
                }}
                className="px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100"
                title="Masuk untuk mencadangkan modul ke Cloud"
              >
                <LogIn className="w-4 h-4" />
                Masuk
              </button>
            ) : (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
                <div className="flex items-center gap-1.5" title={syncing ? "Sinkronisasi..." : "Data Tersinkron ke Cloud"}>
                  {syncing ? (
                    <Cloud className="w-4 h-4 text-sky-500 animate-pulse" />
                  ) : (
                    <Cloud className="w-4 h-4 text-emerald-500" />
                  )}
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "User"}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-full border border-slate-200"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                      {user.displayName?.charAt(0) || "U"}
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => {
                    if (window.confirm("Apakah Anda yakin ingin keluar dari akun Google Anda?")) {
                      try {
                        await signOut(auth);
                      } catch (err) {
                        console.error("Gagal keluar:", err);
                      }
                    }
                  }}
                  className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                  title="Keluar"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* 2. MAIN SPLIT CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        
        {/* LEFT PANEL: CONFIGURATOR / PRESETS (no-print) */}
        <section className="lg:col-span-5 flex flex-col gap-6 no-print">
          
          {activeTab === "create" ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-5">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div>
                  <h2 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2">
                    <Layers className="w-5 h-5 text-sky-600" />
                    Parameter Modul Ajar
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Model Pembelajaran Mendalam (Format 8334)</p>
                </div>
                <div className="text-xs font-mono text-slate-400 flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-md">
                  <Clock className="w-3.5 h-3.5 text-sky-600" /> Juli 2026
                </div>
              </div>

              <form onSubmit={handleGenerate} className="flex flex-col gap-4">
                {/* A. KELAS SELECTION */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    1. Pilih Kelas / Tingkatan
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["VII", "VIII", "IX"] as const).map((grade) => (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => {
                          setKelas(grade);
                          setSelectedPreset(null);
                        }}
                        className={`py-3 px-4 rounded-xl border text-center transition-all duration-200 flex flex-col items-center justify-center gap-1 ${
                          kelas === grade
                            ? "bg-sky-50 border-sky-400 text-sky-900 font-bold ring-2 ring-sky-500/15"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-base font-display">Kelas {grade}</span>
                        <span className="text-[10px] text-slate-400 font-normal">Fase D</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* B. PRESETS & TOPIC */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    2. Materi Pokok (Kurikulum Merdeka 2026)
                  </label>

                  {/* Preset list based on selected grade */}
                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 flex flex-col gap-1.5 scrollbar-thin mb-2">
                    {PRESET_TOPICS.filter((t) => t.grade === kelas).map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => handleSelectPreset(topic)}
                        className={`text-left p-2.5 rounded-lg border text-xs transition-all duration-150 flex items-start gap-2.5 group ${
                          selectedPreset?.id === topic.id
                            ? "bg-slate-800 border-slate-800 text-white shadow-sm shadow-slate-900/10"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                        }`}
                      >
                        <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold shrink-0 ${
                          selectedPreset?.id === topic.id
                            ? "bg-slate-700 text-white"
                            : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                        }`}>
                          {topic.element}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{topic.title}</p>
                          <p className={`text-[10px] truncate mt-0.5 ${
                            selectedPreset?.id === topic.id ? "text-sky-200" : "text-slate-500"
                          }`}>
                            {topic.description}
                          </p>
                        </div>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPreset(null);
                        setCustomMateri("");
                      }}
                      className={`text-left p-2.5 rounded-lg border text-xs transition-all duration-150 flex items-center gap-2 ${
                        !selectedPreset
                          ? "bg-slate-800 border-slate-800 text-white shadow-sm shadow-slate-900/10"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-semibold">Materi / Topik Kustom Lainnya...</span>
                    </button>
                  </div>

                  {/* Custom Topic Input if selected */}
                  {!selectedPreset && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2"
                    >
                      <input
                        type="text"
                        value={customMateri}
                        onChange={(e) => setCustomMateri(e.target.value)}
                        placeholder="Ketik topik kustom (misal: Keamanan Siber Dasar)..."
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none bg-white font-medium"
                      />
                    </motion.div>
                  )}
                </div>

                {/* C. SEMESTER, ALOKASI & MODEL PEMBELAJARAN */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Semester
                    </label>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    >
                      <option value="1 (Satu)">1 (Ganjil)</option>
                      <option value="2 (Dua)">2 (Genap)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Alokasi Waktu
                    </label>
                    <input
                      type="text"
                      value={alokasi}
                      onChange={(e) => setAlokasi(e.target.value)}
                      placeholder="e.g. 2 JP (2 x 40 menit)"
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Model Pembelajaran
                  </label>
                  <select
                    value={modelPembelajaran}
                    onChange={(e) => setModelPembelajaran(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  >
                    <option value="Problem Based Learning (PBL)">Problem Based Learning (PBL)</option>
                    <option value="Project Based Learning (PjBL)">Project Based Learning (PjBL)</option>
                    <option value="Inquiry Learning (Pembelajaran Inkuiri)">Inquiry Learning</option>
                    <option value="Discovery Learning (Pembelajaran Penemuan)">Discovery Learning</option>
                    <option value="Direct Instruction (Pengajaran Langsung)">Pengajaran Langsung</option>
                  </select>
                </div>

                {/* D. CUSTOM DIRECTIVES */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Fokus Khusus / Instruksi Tambahan (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={customDirectives}
                    onChange={(e) => setCustomDirectives(e.target.value)}
                    placeholder="Contoh: Fokuskan diferensiasi produk, sertakan koding Python list, integrasikan studi kasus perkebunan kopi Kalibaru..."
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-none bg-white focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 scrollbar-thin"
                  />
                </div>

                {/* E. IDENTITAS & PENGESAHAN DOKUMEN */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-1">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <User className="w-4 h-4 text-sky-600" />
                      Identitas & Pengesahan Modul
                    </span>
                    <span className="text-[10px] text-rose-500 font-bold">* Wajib Diisi</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                        Nama Sekolah
                      </label>
                      <input
                        type="text"
                        value={namaSekolah}
                        onChange={(e) => {
                          setNamaSekolah(e.target.value);
                          localStorage.setItem("asisten_guru_namaSekolah", e.target.value);
                        }}
                        placeholder="SMP Negeri 2 Kalibaru"
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                        Kabupaten
                      </label>
                      <input
                        type="text"
                        value={kabupaten}
                        onChange={(e) => {
                          setKabupaten(e.target.value);
                          localStorage.setItem("asisten_guru_kabupaten", e.target.value);
                        }}
                        placeholder="Banyuwangi"
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                        Nama Guru Pengampu
                      </label>
                      <input
                        type="text"
                        value={namaGuru}
                        onChange={(e) => {
                          setNamaGuru(e.target.value);
                          localStorage.setItem("asisten_guru_namaGuru", e.target.value);
                        }}
                        placeholder="Eko Widodo, S.Pd."
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                        NIP Guru
                      </label>
                      <input
                        type="text"
                        value={nipGuru}
                        onChange={(e) => {
                          setNipGuru(e.target.value);
                          localStorage.setItem("asisten_guru_nipGuru", e.target.value);
                        }}
                        placeholder="197803152014071003"
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                        Nama Kepala Sekolah
                      </label>
                      <input
                        type="text"
                        value={namaKepalaSekolah}
                        onChange={(e) => {
                          setNamaKepalaSekolah(e.target.value);
                          localStorage.setItem("asisten_guru_namaKepala", e.target.value);
                        }}
                        placeholder="Nama Kepala Sekolah..."
                        className="w-full text-xs p-2 border border-rose-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium text-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                        NIP Kepala Sekolah
                      </label>
                      <input
                        type="text"
                        value={nipKepalaSekolah}
                        onChange={(e) => {
                          setNipKepalaSekolah(e.target.value);
                          localStorage.setItem("asisten_guru_nipKepala", e.target.value);
                        }}
                        placeholder="NIP Kepala Sekolah..."
                        className="w-full text-xs p-2 border border-rose-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                      Tanggal / Periode Dokumen
                    </label>
                    <input
                      type="text"
                      value={tanggalDokumen}
                      onChange={(e) => {
                        setTanggalDokumen(e.target.value);
                        localStorage.setItem("asisten_guru_tanggalDokumen", e.target.value);
                      }}
                      placeholder="Juli 2026"
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                    />
                  </div>
                </div>

                {/* SUBMIT BUTTON */}
                <button
                  type="submit"
                  disabled={generationStatus === "generating" || generationStatus === "editing"}
                  className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 ${
                    generationStatus === "generating" || generationStatus === "editing"
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                      : "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]"
                  }`}
                >
                  <Sparkles className="w-5 h-5 text-sky-400" />
                  Susun Modul Ajar 8334
                </button>
              </form>
            </div>
          ) : activeTab === "library" ? (
            // LIBRARY TAB VIEW
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-sky-600" />
                  Pustaka Modul Saya
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Modul yang telah berhasil disusun dan disimpan</p>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  placeholder="Cari modul pustaka..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              {/* Stored lists */}
              <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
                {filteredLibrary.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 flex flex-col items-center justify-center gap-2">
                    <FileText className="w-8 h-8 text-slate-300" />
                    <p className="text-xs">Tidak ada modul yang cocok atau tersimpan.</p>
                  </div>
                ) : (
                  filteredLibrary.map((modul) => (
                    <div
                      key={modul.id}
                      onClick={() => {
                        setCurrentModul(modul);
                        setStreamingText("");
                        setGenerationStatus("idle");
                      }}
                      className={`p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer flex justify-between items-start gap-2 ${
                        currentModul?.id === modul.id
                          ? "bg-sky-50 border-sky-400/30 ring-1 ring-sky-500/5"
                          : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded">
                            Kelas {modul.grade}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {modul.createdAt}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-800 truncate">
                          {modul.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
                          {modul.model}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteModul(modul.id, e)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all duration-150 shrink-0"
                        title="Hapus Modul"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            // APPLICATION CONFIGURATION SETTINGS VIEW
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-5">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div>
                  <h2 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2">
                    <Settings className="w-5 h-5 text-sky-600" />
                    Pengaturan Aplikasi
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Personalisasi Identitas Dokumen Modul Ajar</p>
                </div>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                localStorage.setItem("asisten_guru_namaSekolah", namaSekolah);
                localStorage.setItem("asisten_guru_kabupaten", kabupaten);
                localStorage.setItem("asisten_guru_namaGuru", namaGuru);
                localStorage.setItem("asisten_guru_nipGuru", nipGuru);
                localStorage.setItem("asisten_guru_namaKepala", namaKepalaSekolah);
                localStorage.setItem("asisten_guru_nipKepala", nipKepalaSekolah);
                localStorage.setItem("asisten_guru_tanggalDokumen", tanggalDokumen);
                
                if (user) {
                  try {
                    await setDoc(doc(db, "users", user.uid), {
                      namaSekolah,
                      kabupaten,
                      namaGuru,
                      nipGuru,
                      namaKepalaSekolah,
                      nipKepalaSekolah,
                      tanggalDokumen,
                      updatedAt: new Date().toISOString()
                    });
                  } catch (err) {
                    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
                  }
                }

                setSettingsSaved(true);
                setTimeout(() => setSettingsSaved(false), 3000);
              }} className="flex flex-col gap-4 text-xs">
                
                {/* SCHOOL NAME & REGENCY */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nama Sekolah
                    </label>
                    <input
                      type="text"
                      value={namaSekolah}
                      onChange={(e) => setNamaSekolah(e.target.value)}
                      placeholder="SMP Negeri 2 Kalibaru"
                      className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Kabupaten
                    </label>
                    <input
                      type="text"
                      value={kabupaten}
                      onChange={(e) => setKabupaten(e.target.value)}
                      placeholder="Banyuwangi"
                      className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                    />
                  </div>
                </div>

                {/* TEACHER INFO */}
                <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-100 flex flex-col gap-3">
                  <span className="font-semibold text-slate-800 text-[10px] uppercase tracking-wide">
                    Identitas Guru Pengampu
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-slate-500 mb-1 font-medium">Nama Guru</label>
                      <input
                        type="text"
                        value={namaGuru}
                        onChange={(e) => setNamaGuru(e.target.value)}
                        placeholder="Eko Widodo, S.Pd."
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-500 mb-1 font-medium">NIP Guru</label>
                      <input
                        type="text"
                        value={nipGuru}
                        onChange={(e) => setNipGuru(e.target.value)}
                        placeholder="197803152014071003"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* PRINCIPAL INFO */}
                <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-100 flex flex-col gap-3">
                  <span className="font-semibold text-slate-800 text-[10px] uppercase tracking-wide">
                    Identitas Kepala Sekolah (Validator)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-slate-500 mb-1 font-medium">Nama Kepala Sekolah</label>
                      <input
                        type="text"
                        value={namaKepalaSekolah}
                        onChange={(e) => setNamaKepalaSekolah(e.target.value)}
                        placeholder="Hj. Sitti Maryam, S.Pd., M.Pd."
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-500 mb-1 font-medium">NIP Kepala Sekolah</label>
                      <input
                        type="text"
                        value={nipKepalaSekolah}
                        onChange={(e) => setNipKepalaSekolah(e.target.value)}
                        placeholder="196708211993031005"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* DATE OF DOCUMENT */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tanggal/Periode Penandatanganan
                  </label>
                  <input
                    type="text"
                    value={tanggalDokumen}
                    onChange={(e) => setTanggalDokumen(e.target.value)}
                    placeholder="Juli 2026"
                    className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Misal: "Juli 2026", "15 Juli 2026", atau dikosongkan dengan "......................"
                  </p>
                </div>

                {/* SAVE BUTTON */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex-1">
                    {settingsSaved && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-fade-in">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        Pengaturan Disimpan!
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="py-2.5 px-6 rounded-xl font-bold text-xs bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-md active:scale-95 flex items-center gap-2"
                  >
                    Simpan Pengaturan
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SCHOOL INFO BLOCK & TIPS */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-md flex items-start gap-4">
            <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20 flex items-center justify-center shrink-0">
              <Compass className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold tracking-tight">Kearifan Lokal Banyuwangi</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-1">
                AI otomatis menyisipkan studi kasus lokal (Kawah Ijen, kopi Kalibaru, buah naga) ke dalam soal Computational Thinking dan LKPD untuk mewujudkan prinsip <strong>Meaningful</strong> dalam Format 8334.
              </p>
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: MAIN WORKBENCH & PREVIEW (print optimized) */}
        <section className="lg:col-span-7 flex flex-col gap-4 min-w-0 print-container">
          
          {/* Main Document Frame */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-[500px]">
            
            {/* Top Toolbar (no-print) */}
            {currentModul || generationStatus !== "idle" ? (
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-sky-600 shrink-0" />
                    <h3 className="font-semibold text-slate-800 text-sm truncate">
                      {generationStatus === "generating" ? "Menyusun Modul Baru..." : currentModul?.title}
                    </h3>
                  </div>
                  {currentModul && (
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                      Materi: {currentModul.materi}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {/* Formatted vs raw toggle */}
                  <div className="bg-slate-200/60 p-0.5 rounded-lg flex border border-slate-200">
                    <button
                      onClick={() => setShowRawMarkdown(false)}
                      className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-all ${
                        !showRawMarkdown ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                      title="Pratinjau Rapi"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowRawMarkdown(true)}
                      className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-all ${
                        showRawMarkdown ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                      title="Kode Markdown"
                    >
                      <Code className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="h-4 w-px bg-slate-300"></div>

                  <button
                    onClick={handleCopyMarkdown}
                    className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    title="Salin Markdown"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-sky-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{copied ? "Tersalin" : "Salin"}</span>
                  </button>

                  <button
                    onClick={handleDownloadFile}
                    className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    title="Download File (.md)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Unduh</span>
                  </button>

                  <button
                    onClick={handlePrint}
                    className="p-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    title="Cetak Modul (Print/PDF)"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cetak</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Document Body Area */}
            <div className="p-6 md:p-8 flex-1 overflow-y-auto bg-white max-h-[650px] relative scrollbar-thin print-content-body">
              
              {/* Loader overlay during generation */}
              {(generationStatus === "generating" || generationStatus === "editing") && (
                <div className="absolute inset-x-0 top-0 bg-white/95 backdrop-blur-sm z-10 p-6 border-b border-slate-200 shadow-sm flex flex-col items-center justify-center text-center no-print min-h-[160px]">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-6 h-6 text-sky-600 animate-spin" />
                    <span className="font-display font-bold text-slate-900 text-base">
                      {generationStatus === "generating" ? "AI Asisten Guru Menyusun Modul..." : "AI Co-Pilot Sedang Merombak Modul..."}
                    </span>
                  </div>
                  
                  {/* Reassurance text */}
                  <div className="mt-3 text-xs bg-slate-50 border border-slate-200 text-slate-600 px-4 py-2 rounded-xl shadow-inner font-medium animate-pulse">
                    {REASSURANCE_MESSAGES[reassuranceIndex]}
                  </div>

                  <p className="text-[10px] text-slate-400 mt-2 font-mono">
                    Harap tunggu, proses ini menghasilkan modul ajar utuh 20 bagian (~30-60 detik)
                  </p>
                </div>
              )}

              {/* Error state */}
              {generationStatus === "error" && errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-3 mb-6 no-print">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-xs">Gagal Menyusun Modul Ajar</h4>
                    <p className="text-xs mt-1 leading-relaxed">{errorMessage}</p>
                    <p className="text-[10px] text-red-500 mt-1 font-mono">
                      Solusi: Pastikan kunci GEMINI_API_KEY Anda sudah terdaftar di tab secrets platform.
                    </p>
                  </div>
                </div>
              )}

              {/* EMPTY STATE */}
              {!currentModul && generationStatus === "idle" && (
                <div className="h-full flex flex-col items-center justify-center text-center py-16 px-4">
                  <div className="p-5 bg-slate-50 border border-slate-200 text-slate-400 rounded-2xl mb-4 flex items-center justify-center">
                    <GraduationCap className="w-12 h-12 text-sky-600/60" />
                  </div>
                  <h3 className="font-display font-bold text-slate-800 text-base">
                    Asisten Pembuat Modul Kurikulum Merdeka (8334)
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mt-2 leading-relaxed">
                    Pilih salah satu materi standar di panel kiri atau buat materi kustom, lalu klik <strong>Susun Modul Ajar 8334</strong> untuk menghasilkan modul berstandar nasional yang lengkap dan terpersonalisasi untuk SMP Negeri 2 Kalibaru.
                  </p>
                  
                  <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-md">
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200 font-medium flex items-center gap-1">
                      <HeartHandshake className="w-3 h-3 text-sky-600" /> Mindful
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200 font-medium flex items-center gap-1">
                      <FileCheck className="w-3 h-3 text-sky-600" /> Meaningful
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200 font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-sky-600" /> Joyful
                    </span>
                  </div>
                </div>
              )}

              {/* DOCUMENT CONTENT PREVIEW */}
              {(currentModul || streamingText) && (
                <div className="markdown-body">
                  {showRawMarkdown ? (
                    <textarea
                      readOnly
                      value={getExportContent(streamingText || currentModul?.content || "")}
                      className="w-full h-[550px] font-mono text-xs p-4 bg-slate-900 text-slate-100 rounded-xl outline-none resize-none border border-slate-800 scrollbar-thin"
                    />
                  ) : (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {getCleanContent(streamingText || currentModul?.content || "")}
                      </ReactMarkdown>

                       {/* Dynamic Halaman Pengesahan for Preview and Printing */}
                      <div className="mt-16 pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-sm leading-relaxed break-inside-avoid">
                        <div className="flex flex-col">
                          <p className="text-slate-600 font-medium">Mengetahui,</p>
                          <p className="text-slate-800 font-bold">Kepala {namaSekolah || ".................................................."}</p>
                          <div className="h-24"></div> {/* Signature Space */}
                          <p className="font-bold text-slate-900 underline decoration-slate-400 decoration-1 underline-offset-4">{namaKepalaSekolah || ".................................................."}</p>
                          <p className="text-xs text-slate-500 font-mono">NIP. {nipKepalaSekolah || ".................................................."}</p>
                        </div>
                        <div className="flex flex-col text-right">
                          <p className="text-slate-600 font-medium">Kalibaru, {tanggalDokumen || ".........................."}</p>
                          <p className="text-slate-800 font-bold">Guru Mata Pelajaran Informatika</p>
                          <div className="h-24"></div> {/* Signature Space */}
                          <p className="font-bold text-slate-900 underline decoration-slate-400 decoration-1 underline-offset-4">{namaGuru || ".................................................."}</p>
                          <p className="text-xs text-slate-500 font-mono">NIP. {nipGuru || ".................................................."}</p>
                        </div>
                      </div>
                    </>
                  )}
                  <div ref={resultEndRef} />
                </div>
              )}

            </div>
          </div>

          {/* 3. CO-PILOT CHAT EDITOR COLLAPSIBLE DRAWERE (no-print) */}
          {currentModul && generationStatus === "idle" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden no-print">
              
              {/* Chat Header */}
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="w-full px-5 py-4 bg-slate-900 text-white flex items-center justify-between transition-all duration-150 hover:bg-slate-800"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="p-1.5 bg-sky-600 rounded-lg text-white">
                    <Edit3 className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">
                      AI Co-Pilot: Rombak / Revisi Bagian Modul
                    </h4>
                    <p className="text-[10px] text-slate-400">Punya instruksi khusus? Revisi bagian tertentu dengan AI</p>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 transition-transform duration-200 ${chatOpen ? "rotate-90" : ""}`} />
              </button>

              {/* Chat Expansion */}
              <AnimatePresence>
                {chatOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-200 bg-slate-50"
                  >
                    <div className="p-4 flex flex-col gap-3">
                      
                      {/* Past chat changes log if any */}
                      {chatHistory.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto flex flex-col gap-2 scrollbar-thin">
                          {chatHistory.map((chat) => (
                            <div key={chat.id} className="text-xs">
                              <span className={`font-bold ${chat.role === "user" ? "text-slate-700" : "text-sky-700"}`}>
                                {chat.role === "user" ? "Anda: " : "Co-Pilot: "}
                              </span>
                              <span className="text-slate-600">{chat.text}</span>
                              <span className="text-[9px] text-slate-400 ml-1">({chat.createdAt})</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <form onSubmit={handleEditWithAI} className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                          <label className="text-xs font-bold text-slate-600">
                            Bagian yang Ingin Direvisi:
                          </label>
                          <select
                            value={chatSection}
                            onChange={(e) => setChatSection(e.target.value)}
                            className="sm:col-span-2 text-xs p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-sky-500/20"
                          >
                            <option value="Semua bagian (Modul Utuh)">Semua bagian (Modul Utuh)</option>
                            <option value="A. Informasi Umum">A. Informasi Umum</option>
                            <option value="C. Tujuan Pembelajaran">C-D. Tujuan & Indikator</option>
                            <option value="G. Pembelajaran Mendalam (8334)">G. Pembelajaran Mendalam (8334)</option>
                            <option value="H. Langkah-Langkah Pembelajaran">H. Langkah Pembelajaran</option>
                            <option value="I. Pembelajaran Berdiferensiasi">I. Diferensiasi</option>
                            <option value="J. Computational Thinking">J-K. Computational Thinking & Koding</option>
                            <option value="M. Asesmen">M. Asesmen & Rubrik Penilaian</option>
                            <option value="N. Lembar Kerja Peserta Didik (LKPD)">N. Lembar Kerja Peserta Didik (LKPD)</option>
                          </select>
                        </div>

                        <div className="relative">
                          <input
                            type="text"
                            value={chatInstruction}
                            onChange={(e) => setChatInstruction(e.target.value)}
                            placeholder="Tulis instruksi revisi (misal: 'Tambahkan koding Python', 'Ubah LKPD ke tugas kolaboratif kelompok')..."
                            className="w-full text-xs pl-3 pr-10 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                          />
                          <button
                            type="submit"
                            disabled={!chatInstruction.trim()}
                            className="p-1.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 absolute right-2 top-2 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </form>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          )}

        </section>

      </main>

      {/* FOOTER (no-print) */}
      <footer className="bg-slate-900 text-slate-400 py-6 px-6 border-t border-slate-800 text-center text-xs mt-12 no-print">
        <p className="font-mono">
          Asisten Guru Informatika SMP | Kurikulum Nasional CP 2026 | Pembelajaran Mendalam Format 8334
        </p>
        <p className="mt-1.5 text-slate-500">
          SMP Negeri 2 Kalibaru, Kabupaten Banyuwangi. Dirancang khusus untuk mempermudah administrasi bapak/ibu guru.
        </p>
      </footer>

    </div>
  );
}
