const fields = ["mainaillUrl", "bookingSyncSecret", "pollMinSeconds", "pollMaxSeconds", "nailieDryRun", "salonboardDryRun", "startWorkersOnLaunch", "startWithWindows"];

function parseJsonField(id) {
  const text = document.getElementById(id).value.trim();
  if (!text) return {};
  return JSON.parse(text);
}

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
  const config = await window.mainaillBot.getConfig();
  for (const id of fields) {
    const element = document.getElementById(id);
    if (element.type === "checkbox") element.checked = Boolean(config[id]);
    else element.value = config[id] ?? "";
  }
  document.getElementById("nailieStaffMapping").value = JSON.stringify(config.nailieStaffMapping || {}, null, 2);
  document.getElementById("salonboardStaffRules").value = JSON.stringify(config.salonboardStaffRules || {}, null, 2);
  renderWorkers(await window.mainaillBot.getWorkers());
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
    value.nailieStaffMapping = parseJsonField("nailieStaffMapping");
    value.salonboardStaffRules = parseJsonField("salonboardStaffRules");
    await window.mainaillBot.saveConfig(value);
    message.textContent = "Đã lưu cấu hình.";
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
window.mainaillBot.onWorkerState(renderWorkers);
load();

