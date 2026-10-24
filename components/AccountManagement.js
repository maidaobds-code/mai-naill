"use client";

import { useMemo, useState } from "react";
import { useAccountStore } from "../lib/accountStore";

const roleLabels = {
  owner: "Chủ quán",
  staff: "Nhân viên",
  customer: "Khách hàng",
};

const roleOptions = [
  { value: "owner", label: "Chủ quán" },
  { value: "staff", label: "Nhân viên" },
  { value: "customer", label: "Khách hàng" },
];

export default function AccountManagement({ label = "Quản lý tài khoản", embedded = false }) {
  const { accounts, currentAccount, updateAccountRole, deleteAccount } = useAccountStore();
  const [message, setMessage] = useState("");
  const sortedAccounts = useMemo(() => [...accounts].sort((a, b) => {
    const roleOrder = { owner: 0, staff: 1, customer: 2 };
    return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3) || String(a.name || a.email).localeCompare(String(b.name || b.email));
  }), [accounts]);

  async function changeRole(accountId, role) {
    const result = await updateAccountRole(accountId, role);
    setMessage(result.ok ? "Đã cập nhật quyền tài khoản." : result.message);
  }

  function removeAccount(account) {
    const confirmed = window.confirm(`Xóa tài khoản ${account.email || account.name}?`);
    if (!confirmed) return;
    const result = deleteAccount(account.id);
    setMessage(result.ok ? "Đã xóa tài khoản." : result.message);
  }

  return (
    <>
      {!embedded && <div className="pageHead">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1>{label}</h1>
          <p>Cấp quyền chủ quán, nhân viên, khách hàng và xóa tài khoản không còn sử dụng.</p>
        </div>
      </div>}

      <section className="card accountAdminPanel">
        <div className="sectionTitle">
          <div>
            <h2>Danh sách tài khoản</h2>
            <p>Tài khoản chủ quán có toàn quyền quản lý hệ thống.</p>
          </div>
          <span className="pill active">{accounts.length} tài khoản</span>
        </div>
        {message && <p className="storeNote successNote">{message}</p>}
        <div className="accountAdminTable">
          <table>
            <thead>
              <tr>
                <th>Tài khoản</th>
                <th>Email</th>
                <th>Quyền</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {sortedAccounts.map((account) => {
                const isSelf = account.id === currentAccount?.id;
                const isLastOwner = account.role === "owner" && accounts.filter((item) => item.role === "owner").length <= 1;
                return (
                  <tr key={account.id}>
                    <td><strong>{account.name || account.email}</strong><small>{account.id}</small></td>
                    <td>{account.email || "-"}</td>
                    <td>
                      <select value={account.role} onChange={(event) => changeRole(account.id, event.target.value)} disabled={isLastOwner}>
                        {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </td>
                    <td><span className={account.role === "owner" ? "pill active" : "pill"}>{roleLabels[account.role] || account.role}</span>{isSelf && <small>Đang đăng nhập</small>}</td>
                    <td><button className="ghost dangerGhost" type="button" onClick={() => removeAccount(account)} disabled={isSelf || isLastOwner}>Xóa</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
