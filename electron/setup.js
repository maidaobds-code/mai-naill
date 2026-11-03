const fields = ["mainaillUrl", "bookingSyncSecret", "pollMinSeconds", "pollMaxSeconds", "nailieDryRun", "salonboardDryRun", "startWorkersOnLaunch", "startWithWindows"];

function renderWorkers(state) {
  for (const name of ["salonboard", "nailie"]) {
    const running = Boolean(state?.[name]?.running);
    document.getElementById(`${name}State`).textContent = running ? `Đang chạy · PID ${state[name].pid}` : "Đã dừng";
    const button = document.querySelector(`[data-worker="${name}"]`);
    button.textContent = running ? "Dừng" : "Khởi động";
    button.dataset.running = String(running);
  }
}

async function load() {
  document.getElementById("appVersion").textContent = `v${await window.mainaillBot.getVersion()}`;
  const config = await window.mainaillBot.getConfig();
  for (const id of fields) {
    const element = document.getElementById(id);
    if (element.type === "checkbox") element.checked = Boolean(config[id]);
    else element.value = config[id] ?? "";
  }
  renderMapping(config.mappingSnapshot);
  renderWorkers(await window.mainaillBot.getWorkers());
  if (config.bookingSyncSecret) refreshMapping();
}

function renderMapping(snapshot) {
  const rows = Array.isArray(snapshot?.mappings) ? snapshot.mappings : [];
  document.getElementById("salonboardSalonAccount").textContent = snapshot?.salonAccounts?.salonboard || "Chưa cấu hình";
  document.getElementById("nailieSalonAccount").textContent = snapshot?.salonAccounts?.nailie || "Chưa cấu hình";
  document.getElementById("mappingStatus").textContent = rows.length ? `Đã tải ${rows.length} nhân viên · ${new Date(snapshot.fetchedAt).toLocaleString("vi-VN")}` : "Chưa có dữ liệu mapping từ Mainaill.";
  document.getElementById("mappingRows").innerHTML = rows.length ? rows.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td>${escapeHtml(item.hotpepper || "Chưa gán")}</td><td>${escapeHtml(item.nailie || "Chưa gán")}</td><td><span class="mappingBadge ${item.complete ? "complete" : "missing"}">${item.complete ? "Có mapping" : "Chưa gán app nào"}</span></td></tr>`).join("") : '<tr><td colspan="4">Chưa có nhân viên hoặc chưa tải được mapping.</td></tr>';
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

async function refreshMapping() {
  const status = document.getElementById("mappingStatus");
  status.textContent = "Đang tải mapping từ Mainaill…";
  try {
    const result = await window.mainaillBot.refreshMapping();
    renderMapping(result.snapshot);
  } catch (error) { status.textContent = `Không thể tải mapping: ${error.message}`; }
}

document.getElementById("configForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.getElementById("message");
  try {
    const value = {};
    for (const id of fields) {
      const element = document.getElementById(id);
      value[id] = element.type === "checkbox" ? element.checked : element.type === "number" ? Number(element.value) : element.value.trim();
    }
    await window.mainaillBot.saveConfig(value);
    message.textContent = "Đã lưu cấu hình.";
    await refreshMapping();
  } catch (error) { message.textContent = `Lỗi: ${error.message}`; }
});

document.querySelectorAll("[data-worker]").forEach((button) => button.addEventListener("click", async () => {
  const name = button.dataset.worker;
  if (button.dataset.running === "true") await window.mainaillBot.stopWorker(name);
  else await window.mainaillBot.startWorker(name);
  renderWorkers(await window.mainaillBot.getWorkers());
}));
document.getElementById("openMainaill").addEventListener("click", () => window.mainaillBot.openMainaill());
document.getElementById("openLogs").addEventListener("click", () => window.mainaillBot.openLogs());
document.getElementById("refreshMapping").addEventListener("click", refreshMapping);
window.mainaillBot.onWorkerState(renderWorkers);
window.mainaillBot.onMappingError((value) => { document.getElementById("mappingStatus").textContent = `Không thể khởi động worker: ${value}`; });
load();

