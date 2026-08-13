/* =========================================================
   ABSEN MASKANA
   app.js - versi online / multi-HP / multi-laptop
   Supabase + Realtime + localStorage fallback
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     1. KONFIGURASI SUPABASE
     ========================================================= */

  const SUPABASE_URL =
    window.SUPABASE_URL ||
    window.supabaseUrl ||
    window.SUPABASE_CONFIG?.url ||
    "";

  const SUPABASE_KEY =
    window.SUPABASE_ANON_KEY ||
    window.SUPABASE_PUBLISHABLE_KEY ||
    window.supabaseAnonKey ||
    window.SUPABASE_CONFIG?.key ||
    "";

  let db = null;

  try {
    if (
      window.supabase &&
      typeof window.supabase.createClient === "function" &&
      SUPABASE_URL &&
      SUPABASE_KEY
    ) {
      db = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );
    }
  } catch (error) {
    console.error("Gagal membuat koneksi Supabase:", error);
  }

  /* =========================================================
     2. KONSTANTA
     ========================================================= */

  const STORAGE_PARTICIPANTS = "maskana_participants";
  const STORAGE_ATTENDANCE = "maskana_attendance";

  const TABLE_PARTICIPANTS = "participants";
  const TABLE_ATTENDANCE = "attendance";

  let participants = [];
  let attendance = [];

  let realtimeChannel = null;

  /* =========================================================
     3. HELPER DOM
     ========================================================= */

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value ?? "";
  }

  function show(el) {
    if (!el) return;
    el.hidden = false;
    el.style.display = "";
  }

  function hide(el) {
    if (!el) return;
    el.hidden = true;
    el.style.display = "none";
  }

  function safeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeCSV(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  /* =========================================================
     4. ID UNIK
     ========================================================= */

  function generateId() {
    const time = Date.now().toString(36).toUpperCase();

    const random = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    return `MKN-${time}-${random}`;
  }

  /* =========================================================
     5. TANGGAL / WAKTU
     ========================================================= */

  function nowDate() {
    return new Date();
  }

  function formatTime(dateValue) {
    const d = new Date(dateValue);

    if (Number.isNaN(d.getTime())) return "-";

    return d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }

  function formatDate(dateValue) {
    const d = new Date(dateValue);

    if (Number.isNaN(d.getTime())) return "-";

    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function updateClock() {
    const now = nowDate();

    setText(
      "today",
      now.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    );

    setText(
      "eventDate",
      now.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    );

    setText(
      "currentTime",
      now.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      })
    );
  }

  /* =========================================================
     6. LOCAL STORAGE
     ========================================================= */

  function loadLocalData() {
    try {
      const p = localStorage.getItem(STORAGE_PARTICIPANTS);
      const a = localStorage.getItem(STORAGE_ATTENDANCE);

      participants = p ? JSON.parse(p) : [];
      attendance = a ? JSON.parse(a) : [];

      if (!Array.isArray(participants)) participants = [];
      if (!Array.isArray(attendance)) attendance = [];
    } catch (error) {
      console.error("Gagal membaca localStorage:", error);

      participants = [];
      attendance = [];
    }
  }

  function saveLocalData() {
    try {
      localStorage.setItem(
        STORAGE_PARTICIPANTS,
        JSON.stringify(participants)
      );

      localStorage.setItem(
        STORAGE_ATTENDANCE,
        JSON.stringify(attendance)
      );
    } catch (error) {
      console.error("Gagal menyimpan localStorage:", error);
    }
  }

  /* =========================================================
     7. STATUS KONEKSI
     ========================================================= */

  function setConnectionStatus(online, message = "") {
    const candidates = [
      "connectionStatus",
      "dbStatus",
      "onlineStatus",
      "supabaseStatus"
    ];

    let el = null;

    for (const id of candidates) {
      el = byId(id);
      if (el) break;
    }

    if (!el) return;

    el.textContent =
      message ||
      (online ? "ONLINE" : "OFFLINE");

    el.classList.toggle("online", online);
    el.classList.toggle("offline", !online);
  }

  /* =========================================================
     8. LOAD PESERTA DARI SUPABASE
     ========================================================= */

  async function loadParticipantsFromSupabase() {
    if (!db) {
      console.warn("Supabase belum terhubung.");
      return false;
    }

    try {
      const { data, error } = await db
        .from(TABLE_PARTICIPANTS)
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      participants = Array.isArray(data) ? data : [];

      saveLocalData();
      renderParticipants();
      renderDashboard();

      setConnectionStatus(true, "ONLINE");

      return true;
    } catch (error) {
      console.error(
        "Gagal mengambil participants:",
        error
      );

      setConnectionStatus(false, "OFFLINE");

      return false;
    }
  }

  /* =========================================================
     9. LOAD KEHADIRAN DARI SUPABASE
     ========================================================= */

  async function loadAttendanceFromSupabase() {
    if (!db) return false;

    try {
      const { data, error } = await db
        .from(TABLE_ATTENDANCE)
        .select("*")
        .order("time", { ascending: false });

      if (error) throw error;

      attendance = Array.isArray(data) ? data : [];

      saveLocalData();
      renderAttendance();
      renderDashboard();

      setConnectionStatus(true, "ONLINE");

      return true;
    } catch (error) {
      console.error(
        "Gagal mengambil attendance:",
        error
      );

      setConnectionStatus(false, "OFFLINE");

      return false;
    }
  }

  /* =========================================================
     10. LOAD SEMUA DATA
     ========================================================= */

  async function loadAllData() {
    loadLocalData();

    renderParticipants();
    renderAttendance();
    renderDashboard();

    if (!db) {
      setConnectionStatus(false, "MODE LOKAL");
      return;
    }

    await Promise.all([
      loadParticipantsFromSupabase(),
      loadAttendanceFromSupabase()
    ]);
  }

  /* =========================================================
     11. REALTIME SUPABASE
     ========================================================= */

  function subscribeRealtime() {
    if (!db) return;

    try {
      if (realtimeChannel) {
        db.removeChannel(realtimeChannel);
      }

      realtimeChannel = db
        .channel("maskana-live-sync")

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: TABLE_PARTICIPANTS
          },
          async () => {
            console.log(
              "Realtime: participants berubah"
            );

            await loadParticipantsFromSupabase();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: TABLE_ATTENDANCE
          },
          async () => {
            console.log(
              "Realtime: attendance berubah"
            );

            await loadAttendanceFromSupabase();
          }
        )

        .subscribe((status) => {
          console.log(
            "Supabase realtime:",
            status
          );
        });
    } catch (error) {
      console.error(
        "Gagal subscribe realtime:",
        error
      );
    }
  }

  /* =========================================================
     12. CARI PESERTA
     ========================================================= */

  function findParticipant(id) {
    if (!id) return null;

    const cleanId = String(id)
      .trim()
      .toLowerCase();

    return (
      participants.find(
        (p) =>
          String(p.id ?? "")
            .trim()
            .toLowerCase() === cleanId
      ) || null
    );
  }

  function findParticipantByName(name) {
    const clean = String(name ?? "")
      .trim()
      .toLowerCase();

    return (
      participants.find(
        (p) =>
          String(p.name ?? "")
            .trim()
            .toLowerCase() === clean
      ) || null
    );
  }

  /* =========================================================
     13. TAMBAH PESERTA
     ========================================================= */

  async function addParticipant(data) {
    const participant = {
      id: data.id || generateId(),
      name: String(data.name || "").trim(),
      phone: String(data.phone || "").trim(),
      village: String(data.village || "").trim(),
      district: String(data.district || "").trim(),
      regency: String(data.regency || "").trim()
    };

    if (!participant.name) {
      alert("Nama peserta wajib diisi.");
      return false;
    }

    const duplicate = participants.some(
      (p) =>
        String(p.id).toLowerCase() ===
        participant.id.toLowerCase()
    );

    if (duplicate) {
      alert("ID peserta sudah digunakan.");
      return false;
    }

    /* Tambahkan lokal dulu agar UI langsung berubah */
    participants.push(participant);
    saveLocalData();

    renderParticipants();
    renderDashboard();

    /* Kirim ke Supabase */
    if (db) {
      try {
        const { error } = await db
          .from(TABLE_PARTICIPANTS)
          .insert([participant]);

        if (error) {
          console.error(
            "Gagal menyimpan peserta:",
            error
          );

          /*
           * Jangan hapus data lokal.
           * Kita biarkan agar data tidak hilang
           * jika koneksi internet sedang bermasalah.
           */
          setConnectionStatus(false, "BELUM TERSINKRON");

          return false;
        }

        setConnectionStatus(true, "TERSINKRON");
      } catch (error) {
        console.error(error);

        setConnectionStatus(
          false,
          "KONEKSI BERMASALAH"
        );

        return false;
      }
    }

    return true;
  }

  /* =========================================================
     14. HAPUS PESERTA
     ========================================================= */

  async function deleteParticipant(id) {
    const participant = findParticipant(id);

    if (!participant) {
      alert("Peserta tidak ditemukan.");
      return;
    }

    const ok = confirm(
      `Hapus peserta "${participant.name}"?`
    );

    if (!ok) return;

    participants = participants.filter(
      (p) => p.id !== id
    );

    attendance = attendance.filter(
      (a) => a.participant_id !== id
    );

    saveLocalData();

    renderParticipants();
    renderAttendance();
    renderDashboard();

    if (!db) return;

    try {
      const { error } = await db
        .from(TABLE_PARTICIPANTS)
        .delete()
        .eq("id", id);

      if (error) throw error;

      setConnectionStatus(true, "TERSINKRON");
    } catch (error) {
      console.error(
        "Gagal menghapus peserta:",
        error
      );

      setConnectionStatus(false, "BELUM TERSINKRON");
    }
  }

  /* =========================================================
     15. CATAT KEHADIRAN
     ========================================================= */

  async function recordAttendance(participant) {
    if (!participant) {
      alert("Peserta tidak ditemukan.");
      return false;
    }

    const now = new Date();

    /*
     * Tabel attendance:
     * id
     * participant_id
     * time
     */

    const record = {
      participant_id: participant.id,
      time: now.toISOString()
    };

    /* Cek apakah sudah hadir */
    const alreadyLocal = attendance.some(
      (a) =>
        a.participant_id === participant.id &&
        new Date(a.time).toDateString() ===
          now.toDateString()
    );

    if (alreadyLocal) {
      showAttendanceSuccess(
        participant,
        "Peserta sudah tercatat hari ini."
      );

      return false;
    }

    /* Simpan lokal dulu */
    const localRecord = {
      id:
        Date.now() +
        Math.floor(Math.random() * 1000),
      ...record
    };

    attendance.unshift(localRecord);

    saveLocalData();

    renderAttendance();
    renderDashboard();

    /* Simpan online */
    if (db) {
      try {
        const { error } = await db
          .from(TABLE_ATTENDANCE)
          .insert([record]);

        if (error) {
          console.error(
            "Gagal menyimpan attendance:",
            error
          );

          setConnectionStatus(
            false,
            "KEHADIRAN BELUM ONLINE"
          );

          showAttendanceSuccess(
            participant,
            "Tersimpan sementara di perangkat."
          );

          return false;
        }

        setConnectionStatus(true, "TERSINKRON");

        showAttendanceSuccess(
          participant,
          "Kehadiran berhasil dan tersimpan online."
        );

        return true;
      } catch (error) {
        console.error(error);

        setConnectionStatus(
          false,
          "KONEKSI BERMASALAH"
        );

        showAttendanceSuccess(
          participant,
          "Tersimpan sementara."
        );

        return false;
      }
    }

    showAttendanceSuccess(
      participant,
      "Kehadiran berhasil."
    );

    return true;
  }

  /* =========================================================
     16. TAMPILKAN HASIL SCAN
     ========================================================= */

  function showAttendanceSuccess(
    participant,
    message
  ) {
    const name =
      participant.name || "Peserta";

    const avatar = name
      .substring(0, 2)
      .toUpperCase();

    setText("resultName", name);
    setText(
      "resultMessage",
      message || "Kehadiran berhasil!"
    );

    setText(
      "resultAvatar",
      avatar
    );

    setText(
      "resultVillage",
      participant.village || "-"
    );

    setText(
      "resultDistrict",
      participant.district || "-"
    );

    setText(
      "resultRegency",
      participant.regency || "-"
    );

    setText(
      "resultTime",
      formatTime(new Date())
    );

    /*
     * Beberapa kemungkinan ID card hasil scan
     */
    const ids = [
      "attendanceResult",
      "scanResult",
      "successResult",
      "hasilScan"
    ];

    for (const id of ids) {
      const el = byId(id);
      if (el) {
        show(el);
        break;
      }
    }
  }

  /* =========================================================
     17. PROSES QR / SCANNER
     ========================================================= */

  async function processScan(value) {
    const raw = String(value ?? "").trim();

    if (!raw) return;

    let id = raw;

    /*
     * Jika QR berisi URL:
     * https://.../?id=MKN-123
     */
    try {
      if (
        raw.startsWith("http://") ||
        raw.startsWith("https://")
      ) {
        const url = new URL(raw);

        id =
          url.searchParams.get("id") ||
          url.searchParams.get("participant") ||
          url.searchParams.get("peserta") ||
          raw;
      }
    } catch (_) {}

    /*
     * Jika QR berisi JSON
     */
    try {
      if (
        raw.startsWith("{") &&
        raw.endsWith("}")
      ) {
        const json = JSON.parse(raw);

        id =
          json.id ||
          json.participant_id ||
          json.participantId ||
          id;
      }
    } catch (_) {}

    const participant =
      findParticipant(id) ||
      findParticipantByName(id);

    if (!participant) {
      alert(
        `Peserta dengan kode "${id}" tidak ditemukan.`
      );

      return;
    }

    await recordAttendance(participant);
  }

  /* =========================================================
     18. RENDER PESERTA
     ========================================================= */

  function renderParticipants() {
    const containers = [
      byId("participantsList"),
      byId("participantList"),
      byId("dataPeserta"),
      byId("pesertaList")
    ].filter(Boolean);

    if (!containers.length) return;

    const queryInput =
      byId("participantSearch") ||
      byId("searchParticipant") ||
      byId("searchInput");

    const query = String(
      queryInput?.value || ""
    )
      .trim()
      .toLowerCase();

    const filtered = participants.filter(
      (p) => {
        if (!query) return true;

        return [
          p.id,
          p.name,
          p.phone,
          p.village,
          p.district,
          p.regency
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      }
    );

    const html = filtered
      .map(
        (p) => `
        <div class="participant-item">
          <div class="participant-info">
            <strong>${safeHTML(p.name)}</strong>
            <small>
              ID: ${safeHTML(p.id)}
            </small>
            <small>
              ${safeHTML(p.village || "-")},
              ${safeHTML(p.district || "-")},
              ${safeHTML(p.regency || "-")}
            </small>
            <small>
              ${safeHTML(p.phone || "-")}
            </small>
          </div>

          <div class="participant-actions">
            <button
              type="button"
              class="btn-delete-participant"
              data-id="${safeHTML(p.id)}"
            >
              Hapus
            </button>
          </div>
        </div>
        `
      )
      .join("");

    containers.forEach(
      (container) => {
        container.innerHTML =
          html ||
          `<div class="empty-state">
             Belum ada data peserta.
           </div>`;

        container
          .querySelectorAll(
            ".btn-delete-participant"
          )
          .forEach((button) => {
            button.addEventListener(
              "click",
              () => {
                deleteParticipant(
                  button.dataset.id
                );
              }
            );
          });
      }
    );

    setText(
      "participantCount",
      participants.length
    );

    setText(
      "totalParticipants",
      participants.length
    );
  }

  /* =========================================================
     19. RENDER KEHADIRAN
     ========================================================= */

  function renderAttendance() {
    const containers = [
      byId("attendanceList"),
      byId("attendanceTableBody"),
      byId("logAttendance"),
      byId("kehadiranList")
    ].filter(Boolean);

    if (!containers.length) return;

    const today = new Date();

    const todayAttendance =
      attendance.filter((a) => {
        const d = new Date(a.time);

        return (
          d.toDateString() ===
          today.toDateString()
        );
      });

    const html = todayAttendance
      .map((a) => {
        const p = findParticipant(
          a.participant_id
        );

        return `
          <tr>
            <td>
              ${safeHTML(
                p?.name || a.participant_id
              )}
            </td>

            <td>
              ${safeHTML(
                p?.village || "-"
              )}
            </td>

            <td>
              ${safeHTML(
                p?.district || "-"
              )}
            </td>

            <td>
              ${formatTime(a.time)}
            </td>

            <td>
              <span class="status-hadir">
                ✓ HADIR
              </span>
            </td>
          </tr>
        `;
      })
      .join("");

    containers.forEach((container) => {
      /*
       * Jika elemen berupa tbody,
       * langsung isi tr.
       */
      if (
        container.tagName === "TBODY"
      ) {
        container.innerHTML =
          html ||
          `
          <tr>
            <td colspan="5">
              Belum ada kehadiran hari ini.
            </td>
          </tr>
          `;
      } else {
        container.innerHTML =
          html ||
          `
          <div class="empty-state">
            Belum ada kehadiran hari ini.
          </div>
          `;
      }
    });

    setText(
      "attendanceCount",
      todayAttendance.length
    );

    setText(
      "todayAttendanceCount",
      todayAttendance.length
    );
  }

  /* =========================================================
     20. DASHBOARD
     ========================================================= */

  function renderDashboard() {
    const today = new Date();

    const todayAttendance =
      attendance.filter((a) => {
        const d = new Date(a.time);

        return (
          d.toDateString() ===
          today.toDateString()
        );
      });

    setText(
      "totalParticipants",
      participants.length
    );

    setText(
      "participantCount",
      participants.length
    );

    setText(
      "attendanceCount",
      todayAttendance.length
    );

    setText(
      "todayAttendanceCount",
      todayAttendance.length
    );

    const absent =
      Math.max(
        participants.length -
          todayAttendance.length,
        0
      );

    setText(
      "absentCount",
      absent
    );
  }

  /* =========================================================
     21. EKSPOR CSV
     ========================================================= */

  function exportCSV() {
    const rows = [
      [
        "ID",
        "Nama",
        "No HP",
        "Desa",
        "Kecamatan",
        "Kabupaten"
      ]
    ];

    participants.forEach((p) => {
      rows.push([
        p.id,
        p.name,
        p.phone,
        p.village,
        p.district,
        p.regency
      ]);
    });

    const csv = rows
      .map((row) =>
        row.map(escapeCSV).join(",")
      )
      .join("\n");

    const blob = new Blob(
      ["\ufeff" + csv],
      {
        type: "text/csv;charset=utf-8;"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download =
      `peserta-maskana-${Date.now()}.csv`;

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);
  }

  /* =========================================================
     22. DOWNLOAD KARTU PESERTA
     ========================================================= */

  function downloadCard(participant) {
    if (!participant) return;

    /*
     * Jika aplikasi Anda memiliki fungsi kartu sendiri,
     * event ini tidak akan mengganggunya.
     */

    const text = [
      "KARTU PESERTA MASKANA",
      "",
      `Nama       : ${participant.name}`,
      `ID         : ${participant.id}`,
      `No. HP     : ${participant.phone || "-"}`,
      `Desa       : ${participant.village || "-"}`,
      `Kecamatan  : ${participant.district || "-"}`,
      `Kabupaten  : ${participant.regency || "-"}`
    ].join("\n");

    const blob = new Blob(
      [text],
      { type: "text/plain;charset=utf-8" }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download =
      `kartu-${participant.id}.txt`;

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);
  }

  /* =========================================================
     23. FORM TAMBAH PESERTA
     ========================================================= */

  function setupParticipantForm() {
    const form =
      byId("participantForm");

    if (!form) {
      console.warn(
        "participantForm tidak ditemukan."
      );
      return;
    }

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const getValue = (...ids) => {
          for (const id of ids) {
            const el = byId(id);

            if (el) {
              return String(
                el.value || ""
              ).trim();
            }
          }

          return "";
        };

        const data = {
          id: getValue(
            "participantId",
            "idPeserta",
            "pesertaId"
          ),

          name: getValue(
            "participantName",
            "name",
            "namaPeserta",
            "nama"
          ),

          phone: getValue(
            "participantPhone",
            "phone",
            "noHp",
            "nomorHp"
          ),

          village: getValue(
            "participantVillage",
            "village",
            "desa"
          ),

          district: getValue(
            "participantDistrict",
            "district",
            "kecamatan"
          ),

          regency: getValue(
            "participantRegency",
            "regency",
            "kabupaten"
          )
        };

        if (!data.name) {
          alert(
            "Nama peserta belum diisi."
          );

          return;
        }

        const success =
          await addParticipant(data);

        if (success) {
          form.reset();

          alert(
            "Peserta berhasil ditambahkan."
          );
        } else {
          /*
           * Jika gagal online, peserta tetap
           * tersimpan lokal.
           */
          alert(
            "Peserta disimpan di perangkat. " +
            "Periksa koneksi internet/Supabase."
          );
        }
      }
    );
  }

  /* =========================================================
     24. INPUT SCANNER
     ========================================================= */

  function setupScanner() {
    const input =
      byId("scanInput") ||
      byId("scanCode") ||
      byId("qrInput") ||
      byId("scannerInput");

    if (!input) {
      console.warn(
        "Input scanner tidak ditemukan."
      );

      return;
    }

    input.addEventListener(
      "keydown",
      async (event) => {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();

        const value =
          input.value.trim();

        if (!value) return;

        await processScan(value);

        input.value = "";

        setTimeout(() => {
          input.focus();
        }, 50);
      }
    );

    input.addEventListener(
      "click",
      () => {
        input.focus();
      }
    );
  }

  /* =========================================================
     25. PENCARIAN
     ========================================================= */

  function setupSearch() {
    const inputs = [
      byId("participantSearch"),
      byId("searchParticipant"),
      byId("searchInput")
    ].filter(Boolean);

    inputs.forEach((input) => {
      input.addEventListener(
        "input",
        () => {
          renderParticipants();
        }
      );
    });
  }

  /* =========================================================
     26. TOMBOL NAVIGASI
     ========================================================= */

  function setupNavigation() {
    /*
     * Semua tombol dengan data-page
     */
    $all("[data-page]").forEach(
      (button) => {
        button.addEventListener(
          "click",
          (event) => {
            event.preventDefault();

            const page =
              button.dataset.page;

            if (!page) return;

            /*
             * Coba cari elemen target
             */
            const target =
              byId(page) ||
              document.querySelector(
                `[data-section="${page}"]`
              );

            if (target) {
              $all(
                ".page, .section, .content-section"
              ).forEach((section) => {
                section.classList.remove(
                  "active"
                );
              });

              target.classList.add(
                "active"
              );

              try {
                target.scrollIntoView({
                  behavior: "smooth",
                  block: "start"
                });
              } catch (_) {}
            }

            /*
             * Tandai menu aktif
             */
            $all(
              "[data-page]"
            ).forEach((item) => {
              item.classList.toggle(
                "active",
                item === button
              );
            });
          }
        );
      }
    );
  }

  /* =========================================================
     27. TOMBOL UMUM
     ========================================================= */

  function setupButtons() {
    /* Tambah peserta */
    const addButtons = [
      byId("addParticipant"),
      byId("btnAddParticipant"),
      byId("tambahPeserta")
    ].filter(Boolean);

    addButtons.forEach((button) => {
      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();

          const form =
            byId("participantForm");

          if (form) {
            show(form);

            const firstInput =
              form.querySelector(
                "input, select, textarea"
              );

            if (firstInput) {
              firstInput.focus();
            }
          }
        }
      );
    });

    /* Export */
    const exportButtons = [
      byId("exportCSV"),
      byId("btnExport"),
      byId("downloadCSV")
    ].filter(Boolean);

    exportButtons.forEach((button) => {
      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          exportCSV();
        }
      );
    });

    /* Refresh */
    const refreshButtons = [
      byId("refreshData"),
      byId("btnRefresh"),
      byId("refresh")
    ].filter(Boolean);

    refreshButtons.forEach((button) => {
      button.addEventListener(
        "click",
        async (event) => {
          event.preventDefault();

          await loadAllData();
        }
      );
    });

    /* Close */
    $all(
      "[data-close], .btn-close, .close-button"
    ).forEach((button) => {
      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();

          const targetId =
            button.dataset.close;

          if (targetId) {
            hide(byId(targetId));
          } else {
            const parent =
              button.closest(
                ".modal, .dialog, .popup"
              );

            if (parent) hide(parent);
          }
        }
      );
    });
  }

  /* =========================================================
     28. HANDLE ERROR GLOBAL
     ========================================================= */

  window.addEventListener(
    "error",
    (event) => {
      console.error(
        "JavaScript error:",
        event.error || event.message
      );
    }
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      console.error(
        "Promise error:",
        event.reason
      );
    }
  );

  /* =========================================================
     29. ONLINE / OFFLINE
     ========================================================= */

  window.addEventListener(
    "online",
    async () => {
      console.log(
        "Internet kembali."
      );

      setConnectionStatus(
        true,
        "ONLINE"
      );

      await loadAllData();

      subscribeRealtime();
    }
  );

  window.addEventListener(
    "offline",
    () => {
      console.log(
        "Perangkat offline."
      );

      setConnectionStatus(
        false,
        "OFFLINE"
      );
    }
  );

  /* =========================================================
     30. FOKUS KEMBALI KE APLIKASI
     ========================================================= */

  document.addEventListener(
    "visibilitychange",
    async () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        /*
         * Saat HP kembali membuka aplikasi,
         * ambil data terbaru dari server.
         */
        await loadAllData();
      }
    }
  );

  /* =========================================================
     31. INIT
     ========================================================= */

  async function init() {
    console.log(
      "================================"
    );

    console.log(
      "ABSEN MASKANA DIMULAI"
    );

    console.log(
      "Supabase:",
      db ? "TERHUBUNG" : "TIDAK TERHUBUNG"
    );

    console.log(
      "================================"
    );

    updateClock();

    setInterval(
      updateClock,
      1000
    );

    /*
     * Pasang event handler SEBELUM load data.
     *
     * Ini penting supaya kalau Supabase error,
     * tombol aplikasi tetap dapat digunakan.
     */
    setupParticipantForm();
    setupScanner();
    setupSearch();
    setupNavigation();
    setupButtons();

    /*
     * Render data lokal dulu.
     */
    loadLocalData();

    renderParticipants();
    renderAttendance();
    renderDashboard();

    /*
     * Baru ambil data online.
     */
    if (db) {
      await loadAllData();
      subscribeRealtime();
    } else {
      setConnectionStatus(
        false,
        "MODE LOKAL"
      );
    }

    /*
     * Fokus scanner jika tersedia.
     */
    const scanner =
      byId("scanInput") ||
      byId("scanCode") ||
      byId("qrInput") ||
      byId("scannerInput");

    if (scanner) {
      setTimeout(() => {
        try {
          scanner.focus();
        } catch (_) {}
      }, 300);
    }

    console.log(
      "ABSEN MASKANA SIAP"
    );
  }

  /* =========================================================
     32. JALANKAN SETELAH HTML SELESAI
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

  /* =========================================================
     33. API GLOBAL
     ========================================================= */

  window.Maskana = {
    db,

    getParticipants() {
      return participants;
    },

    getAttendance() {
      return attendance;
    },

    addParticipant,

    deleteParticipant,

    processScan,

    recordAttendance,

    refresh: loadAllData,

    exportCSV
  };

})();
