let mode = 'insert'; // default
let selectedIDK = null;

// tombol tampilkan form
document.getElementById('btnShowForml').addEventListener('click', () => {
  mode = 'insert';
  selectedIDK = null;

  const form = document.getElementById('mainForml');
  form.style.display = 'block';

  // kosongkan input
  document.getElementById('userid').value = '';
  document.getElementById('usernm').value = '';
  document.getElementById('namafull').value = '';
  document.getElementById('stkid').value = '';
  document.getElementById('userpassword').value = '';
  document.getElementById('userrole').value = '';
  document.getElementById('useractive').checked = true;

  //document.getElementById("idk").readOnly = false;
});

async function masukin() {
  console.log('MULAI INPUT DATA');
  const send = {};

  // =====================
  // FIELD UTAMA
  // =====================

  send.username = document.getElementById('usernm').value;
  send.userpassword = document.getElementById('userpassword').value;
  send.namafull = document.getElementById('namafull').value;
  send.stkid = document.getElementById('stkid').value;
  send.userrole = document.getElementById('userrole').value;
  send.useractive = document.getElementById('useractive').checked;

  // =====================
  // KIRIM KE SERVER
  // =====================
  const res = await fetch('/mlogin/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(send),
  });

  const result = await res.json();

  if (result.success) {
    alert('Data berhasil diinput!');
  } else {
    alert('Gagal input data!');
  }
}

//UPDATE  DATA

document.getElementById('btnSimpanl').addEventListener('click', async () => {
  await simpan();
});

document.getElementById('btnBatall').addEventListener('click', async () => {
  document.getElementById('mainForml').style.display = 'none';
  await loadDatak();
});

async function simpan() {
  const send = {
    userid: document.getElementById('userid').value,
    usernm: document.getElementById('usernm').value,
    stkid: document.getElementById('stkid').value,
    userpassword: document.getElementById('userpassword').value,
    namafull: document.getElementById('namafull').value,
    userrole: document.getElementById('userrole').value,
    useractive: document.getElementById('useractive').checked,
  };

  let url = '';

  if (mode === 'insert') {
    url = '/mlogin/create'; // INSERT
  } else {
    url = '/mlogin/update'; // UPDATE
  }

  //console.log(send);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(send),
  });

  const result = await res.json();

  if (result.success) {
    alert(
      mode === 'insert' ? 'Data berhasil ditambah!' : 'Data berhasil diupdate!'
    );

    // reset form
    document.getElementById('mainForml').style.display = 'none';
    await loadDatak();
  } else {
    alert('Gagal menyimpan data!');
  }
}

// helper
function getForm() {
  return {
    userid: document.getElementById('userid').value,
    usernm: document.getElementById('usernm').value,
    stkid: document.getElementById('stkid').value,
    userpassword: document.getElementById('userpassword').value,
    namafull: document.getElementById('namafull').value,
    userrole: document.getElementById('userrole').value,
    useractive: document.getElementById('useractive').checked,
  };
}

async function loadDatak() {
  return new Promise(async (resolve) => {
    const res = await fetch(`/mlogin/load`);
    const data = await res.json();

    //console.log("Data yang diterima:",data.loadData); // <-- pastikan struktur data benar

    const tbody = document.querySelector('#tblmlogin tbody');
    tbody.innerHTML = '';

    //<tr onclick="selectRow('${row.id}')">

    if (data.success && data.data.length > 0) {
      data.data.forEach((row) => {
        //console.log(`Loading row: ${row.id}, ${row.username}, Period: ${String(row.period).substring(0, 7)}`);
        tbody.innerHTML += `

            <tr>
            <td onclick="selectRow('${row.user_id}')">${row.user_id}</td>
            <td>${row.username}</td>
            <td>${row.full_name}</td>
            <td>${row.role}</td>
            <td>${row.is_active}</td>
            <td>${row.created_at}</td>

            <td class="text-center">
                <input type="checkbox" class="chkRow"
               data-idk="${row.user_id}"
               style="transform: scale(1.2);">
            </td>
            </tr>
            `;
      });
      rebindCheckboxEvents();
    } else {
      tbody.innerHTML = `
            <tr><td colspan="4" class="text-center text-danger">Tidak ada data</td></tr>
        `;
    }
    resolve(); //  <-- penting
  });
}

function rebindCheckboxEvents() {
  const chkAll = document.getElementById('chkHeaderl');
  const chkRows = document.querySelectorAll('.chkRow');

  // Event header
  chkAll.onchange = () => {
    chkRows.forEach((chk) => (chk.checked = chkAll.checked));
  };

  // Event baris
  chkRows.forEach((chk) => {
    chk.onchange = () => {
      const allChecked = [...chkRows].every((c) => c.checked);
      chkAll.checked = allChecked;
    };
  });
}

// apabila halaman mlogin dibuka, maka DOM ini juga jalan
document.addEventListener('DOMContentLoaded', async () => {
  await loadDatak();
});

async function selectRow(xIDK) {
  mode = 'edit';
  selectedIDK = xIDK;

  const form = document.getElementById('mainForml');
  form.style.display = 'block';

  //const periode = document.getElementById("idk").value;
  //document.getElementById("idk").readOnly = true;

  try {
    document.body.style.cursor = 'wait';
    const res = await fetch(`/mlogin/load/${xIDK}`);

    if (!res.ok) throw new Error('Fetch gagal');

    const result = await res.json();

    // ✅ TARUH DI SINI
    if (!result.success) {
      alert('Gagal ambil data');
      return;
    }

    // baru ambil row
    const row = result.data;
    //const row = result.data[0];
    if (!row) {
      alert('Data tidak ditemukan!');
      return;
    }

    document.getElementById('userid').value = row.user_id;
    document.getElementById('usernm').value = row.username;
    //document.getElementById('userpassword').value = row.password_hash;
    document.getElementById('userpassword').value = '';
    document.getElementById('namafull').value = row.full_name;
    document.getElementById('stkid').value = row.stkid;
    document.getElementById('userrole').value = row.role;
    //document.getElementById("useractive").checked = row.is_active;
    document.getElementById('useractive').checked =
      row.is_active === true || row.is_active === 'true';
  } catch (err) {
    console.error(err);
    alert('Terjadi error');
  } finally {
    document.body.style.cursor = 'default';
  }
}

document.getElementById('btnCaril').addEventListener('click', function () {
  let keyword = document.getElementById('carik').value.toLowerCase();
  let table = document.getElementById('tblmlogin');
  let rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');

  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    let text = row.innerText.toLowerCase();
    //let nama = row.cells[2].innerText.toLowerCase(); // kolom NAMA

    if (text.includes(keyword)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  }
});

//DELETE DATA
document.getElementById('btnDeletel').addEventListener('click', async () => {
  const selected = document.querySelectorAll('.chkRow:checked');
  if (selected.length === 0) {
    alert('Tidak ada data yang dipilih!');
    return;
  }

  if (!confirm('Hapus semua data yang dipilih?')) return;

  const list = [];
  selected.forEach((c) => {
    list.push({
      id: c.dataset.idk,
    });
  });
  //console.log("Data yang akan dihapus:", list);

  const res = await fetch('/mlogin/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: list }),
  });

  const json = await res.json();

  if (json.success) {
    alert('Data berhasil dihapus!');
    // reset form
    document.getElementById('mainForml').style.display = 'none';
    await loadDatak();
  } else {
    alert('Gagal menghapus data.');
  }
});
