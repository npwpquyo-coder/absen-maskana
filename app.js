/* =========================================================
   ABSEN MASKANA
   APP.JS - VERSI ONLINE / MULTI HP / MULTI LAPTOP
========================================================= */

const $ = (selector) => document.querySelector(selector);

const storeKey = "hadirkita-maskana-v1";

let supabase = null;

let data = {
  participants: [],
  attendance: []
};

let activeCardParticipant = null;
let addressBook = JSON.parse(
  localStorage.getItem("hadirkita-address-book") || "{}"
);

let realtimeChannel = null;
let loadingData = false;
let initialized = false;


/* =========================================================
   KONFIGURASI SUPABASE
========================================================= */

const SUPABASE_URL =
  window.MASKANA_SUPABASE_URL ||
  "https://kjhzkzmswrzdwsamaejy.supabase.co";

const SUPABASE_KEY =
  window.MASKANA_SUPABASE_KEY ||
  "sb_publishable_26axc3A7U46FgNJ-CXXfYQ_1qtGe0sR";


/* =========================================================
   LOAD SUPABASE
========================================================= */

async function ensureSupabase() {

  if (window.supabase) {

    try {

      supabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );

      console.log("✅ Supabase siap.");

      return true;

    } catch (error) {

      console.error(
        "Gagal membuat koneksi Supabase:",
        error
      );

      return false;
    }
  }


  try {

    await new Promise((resolve, reject) => {

      const existing =
        document.querySelector(
          "script[data-maskana-supabase]"
        );

      if (existing) {

        existing.addEventListener(
          "load",
          resolve,
          { once: true }
        );

        existing.addEventListener(
          "error",
          reject,
          { once: true }
        );

        return;
      }


      const script =
        document.createElement("script");

      script.src =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

      script.dataset.maskanaSupabase =
        "true";

      script.onload = resolve;

      script.onerror = () =>
        reject(
          new Error(
            "Library Supabase gagal dimuat."
          )
        );

      document.head.appendChild(script);
    });


    if (!window.supabase) {

      throw new Error(
        "Library Supabase tidak tersedia."
      );
    }


    supabase =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );


    console.log(
      "✅ Library Supabase berhasil dimuat."
    );

    return true;


  } catch (error) {

    console.error(
      "❌ Supabase gagal diinisialisasi:",
      error
    );

    supabase = null;

    toast(
      "Koneksi database online belum siap."
    );

    return false;
  }
}


/* =========================================================
   LOCAL STORAGE
========================================================= */

function localBackup() {

  try {

    return JSON.parse(
      localStorage.getItem(storeKey) ||
      '{"participants":[],"attendance":[]}'
    );

  } catch {

    return {
      participants: [],
      attendance: []
    };
  }
}


function cacheData() {

  localStorage.setItem(
    storeKey,
    JSON.stringify(data)
  );
}


/* =========================================================
   UTILITAS
========================================================= */

const esc = (value) => {

  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        })[char]
    );
};


const initials = (name) => {

  return String(name || "")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};


const fmtTime = (iso) => {

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(new Date(iso));
};


function toast(message) {

  const element = $("#toast");

  if (!element) return;

  element.textContent = message;

  element.classList.add("show");

  setTimeout(() => {

    element.classList.remove("show");

  }, 2800);
}


/* =========================================================
   TANGGAL
========================================================= */

function updateDate() {

  const today =
    new Intl.DateTimeFormat(
      "id-ID-u-ca-islamic-umalqura",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    )
      .format(new Date())
      .toUpperCase();


  if ($("#today")) {

    $("#today").textContent =
      `${today} H`;
  }


  if ($("#eventDate")) {

    $("#eventDate").textContent =
      `${today} H · Pengajian rutin alumni`;
  }
}


/* =========================================================
   ALAMAT DESA
========================================================= */

function addressKey(village) {

  return String(village || "")
    .trim()
    .toLocaleLowerCase("id-ID")
    .replace(/\s+/g, " ");
}


function rememberAddress(participant) {

  if (
    !participant.village ||
    !participant.district ||
    !participant.regency
  ) {

    return;
  }


  addressBook[
    addressKey(participant.village)
  ] = {

    village: participant.village,

    district: participant.district,

    regency: participant.regency
  };


  localStorage.setItem(
    "hadirkita-address-book",
    JSON.stringify(addressBook)
  );
}


function renderVillageOptions() {

  const list =
    $("#villageOptions");

  if (!list) return;


  list.innerHTML =
    Object.values(addressBook)

      .sort(
        (a, b) =>
          a.village.localeCompare(
            b.village,
            "id"
          )
      )

      .map(
        (item) =>
          `<option value="${esc(
            item.village
          )}">${esc(
            item.district
          )}, ${esc(
            item.regency
          )}</option>`
      )

      .join("");
}


function autoFillAddress() {

  const village =
    $("#villageInput");

  const district =
    $("#districtInput");

  const regency =
    $("#regencyInput");


  if (!village) return;


  const address =
    addressBook[
      addressKey(village.value)
    ];


  if (!address) return;


  if (district) {

    district.value =
      address.district;
  }


  if (regency) {

    regency.value =
      address.regency;
  }
}


/* =========================================================
   DATA
========================================================= */

function uniqueVillages() {

  return [
    ...new Map(
      data.participants.map(
        (p) => [
          `${p.village}|${p.district}|${p.regency}`,
          p
        ]
      )
    ).values()
  ];
}


function attendees() {

  return data.attendance

    .map(
      (a) => ({
        ...a,

        p:
          data.participants.find(
            (p) => p.id === a.id
          )
      })
    )

    .filter((a) => a.p);
}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

  const present =
    attendees();

  const villages =
    uniqueVillages();


  const activeVillages =
    [
      ...new Set(
        present.map(
          (x) => x.p.village
        )
      )
    ];


  if ($("#totalPeserta")) {

    $("#totalPeserta").textContent =
      data.participants.length;
  }


  if ($("#totalHadir")) {

    $("#totalHadir").textContent =
      present.length;
  }


  if ($("#totalDesa")) {

    $("#totalDesa").textContent =
      activeVillages.length;
  }


  if ($("#presentRate")) {

    $("#presentRate").textContent =
      data.participants.length

        ? `${Math.round(
            present.length /
              data.participants.length *
              100
          )}% dari peserta`

        : "0% dari peserta";
  }


  if ($("#villageRate")) {

    $("#villageRate").textContent =
      `Dari ${villages.length} desa terdaftar`;
  }


  const last =
    present[0];


  if ($("#lastScan")) {

    $("#lastScan").textContent =
      last
        ? last.p.name
        : "—";
  }


  if ($("#lastTime")) {

    $("#lastTime").textContent =
      last

        ? `Pukul ${fmtTime(
            last.time
          )}`

        : "Belum ada kehadiran";
  }


  if ($("#recentList")) {

    $("#recentList").className =
      "recent-list" +
      (!present.length
        ? " empty"
        : "");


    $("#recentList").innerHTML =

      present
        .slice(0, 4)

        .map(
          (a) =>

            `<div class="recent">

              <span class="avatar">
                ${initials(a.p.name)}
              </span>

              <div>
                <strong>
                  ${esc(a.p.name)}
                </strong>

                <p>
                  ${esc(a.p.village)},
                  ${esc(a.p.district)}
                </p>
              </div>

              <time>
                ${fmtTime(a.time)}
              </time>

            </div>`
        )

        .join("") ||

      "Belum ada peserta yang hadir.";
  }


  const bars =
    villages

      .map((v) => {

        const participants =
          data.participants.filter(
            (p) =>
              p.village ===
              v.village
          );


        const hadir =
          participants.filter(
            (p) =>
              present.some(
                (a) =>
                  a.p.id === p.id
              )
          ).length;


        const total =
          participants.length;


        return `

          <div class="bar-row">

            <div class="bar-head">

              <b>
                ${esc(v.village)}
              </b>

              <span>
                ${hadir}/${total} hadir
              </span>

            </div>

            <div class="bar">

              <span
                style="width:${
                  total
                    ? hadir / total * 100
                    : 0
                }%"
              ></span>

            </div>

          </div>

        `;
      })

      .join("");


  if ($("#villageBars")) {

    $("#villageBars").className =
      "village-bars" +
      (!bars ? " empty" : "");


    $("#villageBars").innerHTML =
      bars ||
      "Belum ada data kehadiran.";
  }
}


/* =========================================================
   PESERTA
========================================================= */

function renderParticipants() {

  const search =
    $("#participantSearch");


  const term =
    search
      ? search.value
          .toLowerCase()
      : "";


  const participants =
    data.participants.filter(
      (p) =>
        `${p.name} ${p.village} ${p.phone}`
          .toLowerCase()
          .includes(term)
    );


  if ($("#participantCount")) {

    $("#participantCount").textContent =
      `${data.participants.length} peserta terdaftar`;
  }


  if (!$("#participantRows"))
    return;


  $("#participantRows").innerHTML =

    participants.length

      ? participants
          .map(
            (p) =>

              `<tr>

                <td>

                  <strong>
                    ${esc(p.name)}
                  </strong>

                  <small>
                    ID: ${esc(p.id)}
                  </small>

                </td>

                <td>

                  ${esc(p.village)}

                  <small>
                    ${esc(p.district)},
                    ${esc(p.regency)}
                  </small>

                </td>

                <td>
                  ${esc(p.phone)}
                </td>

                <td>

                  <button
                    class="qr-action"
                    data-qr="${esc(p.id)}"
                  >
                    Lihat QR
                  </button>

                </td>

                <td>

                  <button
                    class="delete-action"
                    data-delete="${esc(p.id)}"
                  >
                    Hapus
                  </button>

                </td>

              </tr>`
          )
          .join("")

      : emptyRow(
          5,
          "Belum ada peserta. Tambahkan peserta pertama Anda."
        );
}


/* =========================================================
   KEHADIRAN
========================================================= */

function renderAttendance() {

  const search =
    $("#attendanceSearch");


  const term =
    search
      ? search.value
          .toLowerCase()
      : "";


  const list =
    attendees().filter(
      (a) =>
        `${a.p.name} ${a.p.village}`
          .toLowerCase()
          .includes(term)
    );


  if ($("#attendanceCount")) {

    $("#attendanceCount").textContent =
      `${attendees().length} peserta tercatat hadir`;
  }


  if (!$("#attendanceRows"))
    return;


  $("#attendanceRows").innerHTML =

    list.length

      ? list

          .map(
            (a) =>

              `<tr>

                <td>

                  <strong>
                    ${esc(a.p.name)}
                  </strong>

                  <small>
                    ${esc(a.p.phone)}
                  </small>

                </td>

                <td>

                  ${esc(a.p.village)}

                  <small>
                    ${esc(a.p.district)},
                    ${esc(a.p.regency)}
                  </small>

                </td>

                <td>
                  ${fmtTime(a.time)}
                </td>

                <td>

                  <span class="status">
                    ✓ HADIR
                  </span>

                </td>

              </tr>`
          )

          .join("")

      : emptyRow(
          4,
          "Belum ada kehadiran yang tercatat."
        );
}


/* =========================================================
   REKAP
========================================================= */

function renderRecap() {

  const villages =
    uniqueVillages();

  const present =
    attendees();


  const summary = [

    [
      "Total desa terdaftar",
      villages.length
    ],

    [
      "Desa sudah hadir",
      new Set(
        present.map(
          (x) => x.p.village
        )
      ).size
    ],

    [
      "Total kehadiran",
      present.length
    ]

  ];


  if ($("#recapSummary")) {

    $("#recapSummary").innerHTML =

      summary

        .map(
          (item) =>

            `<div>

              <p>
                ${item[0]}
              </p>

              <strong>
                ${item[1]}
              </strong>

            </div>`
        )

        .join("");
  }


  if (!$("#recapRows"))
    return;


  $("#recapRows").innerHTML =

    villages.length

      ? villages

          .map((v) => {

            const participants =
              data.participants.filter(
                (p) =>
                  p.village ===
                  v.village
              );


            const hadir =
              participants.filter(
                (p) =>
                  present.some(
                    (a) =>
                      a.p.id === p.id
                  )
              ).length;


            const total =
              participants.length;


            return `

              <tr>

                <td>
                  <strong>
                    ${esc(v.village)}
                  </strong>
                </td>

                <td>
                  ${esc(v.district)}
                </td>

                <td>
                  ${esc(v.regency)}
                </td>

                <td>
                  ${total} peserta
                </td>

                <td>
                  <strong>
                    ${hadir} hadir
                  </strong>
                </td>

                <td>

                  <span class="percent">
                    ${
                      total
                        ? Math.round(
                            hadir /
                              total *
                              100
                          )
                        : 0
                    }%
                  </span>

                </td>

              </tr>

            `;
          })

          .join("")

      : emptyRow(
          6,
          "Belum ada data peserta."
        );
}


function emptyRow(
  columns,
  text
) {

  return `

    <tr>

      <td
        colspan="${columns}"
        style="
          text-align:center;
          padding:35px;
          color:#8b9696
        "
      >

        ${text}

      </td>

    </tr>

  `;
}


/* =========================================================
   RENDER SEMUA
========================================================= */

function render() {

  renderDashboard();

  renderParticipants();

  renderAttendance();

  renderRecap();

  renderVillageOptions();
}


/* =========================================================
   LOAD DATA DARI SUPABASE
========================================================= */

async function loadRemoteData() {

  if (!supabase) {

    console.warn(
      "Supabase belum terhubung."
    );

    return;
  }


  if (loadingData)
    return;


  loadingData = true;


  const localBeforeRemote =
    localBackup();


  try {

    const [

      {
        data: participants,
        error: participantError
      },

      {
        data: attendance,
        error: attendanceError
      }

    ] = await Promise.all([

      supabase

        .from("participants")

        .select("*")

        .order(
          "created_at",
          {
            ascending: false
          }
        ),

      supabase

        .from("attendance")

        .select(
          "participant_id,time"
        )

        .order(
          "time",
          {
            ascending: false
          }
        )

    ]);


    if (participantError)
      throw participantError;


    if (attendanceError)
      throw attendanceError;


    data.participants =
      (participants || [])
        .map(
          (p) => ({

            id: p.id,

            name: p.name,

            phone:
              p.phone || "",

            village:
              p.village || "",

            district:
              p.district || "",

            regency:
              p.regency || ""

          })
        );


    data.attendance =
      (attendance || [])
        .map(
          (a) => ({

            id:
              a.participant_id,

            time:
              a.time

          })
        );


    data.participants
      .forEach(
        rememberAddress
      );


    render();


    if (
      !initialized
    ) {

      initialized = true;


      if (
        data.participants.length === 0 &&
        localBeforeRemote
          .participants.length > 0
      ) {

        await migrateLocalData(
          localBeforeRemote
        );

        return;
      }
    }


    cacheData();


    console.log(
      "✅ Data Supabase berhasil dimuat.",
      data
    );


  } catch (error) {

    console.error(
      "Supabase load error:",
      error
    );


    if (!initialized) {

      data =
        localBeforeRemote;


      data.participants
        .forEach(
          rememberAddress
        );


      render();


      toast(
        "Database online belum siap. Periksa Supabase."
      );


      initialized = true;
    }


  } finally {

    loadingData = false;
  }
}


/* =========================================================
   MIGRASI DATA LAMA
========================================================= */

async function migrateLocalData(
  local
) {

  try {

    if (
      local.participants.length
    ) {

      const {
        error
      } =
        await supabase

          .from("participants")

          .upsert(

            local.participants.map(
              (p) => ({

                id: p.id,

                name: p.name,

                phone:
                  p.phone || "",

                village:
                  p.village || "",

                district:
                  p.district || "",

                regency:
                  p.regency || ""

              })
            ),

            {
              onConflict: "id"
            }

          );


      if (error)
        throw error;
    }


    if (
      local.attendance.length
    ) {

      const {
        error
      } =
        await supabase

          .from("attendance")

          .upsert(

            local.attendance.map(
              (a) => ({

                participant_id:
                  a.id,

                time:
                  a.time

              })
            ),

            {
              onConflict:
                "participant_id"
            }

          );


      if (error)
        throw error;
    }


    data = {

      participants:
        local.participants,

      attendance:
        local.attendance

    };


    data.participants
      .forEach(
        rememberAddress
      );


    cacheData();

    render();


    toast(
      "Data lama berhasil dipindahkan ke database online."
    );


  } catch (error) {

    console.error(
      "Migration error:",
      error
    );


    data = local;

    render();


    toast(
      "Gagal memindahkan data ke Supabase."
    );
  }
}


/* =========================================================
   REALTIME
========================================================= */

function subscribeRealtime() {

  if (
    !supabase ||
    realtimeChannel
  ) {

    return;
  }


  realtimeChannel =

    supabase

      .channel(
        "maskana-db-changes"
      )

      .on(

        "postgres_changes",

        {
          event: "*",
          schema: "public",
          table: "participants"
        },

        () => {

          console.log(
            "🔄 Peserta berubah. Memuat ulang..."
          );

          loadRemoteData();
        }

      )

      .on(

        "postgres_changes",

        {
          event: "*",
          schema: "public",
          table: "attendance"
        },

        () => {

          console.log(
            "🔄 Kehadiran berubah. Memuat ulang..."
          );

          loadRemoteData();
        }

      )

      .subscribe(
        (status) => {

          console.log(
            "Supabase Realtime:",
            status
          );

        }
      );
}


/* =========================================================
   NAVIGASI
========================================================= */

function setupNavigation() {

  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                ".nav-item,.tab"
              )
              .forEach(
                (item) =>
                  item.classList.remove(
                    "active"
                  )
              );


            button.classList.add(
              "active"
            );


            const tab =
              $(
                "#" +
                button.dataset.tab
              );


            if (tab) {

              tab.classList.add(
                "active"
              );
            }


            if ($("#pageTitle")) {

              $("#pageTitle")
                .textContent =

                button.dataset.tab ===
                "dashboard"

                  ? "Selamat datang 👋"

                  : button.textContent
                      .trim();
            }


            if (
              button.dataset.tab ===
              "scan"
            ) {

              setTimeout(
                () =>
                  $("#scanInput")
                    ?.focus(),
                100
              );
            }
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-go]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const target =
              document.querySelector(
                `.nav-item[data-tab="${button.dataset.go}"]`
              );


            target?.click();
          }
        );
      }
    );
}


/* =========================================================
   TAMBAH PESERTA
========================================================= */

function setupParticipantForm() {

  const button =
    $("#addParticipant");


  const modal =
    $("#participantModal");


  const form =
    $("#participantForm");


  if (button && modal) {

    button.addEventListener(
      "click",
      () => modal.showModal()
    );
  }


  if (!form) return;


  form.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      if (!supabase) {

        toast(
          "Database online belum terhubung."
        );

        return;
      }


      const formData =
        new FormData(form);


      const participant = {

        id:
          "HK-" +
          Date.now()
            .toString(36)
            .toUpperCase() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2, 6)
            .toUpperCase(),

        name:
          String(
            formData.get("name") || ""
          ).trim(),

        phone:
          String(
            formData.get("phone") || ""
          ).trim(),

        village:
          String(
            formData.get("village") || ""
          ).trim(),

        district:
          String(
            formData.get("district") || ""
          ).trim(),

        regency:
          String(
            formData.get("regency") || ""
          ).trim()

      };


      const submitButton =
        form.querySelector(
          'button[type="submit"]'
        );


      if (submitButton) {

        submitButton.disabled =
          true;
      }


      try {

        const {
          error
        } =

          await supabase

            .from(
              "participants"
            )

            .insert(
              participant
            );


        if (error)
          throw error;


        data.participants.unshift(
          participant
        );


        rememberAddress(
          participant
        );


        cacheData();

        render();


        form.reset();


        modal.close();


        showQR(
          participant.id
        );


        toast(
          "Peserta berhasil disimpan ke database online."
        );


      } catch (error) {

        console.error(
          "Tambah peserta:",
          error
        );


        toast(
          `Gagal menambah peserta: ${
            error.message ||
            "error database"
          }`
        );


      } finally {

        if (submitButton) {

          submitButton.disabled =
            false;
        }
      }
    }
  );
}


/* =========================================================
   SCAN QR
========================================================= */

function setupScanner() {

  const input =
    $("#scanInput");


  if (!input) return;


  input.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        recordScan(
          input.value
        );
      }
    }
  );
}


async function recordScan(
  code
) {

  if (!supabase) {

    toast(
      "Database online belum terhubung."
    );

    return;
  }


  const cleanCode =
    String(code || "")
      .trim();


  if (!cleanCode) {

    toast(
      "Kode QR kosong."
    );

    return;
  }


  const participant =
    data.participants.find(
      (p) =>
        String(p.id)
          .toLowerCase() ===
        cleanCode.toLowerCase()
    );


  if ($("#scanInput")) {

    $("#scanInput").value =
      "";
  }


  if (!participant) {

    toast(
      "Kode QR tidak ditemukan."
    );


    if ($("#scanResult")) {

      $("#scanResult").innerHTML = `

        <div class="result-card">

          <div
            class="success-icon"
            style="
              background:#fff0ee;
              color:#da6c60
            "
          >
            !
          </div>

          <h2>
            Kode tidak ditemukan
          </h2>

          <p>
            Pastikan QR berasal dari aplikasi ini.
          </p>

        </div>

      `;
    }

    return;
  }


  const existing =
    data.attendance.find(
      (a) =>
        a.id ===
        participant.id
    );


  if (existing) {

    toast(
      `${participant.name} sudah tercatat hadir.`
    );


    if ($("#scanResult")) {

      $("#scanResult").innerHTML =
        resultHTML(
          participant,
          existing.time,
          true
        );
    }


    return;
  }


  const time =
    new Date().toISOString();


  const {
    error
  } =

    await supabase

      .from("attendance")

      .insert({

        participant_id:
          participant.id,

        time:
          time

      });


  if (error) {

    if (
      error.code ===
      "23505"
    ) {

      await loadRemoteData();


      const latest =
        data.attendance.find(
          (a) =>
            a.id ===
            participant.id
        );


      toast(
        `${participant.name} sudah tercatat hadir.`
      );


      if ($("#scanResult")) {

        $("#scanResult").innerHTML =
          resultHTML(
            participant,
            latest?.time ||
              time,
            true
          );
      }


      return;
    }


    console.error(
      "Scan error:",
      error
    );


    toast(
      `Gagal menyimpan kehadiran: ${
        error.message ||
        "error database"
      }`
    );


    return;
  }


  data.attendance.unshift({

    id:
      participant.id,

    time:
      time

  });


  cacheData();

  render();


  if ($("#scanResult")) {

    $("#scanResult").innerHTML =
      resultHTML(
        participant,
        time,
        false
      );
  }


  toast(
    `Kehadiran ${participant.name} berhasil dicatat!`
  );
}


function resultHTML(
  participant,
  time,
  already
) {

  return `

    <div class="result-card">

      <div class="success-icon">
        ${already ? "i" : "✓"}
      </div>

      <h2>
        ${
          already
            ? "Sudah tercatat hadir"
            : "Kehadiran berhasil!"
        }
      </h2>

      <p>
        ${
          already
            ? "Peserta ini telah dipindai sebelumnya."
            : "Data kehadiran tersimpan secara online."
        }
      </p>

      <span
        class="avatar"
        style="
          margin:0 auto 10px;
          width:42px;
          height:42px
        "
      >
        ${initials(
          participant.name
        )}
      </span>

      <h3
        style="
          margin:0;
          font-size:15px
        "
      >
        ${esc(
          participant.name
        )}
      </h3>

      <div class="result-details">

        <p>
          Desa
          <b>
            ${esc(
              participant.village
            )}
          </b>
        </p>

        <p>
          Kecamatan
          <b>
            ${esc(
              participant.district
            )}
          </b>
        </p>

        <p>
          Waktu hadir
          <b>
            ${fmtTime(time)}
          </b>
        </p>

      </div>

    </div>

  `;
}


/* =========================================================
   QR CARD
========================================================= */

function showQR(id) {

  const participant =
    data.participants.find(
      (p) => p.id === id
    );


  if (!participant)
    return;


  activeCardParticipant =
    participant;


  if ($("#cardName")) {

    $("#cardName").textContent =
      participant.name;
  }


  if ($("#cardAddress")) {

    $("#cardAddress").textContent =
      `${participant.village}, ${participant.district}, ${participant.regency}`;
  }


  if ($("#cardPhone")) {

    $("#cardPhone").textContent =
      participant.phone;
  }


  const qrBox =
    $("#qrCode");


  if (qrBox) {

    qrBox.innerHTML =
      "";


    new QRCode(
      qrBox,
      {

        text:
          participant.id,

        width:
          160,

        height:
          160,

        colorDark:
          "#073d39",

        colorLight:
          "#ffffff",

        correctLevel:
          QRCode.CorrectLevel.M

      }
    );
  }


  $("#qrModal")?.showModal();
}


/* =========================================================
   DOWNLOAD KARTU
========================================================= */

async function cardFile() {

  const canvas =
    await html2canvas(
      $("#participantCard"),
      {
        scale: 3,
        useCORS: true,
        backgroundColor: null
      }
    );


  const blob =
    await new Promise(
      (resolve) =>
        canvas.toBlob(
          resolve,
          "image/png"
        )
    );


  return new File(

    [
      blob
    ],

    `kartu-qr-${activeCardParticipant.name
      .replace(
        /[^a-z0-9]+/gi,
        "-"
      )
      .toLowerCase()}.png`,

    {
      type:
        "image/png"
    }

  );
}


async function downloadCard() {

  if (
    !activeCardParticipant ||
    !window.html2canvas
  ) {

    toast(
      "Fitur unduh belum siap."
    );

    return;
  }


  const button =
    $("#downloadCard");


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Menyiapkan...";
  }


  try {

    const file =
      await cardFile();


    const link =
      document.createElement(
        "a"
      );


    link.download =
      file.name;


    link.href =
      URL.createObjectURL(
        file
      );


    link.click();


    URL.revokeObjectURL(
      link.href
    );


    toast(
      "Kartu QR berhasil diunduh."
    );


  } catch (error) {

    console.error(error);

    toast(
      "Kartu belum dapat diunduh."
    );


  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "⇩ Unduh PNG";
    }
  }
}


/* =========================================================
   WHATSAPP
========================================================= */

async function sendWhatsApp() {

  if (
    !activeCardParticipant ||
    !window.html2canvas
  ) {

    toast(
      "Fitur kartu belum siap."
    );

    return;
  }


  const button =
    $("#sendWhatsApp");


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Menyiapkan kartu...";
  }


  try {

    const file =
      await cardFile();


    const participant =
      activeCardParticipant;


    const text =
      `Kartu peserta ${participant.name} — Pengajian Alumni MASKANA. Mohon simpan dan tunjukkan QR saat registrasi.`;


    if (
      navigator.canShare &&
      navigator.canShare({
        files: [file]
      })
    ) {

      await navigator.share({

        title:
          "Kartu QR Peserta",

        text:
          text,

        files:
          [file]

      });


      toast(
        "Pilih WhatsApp pada menu berbagi."
      );


    } else {

      const link =
        document.createElement(
          "a"
        );


      link.download =
        file.name;


      link.href =
        URL.createObjectURL(
          file
        );


      link.click();


      URL.revokeObjectURL(
        link.href
      );


      toast(
        "Kartu diunduh. Silakan lampirkan ke WhatsApp."
      );
    }


  } catch (error) {

    if (
      error.name !==
      "AbortError"
    ) {

      console.error(error);

      toast(
        "Kartu belum dapat dikirim."
      );
    }


  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "◉ Kirim kartu ke WhatsApp";
    }
  }
}


/* =========================================================
   PENCARIAN
========================================================= */

function setupSearch() {

  $("#participantSearch")
    ?.addEventListener(
      "input",
      renderParticipants
    );


  $("#attendanceSearch")
    ?.addEventListener(
      "input",
      renderAttendance
    );
}


/* =========================================================
   AUTOFILL DESA
========================================================= */

function setupVillageAutoFill() {

  const input =
    $("#villageInput");


  if (!input)
    return;


  input.addEventListener(
    "input",
    autoFillAddress
  );


  input.addEventListener(
    "change",
    autoFillAddress
  );
}


/* =========================================================
   HAPUS PESERTA
========================================================= */

function setupDeleteButtons() {

  document.addEventListener(
    "click",
    async (event) => {

      const id =
        event.target.dataset.delete;


      if (!id)
        return;


      const participant =
        data.participants.find(
          (p) => p.id === id
        );


      if (!participant)
        return;


      if (
        !confirm(
          `Hapus ${participant.name}?`
        )
      ) {

        return;
      }


      if (!supabase) {

        toast(
          "Database online belum terhubung."
        );

        return;
      }


      try {

        const {
          error
        } =

          await supabase

            .from(
              "participants"
            )

            .delete()

            .eq(
              "id",
              participant.id
            );


        if (error)
          throw error;


        data.participants =
          data.participants.filter(
            (p) =>
              p.id !==
              participant.id
          );


        data.attendance =
          data.attendance.filter(
            (a) =>
              a.id !==
              participant.id
          );


        cacheData();

        render();


        toast(
          "Peserta berhasil dihapus."
        );


      } catch (error) {

        console.error(error);

        toast(
          `Gagal menghapus peserta: ${
            error.message ||
            "error database"
          }`
        );
      }
    }
  );
}


/* =========================================================
   TOMBOL QR
========================================================= */

function setupQRButtons() {

  document.addEventListener(
    "click",
    (event) => {

      const id =
        event.target.dataset.qr;


      if (id) {

        showQR(id);
      }
    }
  );
}


/* =========================================================
   EXPORT CSV
========================================================= */

function exportCSV() {

  const rows = [

    [
      "Nama",
      "Desa",
      "Kecamatan",
      "Kabupaten",
      "WhatsApp",
      "Waktu Hadir"
    ],

    ...data.participants.map(
      (participant) => {

        const hadir =
          data.attendance.find(
            (a) =>
              a.id ===
              participant.id
          );


        return [

          participant.name,

          participant.village,

          participant.district,

          participant.regency,

          participant.phone,

          hadir

            ? new Date(
                hadir.time
              ).toLocaleString(
                "id-ID"
              )

            : "Belum hadir"

        ];
      }
    )

  ];


  const csv =

    "\ufeff" +

    rows

      .map(
        (row) =>

          row

            .map(
              (value) =>

                '"' +
                String(
                  value
                ).replaceAll(
                  '"',
                  '""'
                ) +
                '"'
            )

            .join(",")
      )

      .join("\n");


  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );


  const link =
    document.createElement(
      "a"
    );


  const url =
    URL.createObjectURL(
      blob
    );


  link.href =
    url;


  link.download =
    "rekap-absensi-maskana.csv";


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  URL.revokeObjectURL(
    url
  );


  toast(
    "Data rekap berhasil diunduh."
  );
}


/* =========================================================
   TOMBOL EXPORT
========================================================= */

function setupExport() {

  $("#exportBtn")
    ?.addEventListener(
      "click",
      exportCSV
    );


  $("#exportBtn2")
    ?.addEventListener(
      "click",
      exportCSV
    );
}


/* =========================================================
   MODAL QR
========================================================= */

function setupQRModal() {

  $(".close-qr")
    ?.addEventListener(
      "click",
      () =>
        $("#qrModal")?.close()
    );


  $("#downloadCard")
    ?.addEventListener(
      "click",
      downloadCard
    );


  $("#sendWhatsApp")
    ?.addEventListener(
      "click",
      sendWhatsApp
    );
}


/* =========================================================
   INIT
========================================================= */

async function init() {

  console.log(
    "================================"
  );

  console.log(
    "MASKANA APP START"
  );

  console.log(
    "================================"
  );


  /*
     PENTING:
     Supabase harus siap terlebih dahulu.
  */

  await ensureSupabase();


  /*
     Pasang semua tombol.
  */

  setupNavigation();

  setupParticipantForm();

  setupScanner();

  setupSearch();

  setupExport();

  setupQRModal();

  setupVillageAutoFill();

  setupDeleteButtons();

  setupQRButtons();

  updateDate();


  setInterval(
    updateDate,
    60000
  );


  /*
     Tampilkan data lokal sementara.
  */

  const local =
    localBackup();


  if (
    local.participants.length ||
    local.attendance.length
  ) {

    data =
      local;


    data.participants
      .forEach(
        rememberAddress
      );
  }


  render();


  /*
     Setelah itu ambil data
     yang sebenarnya dari Supabase.
  */

  if (supabase) {

    await loadRemoteData();

    subscribeRealtime();

  } else {

    toast(
      "Supabase belum terhubung."
    );
  }


  /*
     Mulai dari dashboard.
  */

  const dashboard =
    document.querySelector(
      '.nav-item[data-tab="dashboard"]'
    );


  dashboard?.click();


  console.log(
    "================================"
  );

  console.log(
    "MASKANA APP READY"
  );

  console.log(
    "Supabase:",
    !!supabase
  );

  console.log(
    "================================"
  );
}


/* =========================================================
   JALANKAN SETELAH HTML SIAP
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
   API GLOBAL
========================================================= */

window.Maskana = {

  refresh:
    loadRemoteData,

  scan:
    recordScan,

  getParticipants:
    () =>
      data.participants,

  getAttendance:
    () =>
      data.attendance

};
