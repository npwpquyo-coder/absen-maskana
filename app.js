(() => {
  "use strict";

  /* =====================================================
     KONFIGURASI
  ===================================================== */

  const SUPABASE_URL =
    window.SUPABASE_URL || "";

  const SUPABASE_KEY =
    window.SUPABASE_ANON_KEY || "";

  let supabase = null;

  if (
    window.supabase &&
    SUPABASE_URL &&
    SUPABASE_KEY
  ) {
    try {
      supabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );
    } catch (error) {
      console.error(
        "Supabase gagal dibuat:",
        error
      );
    }
  }

  /* =====================================================
     DATA
  ===================================================== */

  let participants = [];
  let attendance = [];

  let currentParticipant = null;

  const PARTICIPANT_TABLE =
    "participants";

  const ATTENDANCE_TABLE =
    "attendance";

  /* =====================================================
     HELPER
  ===================================================== */

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatTime(value) {
    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleTimeString(
      "id-ID",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }
    );
  }

  function formatDate(value) {
    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }
    );
  }

  function generateId() {
    return (
      "MKN-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase()
    );
  }

  /* =====================================================
     TOAST
  ===================================================== */

  function toast(message) {
    const el = $("toast");

    if (!el) {
      alert(message);
      return;
    }

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(window.maskanaToastTimer);

    window.maskanaToastTimer =
      setTimeout(() => {
        el.classList.remove("show");
      }, 3000);
  }

  /* =====================================================
     NAVIGASI TAB
  ===================================================== */

  function openTab(tabName) {
    const tabs =
      document.querySelectorAll(".tab");

    const navItems =
      document.querySelectorAll(
        ".nav-item"
      );

    tabs.forEach((tab) => {
      tab.classList.toggle(
        "active",
        tab.id === tabName
      );
    });

    navItems.forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.tab === tabName
      );
    });

    const titles = {
      dashboard:
        "Selamat datang 👋",

      scan:
        "Scan Kehadiran",

      peserta:
        "Data Peserta",

      rekap:
        "Rekap Kehadiran Desa"
    };

    $("pageTitle").textContent =
      titles[tabName] ||
      "Selamat datang 👋";

    /*
     * Jika masuk halaman scan,
     * fokuskan scanner.
     */
    if (tabName === "scan") {
      setTimeout(() => {
        const input =
          $("scanInput");

        if (input) {
          input.focus();
        }
      }, 100);
    }
  }

  function setupNavigation() {
    /*
     * MENU KIRI
     */
    document
      .querySelectorAll(".nav-item")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            openTab(
              button.dataset.tab
            );
          }
        );
      });

    /*
     * TOMBOL "Mulai scan"
     */
    document
      .querySelectorAll("[data-go]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            openTab(
              button.dataset.go
            );
          }
        );
      });
  }

  /* =====================================================
     TANGGAL
  ===================================================== */

  function updateDate() {
    const now = new Date();

    $("today").textContent =
      now
        .toLocaleDateString(
          "id-ID",
          {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
          }
        )
        .toUpperCase();

    $("eventDate").textContent =
      now.toLocaleDateString(
        "id-ID",
        {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        }
      );
  }

  /* =====================================================
     LOCAL STORAGE
  ===================================================== */

  function saveLocal() {
    localStorage.setItem(
      "maskana_participants",
      JSON.stringify(participants)
    );

    localStorage.setItem(
      "maskana_attendance",
      JSON.stringify(attendance)
    );
  }

  function loadLocal() {
    try {
      participants =
        JSON.parse(
          localStorage.getItem(
            "maskana_participants"
          ) || "[]"
        );

      attendance =
        JSON.parse(
          localStorage.getItem(
            "maskana_attendance"
          ) || "[]"
        );

      if (!Array.isArray(participants)) {
        participants = [];
      }

      if (!Array.isArray(attendance)) {
        attendance = [];
      }
    } catch (error) {
      console.error(error);

      participants = [];
      attendance = [];
    }
  }

  /* =====================================================
     SUPABASE LOAD PESERTA
  ===================================================== */

  async function loadParticipants() {
    if (!supabase) {
      return;
    }

    try {
      const result =
        await supabase
          .from(PARTICIPANT_TABLE)
          .select("*")
          .order("name", {
            ascending: true
          });

      if (result.error) {
        throw result.error;
      }

      participants =
        result.data || [];

      saveLocal();

      renderAll();

      console.log(
        "Peserta berhasil dimuat:",
        participants.length
      );
    } catch (error) {
      console.error(
        "Gagal mengambil peserta:",
        error
      );
    }
  }

  /* =====================================================
     SUPABASE LOAD KEHADIRAN
  ===================================================== */

  async function loadAttendance() {
    if (!supabase) {
      return;
    }

    try {
      const result =
        await supabase
          .from(ATTENDANCE_TABLE)
          .select("*")
          .order("time", {
            ascending: false
          });

      if (result.error) {
        throw result.error;
      }

      attendance =
        result.data || [];

      saveLocal();

      renderAll();

      console.log(
        "Kehadiran berhasil dimuat:",
        attendance.length
      );
    } catch (error) {
      console.error(
        "Gagal mengambil kehadiran:",
        error
      );
    }
  }

  /* =====================================================
     LOAD ONLINE
  ===================================================== */

  async function loadOnline() {
    if (!supabase) {
      console.warn(
        "Supabase belum terhubung."
      );

      return;
    }

    await Promise.all([
      loadParticipants(),
      loadAttendance()
    ]);
  }

  /* =====================================================
     REALTIME
  ===================================================== */

  function setupRealtime() {
    if (!supabase) {
      return;
    }

    try {
      supabase
        .channel(
          "maskana-realtime"
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: PARTICIPANT_TABLE
          },
          async () => {
            console.log(
              "Data peserta berubah."
            );

            await loadParticipants();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: ATTENDANCE_TABLE
          },
          async () => {
            console.log(
              "Data kehadiran berubah."
            );

            await loadAttendance();
          }
        )

        .subscribe();
    } catch (error) {
      console.error(
        "Realtime error:",
        error
      );
    }
  }

  /* =====================================================
     RENDER DASHBOARD
  ===================================================== */

  function renderDashboard() {
    const today =
      new Date().toDateString();

    const todayAttendance =
      attendance.filter((item) => {
        return (
          new Date(item.time)
            .toDateString() === today
        );
      });

    $("totalPeserta").textContent =
      participants.length;

    $("totalHadir").textContent =
      todayAttendance.length;

    const rate =
      participants.length
        ? Math.round(
            todayAttendance.length /
              participants.length *
              100
          )
        : 0;

    $("presentRate").textContent =
      `${rate}% dari peserta`;

    const villages =
      new Set(
        participants
          .map((p) => p.village)
          .filter(Boolean)
      );

    const hadirVillages =
      new Set(
        todayAttendance
          .map((a) => {
            const p =
              findParticipant(
                a.participant_id
              );

            return p?.village;
          })
          .filter(Boolean)
      );

    $("totalDesa").textContent =
      hadirVillages.size;

    $("villageRate").textContent =
      `Dari ${villages.size} desa terdaftar`;

    if (
      todayAttendance.length
    ) {
      const latest =
        todayAttendance[0];

      const p =
        findParticipant(
          latest.participant_id
        );

      if (p) {
        $("lastScan").textContent =
          p.name;

        $("lastTime").textContent =
          formatTime(latest.time);
      }
    } else {
      $("lastScan").textContent =
        "—";

      $("lastTime").textContent =
        "Belum ada kehadiran";
    }

    renderRecent();
    renderVillageBars();
  }

  /* =====================================================
     RECENT
  ===================================================== */

  function renderRecent() {
    const container =
      $("recentList");

    if (!container) return;

    const today =
      new Date().toDateString();

    const items =
      attendance
        .filter(
          (a) =>
            new Date(a.time)
              .toDateString() === today
        )
        .slice(0, 8);

    if (!items.length) {
      container.classList.add(
        "empty"
      );

      container.innerHTML =
        "Belum ada peserta yang hadir.";

      return;
    }

    container.classList.remove(
      "empty"
    );

    container.innerHTML =
      items
        .map((a) => {
          const p =
            findParticipant(
              a.participant_id
            );

          if (!p) return "";

          return `
            <div class="recent-item">
              <div class="recent-avatar">
                ${escapeHTML(
                  p.name
                    .substring(0, 2)
                    .toUpperCase()
                )}
              </div>

              <div>
                <strong>
                  ${escapeHTML(p.name)}
                </strong>

                <small>
                  ${escapeHTML(
                    p.village || "-"
                  )}
                </small>
              </div>

              <time>
                ${formatTime(a.time)}
              </time>
            </div>
          `;
        })
        .join("");
  }

  /* =====================================================
     VILLAGE BAR
  ===================================================== */

  function renderVillageBars() {
    const container =
      $("villageBars");

    if (!container) return;

    const map = {};

    participants.forEach((p) => {
      const village =
        p.village || "Tidak diketahui";

      if (!map[village]) {
        map[village] = {
          total: 0,
          hadir: 0
        };
      }

      map[village].total++;
    });

    const today =
      new Date().toDateString();

    attendance
      .filter(
        (a) =>
          new Date(a.time)
            .toDateString() === today
      )
      .forEach((a) => {
        const p =
          findParticipant(
            a.participant_id
          );

        if (!p) return;

        const village =
          p.village ||
          "Tidak diketahui";

        if (!map[village]) {
          map[village] = {
            total: 0,
            hadir: 0
          };
        }

        map[village].hadir++;
      });

    const entries =
      Object.entries(map)
        .sort(
          (a, b) =>
            b[1].hadir -
            a[1].hadir
        )
        .slice(0, 8);

    if (!entries.length) {
      container.classList.add(
        "empty"
      );

      container.innerHTML =
        "Belum ada data kehadiran.";

      return;
    }

    container.classList.remove(
      "empty"
    );

    container.innerHTML =
      entries
        .map(([village, data]) => {
          const percentage =
            data.total
              ? Math.round(
                  data.hadir /
                    data.total *
                    100
                )
              : 0;

          return `
            <div class="village-row">
              <div class="village-row-head">
                <span>
                  ${escapeHTML(village)}
                </span>

                <strong>
                  ${data.hadir}/${data.total}
                </strong>
              </div>

              <div class="bar">
                <span
                  style="width:${percentage}%"
                ></span>
              </div>
            </div>
          `;
        })
        .join("");
  }

  /* =====================================================
     RENDER PESERTA
  ===================================================== */

  function renderParticipants() {
    const tbody =
      $("participantRows");

    if (!tbody) return;

    const search =
      (
        $("participantSearch")
          ?.value || ""
      )
        .toLowerCase()
        .trim();

    const filtered =
      participants.filter(
        (p) => {
          const text =
            [
              p.name,
              p.phone,
              p.village,
              p.district,
              p.regency,
              p.id
            ]
              .join(" ")
              .toLowerCase();

          return text.includes(
            search
          );
        }
      );

    $("participantCount").textContent =
      `${participants.length} peserta terdaftar`;

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5"
              style="text-align:center;padding:30px">
            Belum ada data peserta.
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      filtered
        .map(
          (p) => `
            <tr>
              <td>
                <strong>
                  ${escapeHTML(p.name)}
                </strong>
                <small>
                  ${escapeHTML(p.id)}
                </small>
              </td>

              <td>
                ${escapeHTML(
                  [
                    p.village,
                    p.district,
                    p.regency
                  ]
                    .filter(Boolean)
                    .join(", ")
                )}
              </td>

              <td>
                ${escapeHTML(
                  p.phone || "-"
                )}
              </td>

              <td>
                <button
                  class="text-button qr-button"
                  data-id="${escapeHTML(p.id)}"
                >
                  Lihat QR
                </button>
              </td>

              <td>
                <button
                  class="text-button delete-button"
                  data-id="${escapeHTML(p.id)}"
                >
                  Hapus
                </button>
              </td>
            </tr>
          `
        )
        .join("");

    /*
     * Tombol QR
     */
    tbody
      .querySelectorAll(
        ".qr-button"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            const p =
              findParticipant(
                button.dataset.id
              );

            if (p) {
              showQR(p);
            }
          }
        );
      });

    /*
     * Tombol hapus
     */
    tbody
      .querySelectorAll(
        ".delete-button"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          async () => {
            await deleteParticipant(
              button.dataset.id
            );
          }
        );
      });
  }

  /* =====================================================
     CARI PESERTA
  ===================================================== */

  function findParticipant(id) {
    return participants.find(
      (p) =>
        String(p.id) ===
        String(id)
    );
  }

  /* =====================================================
     TAMBAH PESERTA
  ===================================================== */

  async function addParticipant(data) {
    const participant = {
      id: generateId(),
      name: data.name.trim(),
      phone: data.phone.trim(),
      village: data.village.trim(),
      district: data.district.trim(),
      regency: data.regency.trim()
    };

    /*
     * Simpan lokal dulu
     */
    participants.push(
      participant
    );

    saveLocal();
    renderAll();

    /*
     * Simpan ke Supabase
     */
    if (supabase) {
      try {
        const result =
          await supabase
            .from(PARTICIPANT_TABLE)
            .insert([
              participant
            ]);

        if (result.error) {
          throw result.error;
        }

        toast(
          "Peserta berhasil disimpan online."
        );
      } catch (error) {
        console.error(
          "Supabase insert peserta:",
          error
        );

        toast(
          "Tersimpan di perangkat, tetapi belum masuk server."
        );

        return;
      }
    }

    /*
     * Tampilkan QR
     */
    showQR(participant);
  }

  /* =====================================================
     HAPUS PESERTA
  ===================================================== */

  async function deleteParticipant(
    id
  ) {
    const participant =
      findParticipant(id);

    if (!participant) return;

    const ok =
      confirm(
        `Hapus peserta "${participant.name}"?`
      );

    if (!ok) return;

    participants =
      participants.filter(
        (p) =>
          String(p.id) !==
          String(id)
      );

    /*
     * Hapus kehadiran lokal
     */
    attendance =
      attendance.filter(
        (a) =>
          String(
            a.participant_id
          ) !== String(id)
      );

    saveLocal();

    renderAll();

    /*
     * Hapus online
     */
    if (supabase) {
      try {
        const result =
          await supabase
            .from(PARTICIPANT_TABLE)
            .delete()
            .eq("id", id);

        if (result.error) {
          throw result.error;
        }

        toast(
          "Peserta berhasil dihapus."
        );
      } catch (error) {
        console.error(error);

        toast(
          "Penghapusan server gagal."
        );
      }
    }
  }

  /* =====================================================
     FORM TAMBAH PESERTA
  ===================================================== */

  function setupParticipantForm() {
    const form =
      $("participantForm");

    if (!form) return;

    form.addEventListener(
      "submit",
      async (event) => {
        /*
         * Sangat penting:
         * cegah dialog ditutup otomatis
         */
        event.preventDefault();

        const formData =
          new FormData(form);

        const data = {
          name:
            formData.get("name") || "",

          phone:
            formData.get("phone") || "",

          village:
            formData.get("village") || "",

          district:
            formData.get("district") || "",

          regency:
            formData.get("regency") || ""
        };

        if (
          !data.name ||
          !data.phone ||
          !data.village ||
          !data.district ||
          !data.regency
        ) {
          toast(
            "Semua data peserta wajib diisi."
          );

          return;
        }

        await addParticipant(
          data
        );

        form.reset();

        $("participantModal").close();
      }
    );
  }

  /* =====================================================
     MODAL TAMBAH PESERTA
  ===================================================== */

  function setupParticipantModal() {
    const button =
      $("addParticipant");

    const modal =
      $("participantModal");

    if (
      !button ||
      !modal
    ) {
      return;
    }

    button.addEventListener(
      "click",
      () => {
        modal.showModal();
      }
    );
  }

  /* =====================================================
     QR
  ===================================================== */

  function showQR(participant) {
    currentParticipant =
      participant;

    $("cardName").textContent =
      participant.name;

    $("cardAddress").textContent =
      [
        participant.village,
        participant.district,
        participant.regency
      ]
        .filter(Boolean)
        .join(", ");

    $("cardPhone").textContent =
      participant.phone || "-";

    const qrContainer =
      $("qrCode");

    qrContainer.innerHTML = "";

    if (
      window.QRCode
    ) {
      new QRCode(
        qrContainer,
        {
          text:
            participant.id,
          width: 150,
          height: 150,
          correctLevel:
            QRCode.CorrectLevel.H
        }
      );
    }

    $("qrModal").showModal();
  }

  /* =====================================================
     TUTUP QR
  ===================================================== */

  function setupQRModal() {
    document
      .querySelectorAll(
        ".close-qr"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            $("qrModal").close();
          }
        );
      });
  }

  /* =====================================================
     DOWNLOAD KARTU
  ===================================================== */

  function setupDownloadCard() {
    const button =
      $("downloadCard");

    if (!button) return;

    button.addEventListener(
      "click",
      async () => {
        if (
          !window.html2canvas
        ) {
          toast(
            "html2canvas belum tersedia."
          );

          return;
        }

        const card =
          $("participantCard");

        try {
          const canvas =
            await html2canvas(
              card,
              {
                scale: 3,
                backgroundColor:
                  null
              }
            );

          const link =
            document.createElement(
              "a"
            );

          link.download =
            `kartu-${currentParticipant?.id || "peserta"}.png`;

          link.href =
            canvas.toDataURL(
              "image/png"
            );

          link.click();

          toast(
            "Kartu berhasil dibuat."
          );
        } catch (error) {
          console.error(error);

          toast(
            "Gagal membuat kartu."
          );
        }
      }
    );
  }

  /* =====================================================
     SCANNER
  ===================================================== */

  function setupScanner() {
    const input =
      $("scanInput");

    if (!input) return;

    input.addEventListener(
      "keydown",
      async (event) => {
        if (
          event.key !== "Enter"
        ) {
          return;
        }

        event.preventDefault();

        const code =
          input.value.trim();

        if (!code) return;

        await processScan(
          code
        );

        input.value = "";

        setTimeout(() => {
          input.focus();
        }, 100);
      }
    );

    input.addEventListener(
      "blur",
      () => {
        /*
         * Jangan paksa fokus jika
         * user sedang berada di halaman lain.
         */
      }
    );
  }

  /* =====================================================
     SCAN
  ===================================================== */

  async function processScan(
    code
  ) {
    let id = String(
      code || ""
    ).trim();

    /*
     * Jika QR berisi URL
     */
    try {
      if (
        id.startsWith(
          "http://"
        ) ||
        id.startsWith(
          "https://"
        )
      ) {
        const url =
          new URL(id);

        id =
          url.searchParams.get(
            "id"
          ) || id;
      }
    } catch (_) {}

    /*
     * Cari berdasarkan ID
     */
    let participant =
      findParticipant(id);

    /*
     * Coba cari berdasarkan nama
     */
    if (!participant) {
      participant =
        participants.find(
          (p) =>
            String(
              p.name
            )
              .toLowerCase() ===
            id.toLowerCase()
        );
    }

    if (!participant) {
      showScanError(
        `Kode peserta "${id}" tidak ditemukan.`
      );

      return;
    }

    await recordAttendance(
      participant
    );
  }

  /* =====================================================
     HASIL SCAN
  ===================================================== */

  function showScanError(
    message
  ) {
    $("scanResult").innerHTML = `
      <div class="result-placeholder">
        <div>!</div>
        <h3>Peserta tidak ditemukan</h3>
        <p>${escapeHTML(message)}</p>
      </div>
    `;
  }

  function showScanSuccess(
    participant,
    time
  ) {
    $("scanResult").innerHTML = `
      <div class="result-success">
        <div class="result-icon">✓</div>

        <p class="eyebrow">
          KEHADIRAN TERCATAT
        </p>

        <h3>
          ${escapeHTML(
            participant.name
          )}
        </h3>

        <p>
          ${escapeHTML(
            participant.village || "-"
          )}
          ·
          ${escapeHTML(
            participant.district || "-"
          )}
        </p>

        <strong>
          ${formatTime(time)}
        </strong>
      </div>
    `;
  }

  /* =====================================================
     CATAT KEHADIRAN
  ===================================================== */

  async function recordAttendance(
    participant
  ) {
    const now =
      new Date();

    /*
     * Cek sudah hadir hari ini
     */
    const already =
      attendance.some(
        (a) => {
          const samePerson =
            String(
              a.participant_id
            ) ===
            String(
              participant.id
            );

          const sameDay =
            new Date(a.time)
              .toDateString() ===
            now.toDateString();

          return (
            samePerson &&
            sameDay
          );
        }
      );

    if (already) {
      showScanSuccess(
        participant,
        now
      );

      toast(
        `${participant.name} sudah tercatat hadir hari ini.`
      );

      return;
    }

    const record = {
      participant_id:
        participant.id,

      time:
        now.toISOString()
    };

    /*
     * Supabase
     */
    if (supabase) {
      try {
        const result =
          await supabase
            .from(
              ATTENDANCE_TABLE
            )
            .insert([
              record
            ])
            .select();

        if (result.error) {
          throw result.error;
        }

        /*
         * Ambil data terbaru
         */
        await loadAttendance();

        showScanSuccess(
          participant,
          now
        );

        toast(
          "Kehadiran berhasil tersimpan online."
        );

        return;
      } catch (error) {
        console.error(
          "Gagal menyimpan attendance:",
          error
        );

        /*
         * Tetap simpan lokal
         */
        attendance.unshift({
          id: Date.now(),
          ...record
        });

        saveLocal();

        renderAll();

        showScanSuccess(
          participant,
          now
        );

        toast(
          "Internet bermasalah. Kehadiran tersimpan sementara."
        );

        return;
      }
    }

    /*
     * MODE LOKAL
     */
    attendance.unshift({
      id: Date.now(),
      ...record
    });

    saveLocal();

    renderAll();

    showScanSuccess(
      participant,
      now
    );
  }

  /* =====================================================
     RENDER ATTENDANCE
  ===================================================== */

  function renderAttendance() {
    const tbody =
      $("attendanceRows");

    if (!tbody) return;

    const search =
      (
        $("attendanceSearch")
          ?.value || ""
      )
        .toLowerCase()
        .trim();

    const today =
      new Date().toDateString();

    const rows =
      attendance.filter(
        (a) => {
          const sameDay =
            new Date(a.time)
              .toDateString() ===
            today;

          if (!sameDay) {
            return false;
          }

          const p =
            findParticipant(
              a.participant_id
            );

          if (!search) {
            return true;
          }

          return [
            p?.name,
            p?.village,
            p?.district
          ]
            .join(" ")
            .toLowerCase()
            .includes(search);
        }
      );

    $("attendanceCount").textContent =
      `${rows.length} peserta tercatat hadir`;

    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4"
              style="text-align:center;padding:30px">
            Belum ada peserta yang hadir.
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      rows
        .map((a) => {
          const p =
            findParticipant(
              a.participant_id
            );

          return `
            <tr>
              <td>
                <strong>
                  ${escapeHTML(
                    p?.name ||
                    a.participant_id
                  )}
                </strong>
              </td>

              <td>
                ${escapeHTML(
                  [
                    p?.village,
                    p?.district,
                    p?.regency
                  ]
                    .filter(Boolean)
                    .join(", ")
                )}
              </td>

              <td>
                ${formatTime(
                  a.time
                )}
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
  }

  /* =====================================================
     SEARCH KEHADIRAN
  ===================================================== */

  function setupAttendanceSearch() {
    const input =
      $("attendanceSearch");

    if (!input) return;

    input.addEventListener(
      "input",
      () => {
        renderAttendance();
      }
    );
  }

  /* =====================================================
     REKAP DESA
  ===================================================== */

  function renderRecap() {
    const tbody =
      $("recapRows");

    if (!tbody) return;

    const villages = {};

    participants.forEach(
      (p) => {
        const key =
          [
            p.village,
            p.district,
            p.regency
          ]
            .join("|");

        if (!villages[key]) {
          villages[key] = {
            village:
              p.village || "-",

            district:
              p.district || "-",

            regency:
              p.regency || "-",

            total: 0,
            hadir: 0
          };
        }

        villages[key].total++;
      }
    );

    const today =
      new Date().toDateString();

    attendance
      .filter(
        (a) =>
          new Date(a.time)
            .toDateString() ===
          today
      )
      .forEach((a) => {
        const p =
          findParticipant(
            a.participant_id
          );

        if (!p) return;

        const key =
          [
            p.village,
            p.district,
            p.regency
          ]
            .join("|");

        if (!villages[key]) {
          villages[key] = {
            village:
              p.village || "-",

            district:
              p.district || "-",

            regency:
              p.regency || "-",

            total: 0,
            hadir: 0
          };
        }

        villages[key].hadir++;
      });

    const data =
      Object.values(
        villages
      );

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6"
              style="text-align:center;padding:30px">
            Belum ada data desa.
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      data
        .sort(
          (a, b) =>
            a.village.localeCompare(
              b.village
            )
        )
        .map((v) => {
          const percentage =
            v.total
              ? Math.round(
                  v.hadir /
                    v.total *
                    100
                )
              : 0;

          return `
            <tr>
              <td>
                ${escapeHTML(
                  v.village
                )}
              </td>

              <td>
                ${escapeHTML(
                  v.district
                )}
              </td>

              <td>
                ${escapeHTML(
                  v.regency
                )}
              </td>

              <td>
                ${v.total}
              </td>

              <td>
                ${v.hadir}
              </td>

              <td>
                ${percentage}%
              </td>
            </tr>
          `;
        })
        .join("");

    renderRecapSummary(
      data
    );
  }

  function renderRecapSummary(
    data
  ) {
    const container =
      $("recapSummary");

    if (!container) return;

    const total =
      data.reduce(
        (sum, item) =>
          sum + item.total,
        0
      );

    const hadir =
      data.reduce(
        (sum, item) =>
          sum + item.hadir,
        0
      );

    const desa =
      data.length;

    const percentage =
      total
        ? Math.round(
            hadir /
              total *
              100
          )
        : 0;

    container.innerHTML = `
      <div class="recap-card">
        <strong>${desa}</strong>
        <span>Desa</span>
      </div>

      <div class="recap-card">
        <strong>${total}</strong>
        <span>Terdaftar</span>
      </div>

      <div class="recap-card">
        <strong>${hadir}</strong>
        <span>Hadir</span>
      </div>

      <div class="recap-card">
        <strong>${percentage}%</strong>
        <span>Kehadiran</span>
      </div>
    `;
  }

  /* =====================================================
     EXPORT CSV
  ===================================================== */

  function csvEscape(value) {
    return `"${String(
      value ?? ""
    ).replace(
      /"/g,
      '""'
    )}"`;
  }

  function exportCSV() {
    const rows = [
      [
        "ID",
        "Nama",
        "WhatsApp",
        "Desa",
        "Kecamatan",
        "Kabupaten",
        "Waktu Hadir"
      ]
    ];

    participants.forEach(
      (p) => {
        const records =
          attendance.filter(
            (a) =>
              String(
                a.participant_id
              ) ===
              String(p.id)
          );

        if (!records.length) {
          rows.push([
            p.id,
            p.name,
            p.phone,
            p.village,
            p.district,
            p.regency,
            ""
          ]);

          return;
        }

        records.forEach(
          (a) => {
            rows.push([
              p.id,
              p.name,
              p.phone,
              p.village,
              p.district,
              p.regency,
              formatDate(
                a.time
              ) +
                " " +
                formatTime(
                  a.time
                )
            ]);
          }
        );
      }
    );

    const csv =
      "\ufeff" +
      rows
        .map(
          (row) =>
            row
              .map(csvEscape)
              .join(",")
        )
        .join("\n");

    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8;"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `rekap-maskana-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );
  }

  /* =====================================================
     TOMBOL EXPORT
  ===================================================== */

  function setupExport() {
    $("exportBtn")
      ?.addEventListener(
        "click",
        exportCSV
      );

    $("exportBtn2")
      ?.addEventListener(
        "click",
        exportCSV
      );
  }

  /* =====================================================
     WHATSAPP
  ===================================================== */

  function setupWhatsApp() {
    const button =
      $("sendWhatsApp");

    if (!button) return;

    button.addEventListener(
      "click",
      () => {
        if (!currentParticipant) {
          return;
        }

        let phone =
          String(
            currentParticipant.phone ||
              ""
          )
            .replace(
              /\D/g,
              ""
            );

        if (
          phone.startsWith(
            "0"
          )
        ) {
          phone =
            "62" +
            phone.substring(
              1
            );
        }

        const message =
          `Kartu Kehadiran MASKANA\n\n` +
          `Nama: ${currentParticipant.name}\n` +
          `ID: ${currentParticipant.id}\n` +
          `Desa: ${currentParticipant.village}\n` +
          `Kecamatan: ${currentParticipant.district}\n` +
          `Kabupaten: ${currentParticipant.regency}`;

        const url =
          `https://wa.me/${phone}?text=` +
          encodeURIComponent(
            message
          );

        window.open(
          url,
          "_blank"
        );
      }
    );
  }

  /* =====================================================
     VILLAGE AUTOCOMPLETE
  ===================================================== */

  function updateVillageOptions() {
    const list =
      $("villageOptions");

    if (!list) return;

    const villages =
      [
        ...new Set(
          participants
            .map(
              (p) =>
                p.village
            )
            .filter(Boolean)
        )
      ].sort();

    list.innerHTML =
      villages
        .map(
          (village) =>
            `<option value="${escapeHTML(
              village
            )}"></option>`
        )
        .join("");
  }

  function setupVillageAutoFill() {
    const village =
      $("villageInput");

    const district =
      $("districtInput");

    const regency =
      $("regencyInput");

    if (!village) return;

    village.addEventListener(
      "input",
      () => {
        const value =
          village.value
            .trim()
            .toLowerCase();

        const found =
          participants.find(
            (p) =>
              String(
                p.village || ""
              )
                .toLowerCase() ===
              value
          );

        if (found) {
          if (
            district &&
            !district.value
          ) {
            district.value =
              found.district ||
              "";
          }

          if (
            regency &&
            !regency.value
          ) {
            regency.value =
              found.regency ||
              "";
          }
        }
      }
    );
  }

  /* =====================================================
     RENDER SEMUA
  ===================================================== */

  function renderAll() {
    renderDashboard();

    renderParticipants();

    renderAttendance();

    renderRecap();

    updateVillageOptions();
  }

  /* =====================================================
     INIT
  ===================================================== */

  async function init() {
    console.log(
      "MASKANA APP START"
    );

    /*
     * Ini penting:
     * navigasi dipasang PALING AWAL.
     * Jadi walaupun Supabase error,
     * tombol tetap bekerja.
     */
    setupNavigation();

    setupParticipantModal();

    setupParticipantForm();

    setupScanner();

    setupAttendanceSearch();

    setupExport();

    setupDownloadCard();

    setupQRModal();

    setupWhatsApp();

    setupVillageAutoFill();

    updateDate();

    setInterval(
      updateDate,
      60000
    );

    /*
     * Load lokal
     */
    loadLocal();

    renderAll();

    /*
     * Load online
     */
    if (supabase) {
      await loadOnline();

      setupRealtime();
    } else {
      console.warn(
        "Aplikasi berjalan tanpa Supabase."
      );
    }

    /*
     * Mulai dari dashboard
     */
    openTab(
      "dashboard"
    );

    console.log(
      "MASKANA APP READY"
    );
  }

  /* =====================================================
     JALANKAN
  ===================================================== */

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

  /* =====================================================
     API GLOBAL
  ===================================================== */

  window.Maskana = {
    refresh: loadOnline,

    scan: processScan,

    getParticipants:
      () => participants,

    getAttendance:
      () => attendance
  };

})();
