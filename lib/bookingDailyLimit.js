export function sameDailyCustomer(left, right) {
  if (!left?.date || left.date !== right?.date) return false;
  const account = (value) => String(value || "").trim().toLowerCase();
  const email = (value) => String(value || "").trim().toLowerCase();
  const phone = (value) => String(value || "").replace(/[^\d+]/g, "").replace(/^\+?81(?=\d{9,10}$)/, "0");
  return Boolean(
    (account(left.customerAccountId) && account(left.customerAccountId) === account(right.customerAccountId)) ||
    (email(left.email) && email(left.email) === email(right.email)) ||
    (phone(left.phone) && phone(left.phone) === phone(right.phone))
  );
}
