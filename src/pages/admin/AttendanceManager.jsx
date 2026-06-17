import { useMemo, useState } from "react";
import { Search, UserCheck, Calendar, Clock, Plus, Trash2, Award, ClipboardList, TrendingUp } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { createStaff, updateStaff, deleteStaff, saveAttendance, format12HourTime } from "../../lib/api";
import toast from "react-hot-toast";

export default function AttendanceManager() {
  const { staff, attendance, invoices, reload } = useAdmin();
  const [subView, setSubView] = useState("attendance"); // attendance | roster | performance
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [staffModal, setStaffModal] = useState(null); // null | {} = add | {id...} = edit
  const [saving, setSaving] = useState(false);

  // Performance date range filters
  const firstDayOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  };
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Local state for attendance logging
  const activeStaff = useMemo(() => (staff || []).filter(s => s.active), [staff]);
  
  // Initialize attendance state for the chosen date
  const [attendanceLogs, setAttendanceLogs] = useState({});

  useMemo(() => {
    // When date or staff loads, populate attendance logs with existing DB data or defaults
    const logs = {};
    activeStaff.forEach(s => {
      const match = (attendance || []).find(a => a.staff_id === s.id && a.date === date);
      logs[s.id] = {
        staff_id: s.id,
        date: date,
        status: match?.status || "present",
        check_in: match?.check_in || "09:00",
        check_out: match?.check_out || "21:00",
        notes: match?.notes || "",
      };
    });
    setAttendanceLogs(logs);
  }, [date, activeStaff, attendance]);

  const handleStatusChange = (staffId, status) => {
    setAttendanceLogs(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        status
      }
    }));
  };

  const handleFieldChange = (staffId, field, val) => {
    setAttendanceLogs(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        [field]: val
      }
    }));
  };

  const handleSaveAttendance = async () => {
    setSaving(true);
    try {
      const rows = Object.values(attendanceLogs);
      await saveAttendance(rows);
      toast.success("Attendance logged successfully for " + date);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (staffModal.id) {
        await updateStaff(staffModal.id, staffModal);
        toast.success("Staff details updated");
      } else {
        await createStaff(staffModal);
        toast.success("Staff member added to roster");
      }
      setStaffModal(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to save staff");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = async (id) => {
    if (!window.confirm("Remove this staff member from the system?")) return;
    try {
      await deleteStaff(id);
      toast.success("Staff member deleted");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to delete staff");
    }
  };

  const performanceData = useMemo(() => {
    const attendanceInRange = (attendance || []).filter(a => a.date >= startDate && a.date <= endDate);
    const invoicesInRange = (invoices || []).filter(inv => {
      const invDate = inv.billing_at ? inv.billing_at.slice(0, 10) : "";
      return invDate >= startDate && invDate <= endDate && inv.status !== "void";
    });

    return (staff || []).map(member => {
      const memberLogs = attendanceInRange.filter(a => a.staff_id === member.id);
      const daysPresent = memberLogs.filter(a => a.status === "present" || a.status === "late").length;
      
      let totalHours = 0;
      let totalOvertimeHours = 0;

      memberLogs.forEach(log => {
        if ((log.status === "present" || log.status === "late") && log.check_in && log.check_out) {
          const [inH, inM] = log.check_in.split(":").map(Number);
          const [outH, outM] = log.check_out.split(":").map(Number);
          if (!isNaN(inH) && !isNaN(outH)) {
            const checkInMins = inH * 60 + inM;
            const checkOutMins = outH * 60 + outM;
            const diffMins = checkOutMins - checkInMins;
            if (diffMins > 0) {
              const hours = diffMins / 60;
              totalHours += hours;
              if (hours > 9) {
                totalOvertimeHours += (hours - 9);
              }
            }
          }
        }
      });

      let servicesCount = 0;
      const servedCustomerIds = new Set();
      let tipsEarned = 0;

      invoicesInRange.forEach(inv => {
        if (inv.staff_name === member.name) {
          tipsEarned += Number(inv.tip || 0);
          servedCustomerIds.add(inv.customer_id || inv.client_name);
        }
        
        (inv.invoice_items || []).forEach(item => {
          const itemStaff = item.staff_name || inv.staff_name;
          if (itemStaff === member.name) {
            servicesCount += Number(item.quantity || 1);
            servedCustomerIds.add(inv.customer_id || inv.client_name);
          }
        });
      });

      return {
        id: member.id,
        name: member.name,
        role: member.role,
        daysPresent,
        totalHours: Math.round(totalHours * 10) / 10,
        totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
        servicesCount,
        customersCount: servedCustomerIds.size,
        tipsEarned: Math.round(tipsEarned),
      };
    });
  }, [staff, attendance, invoices, startDate, endDate]);

  return (
    <>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <button className={`tbl-btn ${subView === "attendance" ? "active" : ""}`} onClick={() => setSubView("attendance")}>
          <ClipboardList size={14} style={{ marginRight: 6 }} /> Daily Attendance Logs
        </button>
        <button className={`tbl-btn ${subView === "roster" ? "active" : ""}`} onClick={() => setSubView("roster")}>
          <UserCheck size={14} style={{ marginRight: 6 }} /> Staff Directory
        </button>
        <button className={`tbl-btn ${subView === "performance" ? "active" : ""}`} onClick={() => setSubView("performance")}>
          <TrendingUp size={14} style={{ marginRight: 6 }} /> Staff Performance
        </button>
      </div>

      {subView === "attendance" && (
        <div className="table-wrap">
          <div className="table-header" style={{ paddingBottom: "1.5rem" }}>
            <div>
              <div className="table-title">Daily Attendance Logs</div>
              <div className="pos-sub">Mark stylist check-ins and check-outs</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} style={{ padding: "0.5rem 1rem", fontSize: "0.75rem" }} />
              <button className="btn-add" onClick={handleSaveAttendance} disabled={saving || !activeStaff.length}>
                {saving ? "Saving..." : "Save Daily Logs"}
              </button>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Stylist / Operator</th>
                <th>Status</th>
                <th>Check-in Time</th>
                <th>Check-out Time</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {activeStaff.map(s => {
                const log = attendanceLogs[s.id] || { status: "present", check_in: "09:00", check_out: "21:00", notes: "" };
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: "0.65rem", color: "#888" }}>{s.role || "Operator"}</div>
                    </td>
                    <td>
                      <select 
                        className="form-input" 
                        value={log.status} 
                        onChange={e => handleStatusChange(s.id, e.target.value)} 
                        style={{ 
                          fontSize: "0.7rem", 
                          padding: "0.3rem 0.6rem", 
                          width: "110px",
                          fontWeight: "600",
                          border: "1px solid",
                          borderColor: log.status === "present" ? "#2e7d32" : log.status === "late" ? "#f57f17" : log.status === "absent" ? "#b71c1c" : "#1976d2",
                          background: log.status === "present" ? "#e8f5e9" : log.status === "late" ? "#fff8e1" : log.status === "absent" ? "#fce4ec" : "#e3f2fd",
                          color: log.status === "present" ? "#2e7d32" : log.status === "late" ? "#f57f17" : log.status === "absent" ? "#b71c1c" : "#1976d2",
                        }}
                      >
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="absent">Absent</option>
                        <option value="leave">Leave</option>
                      </select>
                    </td>
                    <td>
                      <input 
                        type="time" 
                        className="form-input" 
                        value={log.check_in} 
                        onChange={e => handleFieldChange(s.id, "check_in", e.target.value)} 
                        disabled={log.status === "absent" || log.status === "leave"}
                        style={{ width: "95px", padding: "0.35rem 0.5rem", fontSize: "0.75rem", marginBottom: "2px" }} 
                      />
                      {log.check_in && log.status !== "absent" && log.status !== "leave" && (
                        <div style={{ fontSize: "0.6rem", color: "#c9b99a", textAlign: "center" }}>
                          {format12HourTime(log.check_in)}
                        </div>
                      )}
                    </td>
                    <td>
                      <input 
                        type="time" 
                        className="form-input" 
                        value={log.check_out} 
                        onChange={e => handleFieldChange(s.id, "check_out", e.target.value)} 
                        disabled={log.status === "absent" || log.status === "leave"}
                        style={{ width: "95px", padding: "0.35rem 0.5rem", fontSize: "0.75rem", marginBottom: "2px" }} 
                      />
                      {log.check_out && log.status !== "absent" && log.status !== "leave" && (
                        <div style={{ fontSize: "0.6rem", color: "#c9b99a", textAlign: "center" }}>
                          {format12HourTime(log.check_out)}
                        </div>
                      )}
                    </td>
                    <td>
                      <input 
                        type="text" 
                        placeholder="Daily logs/details..." 
                        className="form-input" 
                        value={log.notes} 
                        onChange={e => handleFieldChange(s.id, "notes", e.target.value)} 
                        style={{ padding: "0.35rem 0.75rem", fontSize: "0.72rem" }} 
                      />
                    </td>
                  </tr>
                );
              })}
              {!activeStaff.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                    No active staff in the Roster. Switch to the Staff Directory tab to add staff.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {subView === "roster" && (
        <div className="table-wrap">
          <div className="table-header">
            <div className="table-title">Stylist & Operator Roster ({staff.length})</div>
            <button className="btn-add" onClick={() => setStaffModal({ name: "", role: "Stylist", phone: "", active: true })}>
              <Plus size={14} style={{ marginRight: 6 }} /> Add Staff Member
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Operator</th>
                <th>Phone Number</th>
                <th>Designation Role</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                  </td>
                  <td>{s.phone || "—"}</td>
                  <td>
                    <span className="badge badge-gold" style={{ letterSpacing: "0.06em", padding: "2px 6px" }}>{s.role}</span>
                  </td>
                  <td>
                    <span className={`badge ${s.active ? "badge-active" : "badge-inactive"}`}>
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                      <button className="tbl-btn" onClick={() => setStaffModal(s)}>Edit</button>
                      <button className="tbl-btn danger" onClick={() => handleDeleteStaff(s.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!staff.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                    Roster is empty. Add your salon specialists to start tracking attendance.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {subView === "performance" && (
        <div className="table-wrap">
          <div className="table-header" style={{ paddingBottom: "1.5rem" }}>
            <div>
              <div className="table-title">Staff Performance Dashboard</div>
              <div className="pos-sub">Stylist analytics, work hours, overtime, and tip splits</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.7rem", color: "#888" }}>From:</span>
                <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: "0.4rem 0.75rem", fontSize: "0.75rem", width: "130px" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.7rem", color: "#888" }}>To:</span>
                <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: "0.4rem 0.75rem", fontSize: "0.75rem", width: "130px" }} />
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Stylist Name</th>
                <th>Designation</th>
                <th style={{ textAlign: "center" }}>Days Present</th>
                <th style={{ textAlign: "center" }}>Hours Worked</th>
                <th style={{ textAlign: "center" }}>Overtime Hours</th>
                <th style={{ textAlign: "center" }}>Services Done</th>
                <th style={{ textAlign: "center" }}>Customers Served</th>
                <th style={{ textAlign: "right" }}>Tips Earned</th>
              </tr>
            </thead>
            <tbody>
              {performanceData.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                  </td>
                  <td>
                    <span className="badge badge-gold" style={{ letterSpacing: "0.06em", padding: "2px 6px" }}>{p.role}</span>
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 600 }}>{p.daysPresent}</td>
                  <td style={{ textAlign: "center" }}>{p.totalHours} hrs</td>
                  <td style={{ textAlign: "center", color: p.totalOvertimeHours > 0 ? "#ff8a80" : "#888" }}>
                    {p.totalOvertimeHours > 0 ? `+${p.totalOvertimeHours} hrs` : "0 hrs"}
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 600 }}>{p.servicesCount}</td>
                  <td style={{ textAlign: "center" }}>{p.customersCount}</td>
                  <td style={{ textAlign: "right", fontWeight: "bold", color: "#c9b99a" }}>
                    Rs {p.tipsEarned.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
              {!performanceData.length && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                    No staff found to show performance data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {staffModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setStaffModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{staffModal.id ? "Edit Staff Details" : "Add Staff Member"}</div>
              <button className="modal-close" onClick={() => setStaffModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="staff-form" onSubmit={handleSaveStaff}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" value={staffModal.name || ""} onChange={e => setStaffModal({ ...staffModal, name: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Role Designation *</label>
                    <select className="form-input" value={staffModal.role || "Stylist"} onChange={e => setStaffModal({ ...staffModal, role: e.target.value })} required>
                      <option value="Senior Stylist">Senior Stylist</option>
                      <option value="Stylist">Stylist</option>
                      <option value="Junior Stylist">Junior Stylist</option>
                      <option value="Makeup Artist">Makeup Artist</option>
                      <option value="Nail Technician">Nail Technician</option>
                      <option value="Salon Manager">Salon Manager</option>
                      <option value="Receptionist">Receptionist</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input className="form-input" value={staffModal.phone || ""} onChange={e => setStaffModal({ ...staffModal, phone: e.target.value })} placeholder="+91 90000 00000" />
                  </div>
                </div>

                <div className="form-group" style={{ flexDirection: "row", gap: "0.5rem", alignItems: "center", marginTop: "1rem" }}>
                  <label className="toggle">
                    <input type="checkbox" checked={!!staffModal.active} onChange={e => setStaffModal({ ...staffModal, active: e.target.checked })} />
                    <span className="toggle-slider"></span>
                  </label>
                  <label className="form-label" style={{ margin: 0, cursor: "pointer" }}>
                    Active (Appears in daily attendance and POS operator list)
                  </label>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="tbl-btn" onClick={() => setStaffModal(null)}>Cancel</button>
              <button type="submit" form="staff-form" className="btn-add" disabled={saving}>{saving ? "Saving..." : "Save Member"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
