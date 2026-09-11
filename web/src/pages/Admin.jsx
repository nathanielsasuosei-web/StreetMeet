import { useEffect, useState } from "react";
import { adminApi } from "../lib/api.js";
import { useToast } from "../state/ToastContext.jsx";
import { IconShield } from "../components/Icons.jsx";

export default function Admin() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("overview");

  const load = async () => {
    try {
      const [statsData, userData, reportData] = await Promise.all([
        adminApi.stats(),
        adminApi.users(search),
        adminApi.reports("ALL"),
      ]);
      setStats(statsData.stats);
      setUsers(userData.users || []);
      setReports(reportData.reports || []);
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id, payload, message) => {
    try {
      await adminApi.setUser(id, payload);
      toast.success(message);
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const resolve = async (id, action) => {
    try {
      await adminApi.resolveReport(id, action);
      toast.success(`Report ${action.toLowerCase()}ed`);
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <IconShield />
        <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Admin</h2>
      </div>

      <div className="chips" style={{ marginBottom: 16 }}>
        {["overview", "members", "reports"].map((option) => (
          <button key={option} className={`chip ${tab === option ? "active" : ""}`} onClick={() => setTab(option)}>
            {option}
          </button>
        ))}
      </div>

      {!stats ? (
        <div className="loader"><span className="spinner-ring" /></div>
      ) : tab === "overview" ? (
        <div className="grid grid-2">
          {[
            ["Members", stats.users],
            ["Matches", stats.matches],
            ["Messages", stats.messages],
            ["Live statuses", stats.liveStatuses],
            ["Premium", stats.premiumUsers],
            ["Calls", stats.calls],
          ].map(([label, value]) => (
            <div className="card center" key={label}>
              <strong style={{ fontSize: "1.6rem" }}>{value}</strong>
              <div className="tiny muted">{label}</div>
            </div>
          ))}
          <div className="card center" style={{ gridColumn: "1 / -1", background: "var(--grad-soft)" }}>
            <strong style={{ fontSize: "1.6rem" }}>GH¢{stats.revenueMajor.toFixed(2)}</strong>
            <div className="tiny muted">Revenue · {stats.paidTransactions} paid transactions</div>
          </div>
        </div>
      ) : tab === "members" ? (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <input
              className="input"
              placeholder="Search by name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button className="btn" onClick={load}>Search</button>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((member) => (
                <tr key={member.id}>
                  <td>
                    <strong>{member.fullName}</strong>
                    <div className="tiny muted">{member.email}</div>
                  </td>
                  <td>{member.isPremium ? "👑 Gold" : "Free"}</td>
                  <td>
                    {member.role !== "USER" ? <span className="pill pill-gold">{member.role}</span> : null}{" "}
                    {member.isPremium ? <span className="pill pill-gold">premium</span> : null}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => act(member.id, { verified: !member.verified }, "Verification updated")}
                      >
                        {member.verified ? "Unverify" : "Verify"}
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => act(member.id, { banned: true }, "Member banned")}
                      >
                        Ban
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div className="stack">
          {!reports.length && <div className="notice">No reports. The community is behaving 🎉</div>}
          {reports.map((report) => (
            <div className="card" key={report.id}>
              <div className="row-between">
                <strong>{report.reason.replace("_", " ").toLowerCase()}</strong>
                <span className="pill">{report.status}</span>
              </div>
              <div className="small muted">
                {report.reporter?.fullName} → {report.reported?.fullName}
              </div>
              {report.details && <p className="small">{report.details}</p>}
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-sm" onClick={() => resolve(report.id, "DISMISS")}>Dismiss</button>
                <button className="btn btn-sm" onClick={() => resolve(report.id, "WARN")}>Warn</button>
                <button className="btn btn-sm btn-danger" onClick={() => resolve(report.id, "BAN")}>
                  Ban {report.reported?.fullName?.split(" ")[0]}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
