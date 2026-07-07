import { useMemo, useState, useEffect } from "react";
import { Search, UserCheck, Calendar, Clock, Plus, Trash2, Award, ClipboardList, TrendingUp, ArrowRight } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { saveAttendance, format12HourTime, createAttendanceLog } from "../../lib/api";
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
  const { staff, attendance, attendanceActivityLogs, reload } = useAdmin();
  const navigate = useNavigate();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [adjustModal, setAdjustModal] = useState(null); // null | { id, staff_id, staff_name, date, check_in, check_out }
  const [notesInputState, setNotesInputState] = useState({});

  // Filter active staff only
  const activeStaff = useMemo(() => (staff || []).filter(s => s.active), [staff]);

  // Daily attendance state mapping
  const [attState, setAttState] = useState({});

  useEffect(() => {
    const dailyLogsForDate = (attendance || []).filter(a => a.date === date);
    const stateMap = {};
    activeStaff.forEach(s => {
      const log = dailyLogsForDate.find(a => a.staff_id === s.id);
      stateMap[s.id] = log 
        ? { id: log.id, status: log.status, check_in: log.check_in, check_out: log.check_out, notes: log.notes || "" }
        : { status: "absent", check_in: null, check_out: null, notes: "" };
    });
    setAttState(stateMap);
  }, [date, attendance, activeStaff]);

  useEffect(() => {
    setNotesInputState({});
  }, [date]);

  const updateSingleAttendance = async (staffId, status, checkIn, checkOut, notes, logMessage) => {
    setSaving(true);
    try {
      const staffName = (staff || []).find(s => s.id === staffId)?.name || "Staff";
      await saveAttendance(date, [{
        staff_id: staffId,
        date,
        status,
        check_in: checkIn,
        check_out: checkOut,
        notes: notes || null
      }]);
      if (logMessage) {
        await createAttendanceLog({
          date,
          details: logMessage
        });
      }
      toast.success(`Attendance updated for ${staffName}!`);
      reload();
    } catch (err) {
      toast.error("Failed to save changes: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (staffId, field, value) => {
    setAttState(prev => {
      const current = prev[staffId] || { status: "absent", check_in: null, check_out: null, notes: "" };
      return {
        ...prev,
        [staffId]: { ...current, [field]: value }
      };
    });
  };

  const handleSaveAttendance = async () => {
    setSaving(true);
    try {
      const records = Object.entries(attState).map(([staffId, val]) => {
        const staffName = (staff || []).find(s => s.id === staffId)?.name || "Staff";
        return {
          staff_id: staffId,
          staff_name: staffName,
          date,
          status: val.status,
          check_in: val.check_in,
          check_out: val.check_out,
          notes: val.notes
        };
      });

      // Call API helper to upsert daily roster attendance
      await saveAttendance(date, records);
      
      // Auto-log activity trail
      await createAttendanceLog({
        date,
        details: `Daily attendance logs saved for ${date}. Total Present: ${records.filter(r => r.status === "present" || r.status === "late").length}/${records.length}`
      });

      toast.success("Attendance logs saved successfully!");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to save daily roster logs");
    } finally {
      setSaving(false);
    }
  };

  // Activity adjust modal handlers
  const handleOpenAdjustModal = (log) => {
    const sName = (staff || []).find(st => st.id === log.staff_id)?.name || "Stylist";
    const dailyLog = (attendance || []).find(a => a.staff_id === log.staff_id && a.date === date);
    if (!dailyLog) {
      toast.error("Please mark status as Present first before adjusting times");
      return;
    }
    setAdjustModal({
      id: dailyLog.id,
      staff_id: log.staff_id,
      staff_name: sName,
      date,
      check_in: dailyLog.check_in || "09:00",
      check_out: dailyLog.check_out || "21:00"
    });
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveAttendance(date, [{
        staff_id: adjustModal.staff_id,
        date: adjustModal.date,
        check_in: adjustModal.check_in,
        check_out: adjustModal.check_out,
        status: "present"
      }]);
      
      await createAttendanceLog({
        date,
        details: `Adjusted check-in/out times for ${adjustModal.staff_name} on ${date}.`
      });

      toast.success("Attendance times adjusted!");
      setAdjustModal(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Adjustment failed");
    } finally {
      setSaving(false);
    }
  };

  const dailyLogs = useMemo(() => {
    return (attendanceActivityLogs || []).filter(l => l.date === date);
  }, [attendanceActivityLogs, date]);

  const logCheckIn = async (staffId) => {
    try {
      const current = attState[staffId] || { status: "absent", check_in: null, check_out: null, notes: "" };
      const nowTime = new Date().toLocaleTimeString("en-US", { hour12: false }).slice(0, 5);
      const staffName = (staff || []).find(s => s.id === staffId)?.name || "Staff";
      await saveAttendance(date, [{
        staff_id: staffId,
        date,
        status: "present",
        check_in: nowTime,
        check_out: current.check_out || "21:00",
        notes: current.notes || null
      }]);
      await createAttendanceLog({
        date,
        details: `${staffName} checked in at ${format12HourTime(nowTime)}`
      });
      toast.success("Checked in!");
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const logCheckOut = async (staffId) => {
    try {
      const current = attState[staffId] || { status: "absent", check_in: null, check_out: null, notes: "" };
      const nowTime = new Date().toLocaleTimeString("en-US", { hour12: false }).slice(0, 5);
      const staffName = (staff || []).find(s => s.id === staffId)?.name || "Staff";
      await saveAttendance(date, [{
        staff_id: staffId,
        date,
        status: "present",
        check_in: current.check_in || "09:00",
        check_out: nowTime,
        notes: current.notes || null
      }]);
      await createAttendanceLog({
        date,
        details: `${staffName} checked out at ${format12HourTime(nowTime)}`
      });
      toast.success("Checked out!");
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>📅 Attendance Logger</div>
          <div style={{ fontSize: "0.75rem", color: "#666" }}>Track daily operator check-ins and check-outs</div>
        </div>
        <button className="tbl-btn" onClick={() => navigate("/staff-management")} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          Go to Staff Directory & Payroll <ArrowRight size={14} />
        </button>
      </div>

      <div className="table-wrap">
        <div className="table-header" style={{ paddingBottom: "1.5rem" }}>
          <div>
            <div className="table-title">Daily Attendance Logs</div>
            <div className="pos-sub">Mark stylist check-ins and check-outs (all changes save automatically)</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} style={{ padding: "0.5rem 1rem", fontSize: "0.75rem" }} />
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
              const log = attState[s.id] || { status: "absent", check_in: null, check_out: null, notes: "" };
              const isPresent = log.status === "present" || log.status === "late";
              return (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>
                    <select
                      className="form-input"
                      value={log.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        let check_in = log.check_in;
                        let check_out = log.check_out;
                        if (newStatus === "present" || newStatus === "late") {
                          if (!check_in) check_in = "09:00";
                          if (!check_out) check_out = "21:00";
                        } else {
                          check_in = null;
                          check_out = null;
                        }
                        await updateSingleAttendance(s.id, newStatus, check_in, check_out, log.notes);
                      }}
                      style={{ padding: "0.35rem 0.5rem", fontSize: "0.75rem", width: "120px" }}
                      disabled={saving}
                    >
                      <option value="absent">Absent</option>
                      <option value="present">Present</option>
                      <option value="late">Late Check-in</option>
                      <option value="leave">On Leave</option>
                    </select>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <TimePickerAMPM
                        disabled={!isPresent || saving}
                        value={log.check_in || "09:00"}
                        onChange={async (val) => {
                          const staffName = (staff || []).find(st => st.id === s.id)?.name || "Staff";
                          await updateSingleAttendance(
                            s.id, 
                            log.status, 
                            val, 
                            log.check_out, 
                            log.notes,
                            `Adjusted check-in time for ${staffName} to ${format12HourTime(val)}`
                          );
                        }}
                      />
                      {isPresent && (
                        <button type="button" className="tbl-btn" onClick={() => logCheckIn(s.id)} style={{ padding: "0.3rem 0.5rem", fontSize: "0.65rem", background: "rgba(201,185,154,0.15)", color: "#c9b99a", border: "1px solid #c9b99a", fontWeight: "bold" }}>In</button>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <TimePickerAMPM
                        disabled={!isPresent || saving}
                        value={log.check_out || "21:00"}
                        onChange={async (val) => {
                          const staffName = (staff || []).find(st => st.id === s.id)?.name || "Staff";
                          await updateSingleAttendance(
                            s.id, 
                            log.status, 
                            log.check_in, 
                            val, 
                            log.notes,
                            `Adjusted check-out time for ${staffName} to ${format12HourTime(val)}`
                          );
                        }}
                      />
                      {isPresent && (
                        <button type="button" className="tbl-btn" onClick={() => logCheckOut(s.id)} style={{ padding: "0.3rem 0.5rem", fontSize: "0.65rem", background: "rgba(0,0,0,0.05)", color: "#000", border: "1px solid #ccc", fontWeight: "bold" }}>Out</button>
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="Notes..."
                      className="form-input"
                      value={notesInputState[s.id] !== undefined ? notesInputState[s.id] : log.notes || ""}
                      onChange={e => {
                        const val = e.target.value;
                        setNotesInputState(prev => ({ ...prev, [s.id]: val }));
                      }}
                      onBlur={async () => {
                        const val = notesInputState[s.id] !== undefined ? notesInputState[s.id] : log.notes || "";
                        await updateSingleAttendance(s.id, log.status, log.check_in, log.check_out, val);
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          e.target.blur();
                        }
                      }}
                      style={{ padding: "0.35rem 0.6rem", fontSize: "0.72rem", minWidth: "120px" }}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      className="tbl-btn danger"
                      style={{ padding: "0.3rem 0.6rem", fontSize: "0.65rem" }}
                      title="Reset attendance for today"
                      onClick={async () => {
                        const staffName = (staff || []).find(st => st.id === s.id)?.name || "Staff";
                        await updateSingleAttendance(
                          s.id, 
                          "absent", 
                          null, 
                          null, 
                          "",
                          `Reset/cleared daily logs for ${staffName}`
                        );
                        setNotesInputState(prev => ({ ...prev, [s.id]: "" }));
                      }}
                      disabled={saving}
                    >
                      Reset
                    </button>
                  </td>
                </tr>
              );
            })}
            {!activeStaff.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                  No active staff in the Roster. Set up staff profiles in Staff & Payroll.
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
