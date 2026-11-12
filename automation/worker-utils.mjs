export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function waitBeforeOperation(log = () => {}) {
  const delay = 1000 + Math.floor(Math.random() * 2001);
  log("waiting before operation", `${delay}ms`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
