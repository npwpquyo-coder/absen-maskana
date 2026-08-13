const $ = s => document.querySelector(s);

const storeKey = 'hadirkita-maskana-v1';

const localBackup = () =>
  JSON.parse(
    localStorage.getItem(storeKey) ||
    '{"participants":[],"attendance":[]}'
  );

const supabase = window.supabase.createClient(
  window.MASKANA_SUPABASE_URL,
  window.MASKANA_SUPABASE_KEY
);

let data = {
  participants: [],
  attendance: []
};

let activeCardParticipant = null;
let addressBook = JSON.parse(
  localStorage.getItem('hadirkita-address-book') || '{}'
);

let realtimeChannel = null;
let loadingData = false;
let initialized = false;

const addressKey = village =>
  village.trim().toLocaleLowerCase('id-ID').replace(/\s+/g, ' ');


/* =========================================================
   ALAMAT
========================================================= */

function rememberAddress(p) {
  if (!p.village || !p.district || !p.regency) return;

  addressBook[addressKey(p.village)] = {
    village: p.village,
    district: p.district,
    regency: p.regency
  };

  localStorage.setItem(
    'hadirkita-address-book',
    JSON.stringify(addressBook)
  );
}

function renderVillageOptions() {
  const el = $('#villageOptions');
  if (!el) return;

  el.innerHTML = Object.values(addressBook)
    .sort((a, b) => a.village.localeCompare(b.village, 'id'))
    .map(
      a =>
        `<option value="${esc(a.village)}">${esc(
          a.district
        )}, ${esc(a.regency)}</option>`
    )
    .join('');
}

function autoFillAddress() {
  const input = $('#villageInput');
  if (!input) return;

  const address = addressBook[addressKey(input.value)];
  if (!address) return;

  $('#districtInput').value = address.district;
  $('#regencyInput').value = address.regency;
}


/* =========================================================
   UTILITAS
========================================================= */

function cacheData() {
  localStorage.setItem(storeKey, JSON.stringify(data));
}

const esc = v =>
  String(v ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[c])
  );

const initials = name =>
  name
    .split(' ')
    .map(x => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const fmtTime = iso =>
  new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(iso));

const dateFormat = new Intl.DateTimeFormat(
  'id-ID-u-ca-islamic-umalqura',
  {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }
)
  .format(new Date())
  .toUpperCase();

if ($('#today')) {
  $('#today').textContent = `${dateFormat} H`;
}

if ($('#eventDate')) {
  $('#eventDate').textContent =
    `${dateFormat} H · Pengajian rutin alumni`;
}


/* =========================================================
   DATA
========================================================= */

function uniqueVillages() {
  return [
    ...new Map(
      data.participants.map(p => [
        `${p.village}|${p.district}|${p.regency}`,
        p
      ])
    ).values()
  ];
}

function attendees() {
  return data.attendance
    .map(a => ({
      ...a,
      p: data.participants.find(p => p.id === a.id)
    }))
    .filter(a => a.p);
}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {
  const present = attendees();
  const villages = uniqueVillages();

  const activeVillages = [
    ...new Set(present.map(x => x.p.village))
  ];

  if ($('#totalPeserta'))
    $('#totalPeserta').textContent = data.participants.length;

  if ($('#totalHadir'))
    $('#totalHadir').textContent = present.length;

  if ($('#totalDesa'))
    $('#totalDesa').textContent = activeVillages.length;

  if ($('#presentRate')) {
    $('#presentRate').textContent = data.participants.length
      ? `${Math.round(
          (present.length / data.participants.length) * 100
        )}% dari peserta`
      : '0% dari peserta';
  }

  if ($('#villageRate')) {
    $('#villageRate').textContent =
      `Dari ${villages.length} desa terdaftar`;
  }

  const last = present[0];

  if ($('#lastScan'))
    $('#lastScan').textContent = last
      ? last.p.name
      : '—';

  if ($('#lastTime'))
    $('#lastTime').textContent = last
      ? `Pukul ${fmtTime(last.time)}`
      : 'Belum ada kehadiran';

  if ($('#recentList')) {
    $('#recentList').className =
      'recent-list' + (!present.length ? ' empty' : '');

    $('#recentList').innerHTML =
      present
        .slice(0, 4)
        .map(
          a =>
            `<div class="recent">
              <span class="avatar">${initials(a.p.name)}</span>
              <div>
                <strong>${esc(a.p.name)}</strong>
                <p>${esc(a.p.village)}, ${esc(a.p.district)}</p>
              </div>
              <time>${fmtTime(a.time)}</time>
            </div>`
        )
        .join('') ||
      'Belum ada peserta yang hadir.';
  }

  const bars = villages
    .map(v => {
      const ps = data.participants.filter(
        p => p.village === v.village
      );

      const h = ps.filter(p =>
        present.some(a => a.p.id === p.id)
      ).length;

      const n = ps.length;

      return `
        <div class="bar-row">
          <div class="bar-head">
            <b>${esc(v.village)}</b>
            <span>${h}/${n} hadir</span>
          </div>

          <div class="bar">
            <span style="width:${n ? (h / n) * 100 : 0}%"></span>
          </div>
        </div>
      `;
    })
    .join('');

  if ($('#villageBars')) {
    $('#villageBars').className =
      'village-bars' + (!bars ? ' empty' : '');

    $('#villageBars').innerHTML =
      bars || 'Belum ada data kehadiran.';
  }
}


/* =========================================================
   PESERTA
========================================================= */

function renderParticipants() {
  const search = $('#participantSearch');
  const rows = $('#participantRows');

  if (!search || !rows) return;

  const term = search.value.toLowerCase();

  const ps = data.participants.filter(p =>
    `${p.name} ${p.village} ${p.phone}`
      .toLowerCase()
      .includes(term)
  );

  if ($('#participantCount')) {
    $('#participantCount').textContent =
      `${data.participants.length} peserta terdaftar`;
  }

  rows.innerHTML =
    ps
      .map(
        p =>
          `<tr>
            <td>
              <strong>${esc(p.name)}</strong>
              <small>ID: ${esc(p.id)}</small>
            </td>

            <td>
              ${esc(p.village)}
              <small>
                ${esc(p.district)}, ${esc(p.regency)}
              </small>
            </td>

            <td>${esc(p.phone)}</td>

            <td>
              <button
                class="qr-action"
                data-qr="${esc(p.id)}">
                Lihat QR
              </button>
            </td>

            <td>
              <button
                class="delete-action"
                data-delete="${esc(p.id)}">
                Hapus
              </button>
            </td>
          </tr>`
      )
      .join('') ||
    emptyRow(
      5,
      'Belum ada peserta. Tambahkan peserta pertama Anda.'
    );
}

function emptyRow(cols, text) {
  return `
    <tr>
      <td
        colspan="${cols}"
        style="text-align:center;padding:35px;color:#8b9696">
        ${text}
      </td>
    </tr>
  `;
}


/* =========================================================
   KEHADIRAN
========================================================= */

function renderAttendance() {
  const search = $('#attendanceSearch');
  const rows = $('#attendanceRows');

  if (!search || !rows) return;

  const term = search.value.toLowerCase();

  const list = attendees().filter(a =>
    `${a.p.name} ${a.p.village}`
      .toLowerCase()
      .includes(term)
  );

  if ($('#attendanceCount')) {
    $('#attendanceCount').textContent =
      `${attendees().length} peserta tercatat hadir`;
  }

  rows.innerHTML =
    list
      .map(
        a =>
          `<tr>
            <td>
              <strong>${esc(a.p.name)}</strong>
              <small>${esc(a.p.phone)}</small>
            </td>

            <td>
              ${esc(a.p.village)}
              <small>
                ${esc(a.p.district)}, ${esc(a.p.regency)}
              </small>
            </td>

            <td>${fmtTime(a.time)}</td>

            <td>
              <span class="status">✓ HADIR</span>
            </td>
          </tr>`
      )
      .join('') ||
    emptyRow(
      4,
      'Belum ada kehadiran yang tercatat.'
    );
}


/* =========================================================
   REKAP
========================================================= */

function renderRecap() {
  const summaryEl = $('#recapSummary');
  const rowsEl = $('#recapRows');

  if (!summaryEl || !rowsEl) return;

  const villages = uniqueVillages();
  const present = attendees();

  const summary = [
    ['Total desa terdaftar', villages.length],
    [
      'Desa sudah hadir',
      new Set(
        present.map(x => x.p.village)
      ).size
    ],
    ['Total kehadiran', present.length]
  ];

  summaryEl.innerHTML = summary
    .map(
      x =>
        `<div>
          <p>${x[0]}</p>
          <strong>${x[1]}</strong>
        </div>`
    )
    .join('');

  rowsEl.innerHTML =
    villages
      .map(v => {
        const ps = data.participants.filter(
          p => p.village === v.village
        );

        const h = ps.filter(p =>
          present.some(a => a.p.id === p.id)
        ).length;

        const n = ps.length;

        return `
          <tr>
            <td>
              <strong>${esc(v.village)}</strong>
            </td>

            <td>${esc(v.district)}</td>

            <td>${esc(v.regency)}</td>

            <td>${n} peserta</td>

            <td>
              <strong>${h} hadir</strong>
            </td>

            <td>
              <span class="percent">
                ${n ? Math.round((h / n) * 100) : 0}%
              </span>
            </td>
          </tr>
        `;
      })
      .join('') ||
    emptyRow(6, 'Belum ada data peserta.');
}


/* =========================================================
   RENDER
========================================================= */

function render() {
  renderDashboard();
  renderParticipants();
  renderAttendance();
  renderRecap();
  renderVillageOptions();
}


/* =========================================================
   TOAST
========================================================= */

function toast(msg) {
  const t = $('#toast');

  if (!t) {
    console.log(msg);
    return;
  }

  t.textContent = msg;
  t.classList.add('show');

  setTimeout(() => {
    t.classList.remove('show');
  }, 2800);
}


/* =========================================================
   LOAD DATA DARI SUPABASE
========================================================= */

async function loadRemoteData() {
  if (loadingData) return;

  loadingData = true;

  try {
    console.log('Mengambil data dari Supabase...');

    const participantsResult = await supabase
      .from('participants')
      .select('*')
      .order('created_at', {
        ascending: false
      });

    if (participantsResult.error) {
      throw participantsResult.error;
    }

    const attendanceResult = await supabase
      .from('attendance')
      .select('participant_id,time')
      .order('time', {
        ascending: false
      });

    if (attendanceResult.error) {
      throw attendanceResult.error;
    }

    data.participants =
      (participantsResult.data || []).map(p => ({
        id: p.id,
        name: p.name,
        phone: p.phone || '',
        village: p.village || '',
        district: p.district || '',
        regency: p.regency || ''
      }));

    data.attendance =
      (attendanceResult.data || []).map(a => ({
        id: a.participant_id,
        time: a.time
      }));

    data.participants.forEach(
      rememberAddress
    );

    cacheData();

    render();

    console.log(
      'Supabase berhasil:',
      data.participants.length,
      'peserta,',
      data.attendance.length,
      'kehadiran'
    );

    initialized = true;

  } catch (error) {

    console.error(
      'SUPABASE LOAD ERROR:',
      error
    );

    toast(
      'Gagal mengambil data dari database online.'
    );

  } finally {
    loadingData = false;
  }
}


/* =========================================================
   REALTIME
========================================================= */

function subscribeRealtime() {

  if (realtimeChannel) return;

  realtimeChannel = supabase
    .channel('maskana-db-changes')

    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participants'
      },
      payload => {
        console.log(
          'Realtime peserta:',
          payload
        );

        loadRemoteData();
      }
    )

    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'attendance'
      },
      payload => {
        console.log(
          'Realtime kehadiran:',
          payload
        );

        loadRemoteData();
      }
    )

    .subscribe(status => {

      console.log(
        'Supabase Realtime:',
        status
      );

      if (status === 'SUBSCRIBED') {
        toast(
          'Sinkronisasi realtime aktif.'
        );
      }
    });
}


/* =========================================================
   QR
========================================================= */

function showQR(id) {

  const p = data.participants.find(
    x => x.id === id
  );

  if (!p) return;

  activeCardParticipant = p;

  $('#cardName').textContent = p.name;

  $('#cardAddress').textContent =
    `${p.village}, ${p.district}, ${p.regency}`;

  $('#cardPhone').textContent = p.phone;

  const box = $('#qrCode');

  box.innerHTML = '';

  new QRCode(box, {
    text: p.id,
    width: 160,
    height: 160,
    colorDark: '#073d39',
    colorLight: '#ffffff',
    correctLevel:
      QRCode.CorrectLevel.M
  });

  $('#qrModal').showModal();
}


/* =========================================================
   KARTU
========================================================= */

async function cardFile() {

  const canvas =
    await html2canvas(
      $('#participantCard'),
      {
        scale: 3,
        useCORS: true,
        backgroundColor: null
      }
    );

  const blob =
    await new Promise(resolve =>
      canvas.toBlob(
        resolve,
        'image/png'
      )
    );

  return new File(
    [blob],
    `kartu-qr-${activeCardParticipant.name
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()}.png`,
    {
      type: 'image/png'
    }
  );
}

async function downloadCard() {

  if (
    !activeCardParticipant ||
    !window.html2canvas
  ) {
    toast(
      'Fitur unduh belum siap.'
    );
    return;
  }

  const button = $('#downloadCard');

  button.disabled = true;
  button.textContent =
    'Menyiapkan...';

  try {

    const file = await cardFile();

    const link =
      document.createElement('a');

    link.download = file.name;
    link.href =
      URL.createObjectURL(file);

    link.click();

    URL.revokeObjectURL(link.href);

    toast(
      'Kartu QR berhasil diunduh.'
    );

  } catch (error) {

    console.error(error);

    toast(
      'Kartu belum dapat diunduh.'
    );

  } finally {

    button.disabled = false;
    button.textContent =
      '⇩ Unduh PNG';
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
      'Fitur kartu belum siap.'
    );
    return;
  }

  const button =
    $('#sendWhatsApp');

  button.disabled = true;
  button.textContent =
    'Menyiapkan kartu...';

  try {

    const file =
      await cardFile();

    const p =
      activeCardParticipant;

    const text =
      `Kartu peserta ${p.name} — Pertemuan Warga Maskana Bersatu. Mohon simpan dan tunjukkan QR saat registrasi.`;

    if (
      navigator.canShare &&
      navigator.canShare({
        files: [file]
      })
    ) {

      await navigator.share({
        title: 'Kartu QR Peserta',
        text,
        files: [file]
      });

      toast(
        'Pilih WhatsApp pada menu berbagi.'
      );

    } else {

      const link =
        document.createElement('a');

      link.download = file.name;
      link.href =
        URL.createObjectURL(file);

      link.click();

      URL.revokeObjectURL(link.href);

      toast(
        'Kartu diunduh.'
      );
    }

  } catch (error) {

    if (
      error.name !== 'AbortError'
    ) {
      toast(
        'Kartu belum dapat dikirim.'
      );
    }

  } finally {

    button.disabled = false;

    button.textContent =
      '◉ Kirim kartu ke WhatsApp';
  }
}


/* =========================================================
   SCAN QR / KEHADIRAN
========================================================= */

async function recordScan(code) {

  const cleanCode =
    code.trim().toLowerCase();

  const p =
    data.participants.find(
      x =>
        x.id.toLowerCase() ===
        cleanCode
    );

  $('#scanInput').value = '';

  if (!p) {

    toast(
      'Kode QR tidak ditemukan.'
    );

    $('#scanResult').innerHTML = `
      <div class="result-card">
        <div
          class="success-icon"
          style="
            background:#fff0ee;
            color:#da6c60">
          !
        </div>

        <h2>Kode tidak ditemukan</h2>

        <p>
          Pastikan QR berasal dari aplikasi ini.
        </p>
      </div>
    `;

    return;
  }

  const existing =
    data.attendance.find(
      a => a.id === p.id
    );

  if (existing) {

    toast(
      `${p.name} sudah tercatat hadir.`
    );

    $('#scanResult').innerHTML =
      resultHTML(
        p,
        existing.time,
        true
      );

    return;
  }

  const time =
    new Date().toISOString();

  const result =
    await supabase
      .from('attendance')
      .insert({
        participant_id: p.id,
        time: time
      });

  if (result.error) {

    if (
      result.error.code ===
      '23505'
    ) {

      await loadRemoteData();

      const latest =
        data.attendance.find(
          a => a.id === p.id
        );

      toast(
        `${p.name} sudah tercatat hadir.`
      );

      $('#scanResult').innerHTML =
        resultHTML(
          p,
          latest?.time || time,
          true
        );

      return;
    }

    console.error(
      'Attendance error:',
      result.error
    );

    toast(
      `Gagal menyimpan kehadiran: ${
        result.error.message ||
        'error database'
      }`
    );

    return;
  }

  data.attendance.unshift({
    id: p.id,
    time: time
  });

  cacheData();

  render();

  $('#scanResult').innerHTML =
    resultHTML(
      p,
      time,
      false
    );

  toast(
    `Kehadiran ${p.name} berhasil dicatat!`
  );
}

function resultHTML(
  p,
  time,
  already
) {

  return `
    <div class="result-card">

      <div class="success-icon">
        ${already ? 'i' : '✓'}
      </div>

      <h2>
        ${
          already
            ? 'Sudah tercatat hadir'
            : 'Kehadiran berhasil!'
        }
      </h2>

      <p>
        ${
          already
            ? 'Peserta ini telah dipindai sebelumnya.'
            : 'Data kehadiran tersimpan secara online.'
        }
      </p>

      <span
        class="avatar"
        style="
          margin:0 auto 10px;
          width:42px;
          height:42px">
        ${initials(p.name)}
      </span>

      <h3
        style="
          margin:0;
          font-size:15px">
        ${esc(p.name)}
      </h3>

      <div class="result-details">

        <p>
          Desa
          <b>${esc(p.village)}</b>
        </p>

        <p>
          Kecamatan
          <b>${esc(p.district)}</b>
        </p>

        <p>
          Waktu hadir
          <b>${fmtTime(time)}</b>
        </p>

      </div>
    </div>
  `;
}


/* =========================================================
   TAMBAH PESERTA
========================================================= */

async function addParticipant(e) {

  e.preventDefault();

  const form =
    e.target;

  const f =
    new FormData(form);

  const name =
    String(
      f.get('name') || ''
    ).trim();

  if (!name) {

    toast(
      'Nama peserta wajib diisi.'
    );

    return;
  }

  const p = {

    id:
      'HK-' +
      Date.now()
        .toString(36)
        .toUpperCase() +
      '-' +
      Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase(),

    name: name,

    phone:
      String(
        f.get('phone') || ''
      ).trim(),

    village:
      String(
        f.get('village') || ''
      ).trim(),

    district:
      String(
        f.get('district') || ''
      ).trim(),

    regency:
      String(
        f.get('regency') || ''
      ).trim()
  };

  const button =
    form.querySelector(
      'button[type="submit"]'
    );

  if (button)
    button.disabled = true;

  try {

    console.log(
      'Menyimpan peserta ke Supabase:',
      p
    );

    const result =
      await supabase
        .from('participants')
        .insert({
          id: p.id,
          name: p.name,
          phone: p.phone,
          village: p.village,
          district: p.district,
          regency: p.regency
        })
        .select();

    if (result.error) {
      throw result.error;
    }

    console.log(
      'Peserta berhasil masuk Supabase:',
      result.data
    );

    data.participants.unshift(p);

    rememberAddress(p);

    cacheData();

    form.reset();

    $('#participantModal').close();

    render();

    showQR(p.id);

    toast(
      'Peserta berhasil disimpan ke database online.'
    );

  } catch (error) {

    console.error(
      'GAGAL INSERT PESERTA:',
      error
    );

    toast(
      `Gagal menyimpan peserta: ${
        error.message ||
        'Periksa koneksi Supabase'
      }`
    );

  } finally {

    if (button)
      button.disabled = false;
  }
}


/* =========================================================
   EXPORT CSV
========================================================= */

function exportCSV() {

  const rows = [
    [
      'Nama',
      'Desa',
      'Kecamatan',
      'Kabupaten',
      'WhatsApp',
      'Waktu Hadir'
    ],

    ...data.participants.map(
      p => {

        const a =
          data.attendance.find(
            a => a.id === p.id
          );

        return [
          p.name,
          p.village,
          p.district,
          p.regency,
          p.phone,
          a
            ? new Date(
                a.time
              ).toLocaleString(
                'id-ID'
              )
            : 'Belum hadir'
        ];
      }
    )
  ];

  const csv =
    '\ufeff' +
    rows
      .map(
        r =>
          r
            .map(
              v =>
                '"' +
                String(v)
                  .replaceAll(
                    '"',
                    '""'
                  ) +
                '"'
            )
            .join(',')
      )
      .join('\n');

  const a =
    document.createElement('a');

  a.href =
    URL.createObjectURL(
      new Blob(
        [csv],
        {
          type:
            'text/csv'
        }
      )
    );

  a.download =
    'rekap-absensi-maskana.csv';

  a.click();

  URL.revokeObjectURL(
    a.href
  );

  toast(
    'Data rekap berhasil diunduh.'
  );
}


/* =========================================================
   NAVIGASI
========================================================= */

document
  .querySelectorAll('.nav-item')
  .forEach(button => {

    button.onclick = () => {

      document
        .querySelectorAll(
          '.nav-item,.tab'
        )
        .forEach(x =>
          x.classList.remove(
            'active'
          )
        );

      button.classList.add(
        'active'
      );

      const tab =
        $('#' + button.dataset.tab);

      if (tab)
        tab.classList.add(
          'active'
        );

      if ($('#pageTitle')) {

        $('#pageTitle').textContent =
          button.dataset.tab ===
          'dashboard'
            ? 'Selamat datang 👋'
            : button.textContent.trim();
      }

      if (
        button.dataset.tab ===
        'scan'
      ) {

        setTimeout(() => {

          if ($('#scanInput'))
            $('#scanInput').focus();

        }, 100);
      }
    };
  });


document
  .querySelectorAll('[data-go]')
  .forEach(button => {

    button.onclick = () => {

      const target =
        document.querySelector(
          `.nav-item[data-tab="${button.dataset.go}"]`
        );

      if (target)
        target.click();
    };
  });


/* =========================================================
   MODAL TAMBAH PESERTA
========================================================= */

if ($('#addParticipant')) {

  $('#addParticipant').onclick =
    () =>
      $('#participantModal').showModal();
}


/* =========================================================
   ALAMAT OTOMATIS
========================================================= */

if ($('#villageInput')) {

  $('#villageInput')
    .addEventListener(
      'input',
      autoFillAddress
    );

  $('#villageInput')
    .addEventListener(
      'change',
      autoFillAddress
    );
}


/* =========================================================
   FORM PESERTA
========================================================= */

if ($('#participantForm')) {

  $('#participantForm')
    .addEventListener(
      'submit',
      addParticipant
    );
}


/* =========================================================
   SCANNER
========================================================= */

if ($('#scanInput')) {

  $('#scanInput')
    .addEventListener(
      'keydown',
      e => {

        if (
          e.key === 'Enter'
        ) {

          e.preventDefault();

          recordScan(
            e.target.value
          );
        }
      }
    );
}


/* =========================================================
   SEARCH
========================================================= */

if ($('#participantSearch')) {

  $('#participantSearch')
    .addEventListener(
      'input',
      renderParticipants
    );
}

if ($('#attendanceSearch')) {

  $('#attendanceSearch')
    .addEventListener(
      'input',
      renderAttendance
    );
}


/* =========================================================
   TOMBOL QR / HAPUS
========================================================= */

document.addEventListener(
  'click',
  async e => {

    if (
      e.target.dataset.qr
    ) {

      showQR(
        e.target.dataset.qr
      );
    }


    if (
      e.target.dataset.delete
    ) {

      const p =
        data.participants.find(
          x =>
            x.id ===
            e.target.dataset.delete
        );

      if (!p) return;

      if (
        !confirm(
          `Hapus ${p.name}?`
        )
      ) {
        return;
      }

      try {

        const result =
          await supabase
            .from(
              'participants'
            )
            .delete()
            .eq(
              'id',
              p.id
            );

        if (result.error)
          throw result.error;

        data.participants =
          data.participants.filter(
            x =>
              x.id !== p.id
          );

        data.attendance =
          data.attendance.filter(
            x =>
              x.id !== p.id
          );

        cacheData();

        render();

        toast(
          'Peserta dihapus dari database online.'
        );

      } catch (error) {

        console.error(
          error
        );

        toast(
          `Gagal menghapus peserta: ${
            error.message ||
            'error database'
          }`
        );
      }
    }
  }
);


/* =========================================================
   TOMBOL KARTU
========================================================= */

if ($('.close-qr')) {

  $('.close-qr').onclick =
    () =>
      $('#qrModal').close();
}

if ($('#downloadCard')) {

  $('#downloadCard').onclick =
    downloadCard;
}

if ($('#sendWhatsApp')) {

  $('#sendWhatsApp').onclick =
    sendWhatsApp;
}


/* =========================================================
   EXPORT
========================================================= */

if ($('#exportBtn')) {

  $('#exportBtn').onclick =
    exportCSV;
}

if ($('#exportBtn2')) {

  $('#exportBtn2').onclick =
    exportCSV;
}


/* =========================================================
   START APPLICATION
========================================================= */

(async function init() {

  console.log(
    '================================'
  );

  console.log(
    'ABSEN MASKANA - SUPABASE ONLINE'
  );

  console.log(
    '================================'
  );

  try {

    if (
      !window.supabase
    ) {

      throw new Error(
        'Library Supabase belum dimuat.'
      );
    }

    if (
      !window.MASKANA_SUPABASE_URL ||
      !window.MASKANA_SUPABASE_KEY
    ) {

      throw new Error(
        'Konfigurasi Supabase belum tersedia.'
      );
    }

    render();

    await loadRemoteData();

    subscribeRealtime();

    console.log(
      'Aplikasi berhasil terhubung ke Supabase.'
    );

  } catch (error) {

    console.error(
      'INIT ERROR:',
      error
    );

    toast(
      `Koneksi database gagal: ${
        error.message
      }`
    );
  }

})();
