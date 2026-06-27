import { useMemo, useState } from "react";
import { Search, UserCheck, Calendar, Clock, Plus, Trash2, Award, ClipboardList, TrendingUp } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { createStaff, updateStaff, deleteStaff, saveAttendance, format12HourTime, createAttendanceLog } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

// Helper: convert "HH:MM" (24hr) → { hour12, minute, ampm }
function parse24To12(time24) {
  if (!time24) return { hour12: "09", minute: "00", ampm: "AM" };
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { hour12: String(h).padStart(2, "0"), minute: m, ampm };
}

// Helper: convert { hour12, minute, ampm } → "HH:MM" (24hr for DB storage)
function format12To24(hour12, minute, ampm) {
  let h = parseInt(hour12, 10);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

// Custom 12-hour AM/PM time picker — no browser 24hr input
function TimePickerAMPM({ value, onChange, disabled }) {
  const { hour12, minute, ampm } = parse24To12(value);
  const hours = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  const minutes = ["00","05","10","15","20","25","30","35","40","45","50","55"];
  const selStyle = {
    padding: "0.28rem 0.3rem",
    fontSize: "0.72rem",
    border: "1px solid var(--a-border)",
    background: disabled ? "#f5f5f0" : "var(--a-bg)",
    color: disabled ? "#aaa" : "var(--a-text)",
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    outline: "none",
    borderRadius: "2px",
  };
  const handleChange = (field, val) => {
    const h = field === "h" ? val : hour12;
    const m = field === "m" ? val : minute;
    const p = field === "p" ? val : ampm;
    onChange(format12To24(h, m, p));
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
      <select disabled={disabled} style={selStyle} value={hour12} onChange={e => handleChange("h", e.target.value)}>
        {hours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--a-muted)" }}>:</span>
      <select disabled={disabled} style={selStyle} value={minute} onChange={e => handleChange("m", e.target.value)}>
        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select disabled={disabled} style={{ ...selStyle, fontWeight: 700, color: disabled ? "#aaa" : (ampm === "AM" ? "#1565c0" : "#b71c1c") }} value={ampm} onChange={e => handleChange("p", e.target.value)}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}


export default function AttendanceManager() {
  const { staff, attendance, attendanceActivityLogs, invoices, reload } = useAdmin();
  const navigate = useNavigate();
  const [subView, setSubView] = useState("attendance"); // attendance | roster | performance
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [staffModal, setStaffModal] = useState(null); // null | {} = add | {id...} = edit
  const [adjustModal, setAdjustModal] = useState(null); // null | { staff_id, date, check_in, check_out, staff_name }
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
        check_in: match?.check_in || null,
        check_out: match?.check_out || null,
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

  const handleSingleSave = async (staffId, updatedLog) => {
    setSaving(true);
    try {
      await saveAttendance([updatedLog]);
      toast.success("Attendance updated for operator.");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const logCheckIn = async (staffId) => {
    // Use the operator-entered check_in time if already set, otherwise use current time
    const currentLog = attendanceLogs[staffId] || { staff_id: staffId, date: date, notes: "", status: "present", check_in: null, check_out: null };
    const now = new Date();
    const time24 = currentLog.check_in ||
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const log = {
      ...currentLog,
      check_in: time24,
      status: "present"
    };
    setAttendanceLogs(prev => ({ ...prev, [staffId]: log }));
    await handleSingleSave(staffId, log);

    // Create activity log
    const staffName = (staff || []).find(st => st.id === staffId)?.name || "Staff";
    try {
      await createAttendanceLog({
        staff_id: staffId,
        date: date,
        action_type: "check_in",
        details: `${staffName} checked in at ${format12HourTime(time24)}`
      });
    } catch (err) {
      console.error("Log error:", err);
    }
    reload();
  };

  const logCheckOut = async (staffId) => {
    const log = attendanceLogs[staffId] || { staff_id: staffId, date: date, notes: "", status: "present", check_in: null, check_out: null };
    // Use operator-entered check_out time if already set, otherwise use current time
    const now = new Date();
    const time24 = log.check_out ||
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    if (log.check_in) {
      const [inH, inM] = log.check_in.split(":").map(Number);
      const [outH, outM] = time24.split(":").map(Number);
      if (outH * 60 + outM <= inH * 60 + inM) {
        toast.error("Check-out time cannot be earlier than or equal to check-in time.");
        return;
      }
    }

    const updatedLog = {
      ...log,
      check_out: time24
    };
    setAttendanceLogs(prev => ({ ...prev, [staffId]: updatedLog }));
    await handleSingleSave(staffId, updatedLog);

    // Create activity log
    const staffName = (staff || []).find(st => st.id === staffId)?.name || "Staff";
    try {
      await createAttendanceLog({
        staff_id: staffId,
        date: date,
        action_type: "check_out",
        details: `${staffName} checked out at ${format12HourTime(time24)}`
      });
    } catch (err) {
      console.error("Log error:", err);
    }
    reload();
  };

  const dailyLogs = useMemo(() => {
    return (attendanceActivityLogs || [])
      .filter(l => l.date === date)
      .sort((a, b) => new Date(b.created_at || b.timestamp).getTime() - new Date(a.created_at || a.timestamp).getTime());
  }, [attendanceActivityLogs, date]);

  const handleOpenAdjustModal = (l) => {
    const sId = l.staff_id;
    const logDate = l.date || date;
    const currentLog = attendanceLogs[sId] || { check_in: null, check_out: null, status: "present" };
    const sName = (staff || []).find(st => st.id === sId)?.name || "Staff";
    
    setAdjustModal({
      staff_id: sId,
      date: logDate,
      staff_name: sName,
      check_in: currentLog.check_in || "09:00",
      check_out: currentLog.check_out || "21:00",
      status: currentLog.status || "present"
    });
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { staff_id, date: logDate, check_in, check_out, staff_name, status } = adjustModal;
      
      if (check_in && check_out) {
        const [inH, inM] = check_in.split(":").map(Number);
        const [outH, outM] = check_out.split(":").map(Number);
        if (outH * 60 + outM <= inH * 60 + inM) {
          toast.error("Check-out time must be later than check-in time.");
          setSaving(false);
          return;
        }
      }
      
      const record = {
        staff_id,
        date: logDate,
        status,
        check_in,
        check_out,
        notes: attendanceLogs[staff_id]?.notes || ""
      };
      
      await saveAttendance([record]);
      await createAttendanceLog({
        staff_id,
        date: logDate,
        action_type: "adjustment",
        details: `Manager adjusted ${staff_name}'s time: In ${format12HourTime(check_in)} / Out ${format12HourTime(check_out)}`
      });
      
      toast.success(`Adjusted attendance times for ${staff_name}`);
      setAdjustModal(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to adjust times");
    } finally {
      setSaving(false);
    }
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
          if (item.item_type === "membership") return;
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
        <>
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
                <th>Daily Notes</th>
                <th style={{ textAlign: "center" }}>Actions</th>
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
                        value={log.check_in || ""}
                        onChange={e => handleFieldChange(s.id, "check_in", e.target.value)}
                        disabled={log.status === "absent" || log.status === "leave" || saving}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        className="form-input"
                        value={log.check_out || ""}
                        onChange={e => handleFieldChange(s.id, "check_out", e.target.value)}
                        disabled={!log.check_in || log.status === "absent" || log.status === "leave" || saving}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="tbl-btn danger"
                        style={{ padding: "0.3rem 0.5rem", fontSize: "0.65rem" }}
                        onClick={() => {
                          // Clear the attendance entry for this staff on this date
                          handleFieldChange(s.id, "check_in", null);
                          handleFieldChange(s.id, "check_out", null);
                          handleStatusChange(s.id, "absent");
                        }}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </td>

                    <td>
                      <input
                        type="text"
                        placeholder="Notes..."
                        className="form-input"
                        value={log.notes || ""}
                        onChange={e => handleFieldChange(s.id, "notes", e.target.value)}
                        style={{ padding: "0.35rem 0.6rem", fontSize: "0.72rem", minWidth: "80px" }}
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

        {/* Activity Logs Section */}
        <div style={{ marginTop: "2rem", borderTop: "1px solid var(--a-border)", paddingTop: "1.5rem" }}>
          <div className="table-title" style={{ fontSize: "1rem", marginBottom: "0.25rem" }}>Operator Activity Logs</div>
          <div className="pos-sub" style={{ marginBottom: "1rem" }}>Chronological log of check-ins, check-outs, and time adjustments</div>
          <div style={{ background: "var(--a-bg-muted, #fafafa)", border: "1px solid var(--a-border)", borderRadius: "4px", padding: "1rem", maxHeight: "250px", overflowY: "auto" }}>
            {dailyLogs.length === 0 ? (
              <div style={{ color: "var(--a-muted)", fontSize: "0.72rem", textAlign: "center", padding: "1rem" }}>
                No activities logged for today.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {dailyLogs.map(l => {
                  const lStaff = (staff || []).find(st => st.id === l.staff_id);
                  const timeStr = new Date(l.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
                  return (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", padding: "0.35rem 0.5rem", borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                      <div>
                        <span style={{ color: "var(--a-muted)", fontWeight: 600, marginRight: "0.5rem" }}>{timeStr}</span>
                        <span style={{ color: "var(--a-text)" }}>{l.details}</span>
                      </div>
                      <button
                        type="button"
                        className="tbl-btn"
                        style={{ padding: "0.2rem 0.4rem", fontSize: "0.65rem" }}
                        onClick={() => handleOpenAdjustModal(l)}
                      >
                        Adjust Time
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </>
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
                    <button
                      className="tbl-btn"
                      style={{ fontWeight: 700, background: "none", border: "none", cursor: "pointer", color: "var(--a-text)", padding: 0, textAlign: "left" }}
                      onClick={() => navigate(`/staff/${s.id}`)}
                    >
                      {s.name}
                    </button>
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
                    <button
                      className="tbl-btn"
                      style={{ fontWeight: 700, background: "none", border: "none", cursor: "pointer", color: "var(--a-text)", padding: 0, textAlign: "left" }}
                      onClick={() => navigate(`/staff/${p.id}`)}
                    >
                      {p.name}
                    </button>
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
                  <td style={{ textAlign: "right", fontWeight: "bold", color: "var(--a-text)" }}>
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

      {adjustModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAdjustModal(null)}>
          <div className="modal" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <div className="modal-title">Adjust Time: {adjustModal.staff_name}</div>
              <button className="modal-close" onClick={() => setAdjustModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="adjust-form" onSubmit={handleSaveAdjustment}>
                <div style={{ fontSize: "0.72rem", color: "var(--a-muted)", marginBottom: "1rem" }}>
                  Adjusting attendance times for <strong>{adjustModal.date}</strong>.
                </div>
                
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" style={{ marginBottom: "0.5rem" }}>Check-in Time</label>
                  <TimePickerAMPM
                    value={adjustModal.check_in}
                    onChange={val => setAdjustModal(prev => ({ ...prev, check_in: val }))}
                  />
                </div>
                
                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                  <label className="form-label" style={{ marginBottom: "0.5rem" }}>Check-out Time</label>
                  <TimePickerAMPM
                    value={adjustModal.check_out}
                    onChange={val => setAdjustModal(prev => ({ ...prev, check_out: val }))}
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="tbl-btn" onClick={() => setAdjustModal(null)}>Cancel</button>
              <button type="submit" form="adjust-form" className="btn-add" disabled={saving}>
                {saving ? "Saving..." : "Save Adjustments"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
