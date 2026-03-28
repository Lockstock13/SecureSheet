# PRD — Project Requirements Document: SecureSheet

## 1. Overview
**SecureSheet** adalah aplikasi mobile pengelola kata sandi (Password Manager) yang mengusung konsep *simple but complex*. Sederhana di sisi antarmuka (UI/UX), namun kompleks di sisi keamanan dan integrasi data. Fitur utamanya adalah penggunaan **Google Sheets** sebagai database eksternal/backup, memberikan kontrol penuh kepada pengguna atas data mereka sendiri tanpa bergantung pada server pihak ketiga.

## 2. Requirements
* **Keamanan:** Enkripsi AES-256 pada semua data sensitif sebelum disimpan.
* **Privasi:** Tidak ada server perantara; aplikasi berkomunikasi langsung dengan Google Sheets API.
* **Aksesibilitas:** Mendukung biometrik (FaceID/Fingerprint) untuk akses cepat.
* **Konektivitas:** Harus bisa bekerja secara offline (Local First) dan sinkronisasi otomatis saat ada internet.
* **Portabilitas:** Data harus bisa diekspor ke format Google Sheets yang rapi dan terbaca.

## 3. Core Features
* **Master Password & Biometric:** Pengaman utama aplikasi.
* **Auto-Sync Google Sheets:** Sinkronisasi dua arah antara aplikasi dan spreadsheet.
* **Password Generator:** Membuat kata sandi kuat yang dapat dikustomisasi.
* **Secure Clipboard:** Salin username/password dengan fitur hapus otomatis dari clipboard setelah 30 detik.
* **Category Management:** Pengelompokan akun berdasarkan kategori (Social, Finance, Work, dll).
* **Search & Filter:** Pencarian cepat berbasis judul atau URL.

## 4. User Flow
1.  **Onboarding:** User membuat Master Password -> Login ke Google Account -> App membuat file "SecureSheet_Database" di Google Drive.
2.  **Menambah Password:** User klik (+), isi detail, simpan -> Data dienkripsi lokal -> Background sync ke Google Sheets.
3.  **Mengakses Data:** User buka aplikasi -> Autentikasi Biometrik -> Cari akun -> Salin password.
4.  **Restore:** User ganti HP -> Login Google yang sama -> Input Master Password -> Data ditarik dari Google Sheets dan didekripsi kembali.

## 5. Architecture
* **Frontend:** Mobile App (Flutter/React Native).
* **Local Engine:** SQLite dengan SQLCipher untuk penyimpanan terenkripsi di memori HP.
* **Sync Engine:** Google Sheets API v4 sebagai remote storage.
* **Encryption Layer:** Client-side encryption (data dienkripsi di HP, bukan di cloud).

## 6. Database Schema
| Field | Type | Encryption | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | No | Unique ID |
| `account_name` | String | Yes | Nama akun (misal: Instagram) |
| `username` | String | Yes | Username/Email |
| `password` | String | Yes | Kata sandi terenkripsi |
| `pin` | String | Yes | Security PIN (Opsional) |
| `url` | String | No | Link website |
| `category` | String | No | Kategori akun |
| `notes` | String | Yes | Catatan terenkripsi tambahan |
| `updated_at` | DateTime | No | Timestamp terakhir diubah |

## 7. Tech Stack
* **Framework:** Flutter (untuk performa mobile yang smooth).
* **Database Lokal:** WatermelonDB atau Drift (SQLite).
* **Authentication:** Google Sign-In & OAuth 2.0.
* **Security:** Library `encrypt` (AES-256) dan `flutter_secure_storage`.

## 8. Design Guidelines
* **Style:** Modern Minimalist, "Clean & Focused".
* **Warna:** Dark Mode default (Deep Navy & Accent Blue).
* **Tipografi:** Sans-serif (Inter atau Roboto) untuk keterbacaan tinggi.
* **Komponen:** Card berbasis elevasi rendah, Floating Action Button (FAB) untuk tambah data, dan animasi transisi yang halus.

## 9. Development Process Flow
1.  **Sprint 1:** Setup enkripsi dasar dan database lokal (Local CRUD).
2.  **Sprint 2:** Integrasi Google Sheets API (Export/Import data).
3.  **Sprint 3:** Implementasi Biometrik dan Password Generator.
4.  **Sprint 4:** UI/UX Polishing (penerapan design guidelines).
5.  **Sprint 5:** Testing (Security Audit & Sync Stress Test).