import { useMemo, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { importHistoricalInvoices } from "../../lib/api";
import { useAdmin } from "../../layouts/AdminLayout";

const fields = [
  ["client_name", "Client Name"],
  ["mobile", "Mobile Number"],
  ["service_name", "Service Name"],
  ["quantity", "Quantity"],
  ["price", "Price"],
  ["total", "Total Amount"],
  ["discount", "Discount"],
  ["tax_rate", "GST/Tax Rate"],
  ["payment_method", "Payment Method"],
  ["transaction_id", "Transaction ID"],
  ["invoice_number", "Invoice Number"],
  ["billing_at", "Billing Date"],
  ["staff_name", "Staff Name"],
  ["notes", "Notes"],
];

export default function ImportSales() {
  const { reload } = useAdmin();
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const preview = useMemo(() => rows.slice(0, 8).map((row) => normalizeMappedRow(row, mapping)), [rows, mapping]);
  const validRows = useMemo(() => rows.map((row) => normalizeMappedRow(row, mapping)).filter((row) => row.client_name && row.mobile && (row.total || row.price)), [rows, mapping]);

  const handleFile = async (inputFile) => {
    setFile(inputFile);
    setResult(null);
    try {
      const parsed = await parseSpreadsheet(inputFile);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMap(parsed.headers));
      toast.success(`${parsed.rows.length} rows ready for preview`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const runImport = async () => {
    setImporting(true);
    try {
      const importResult = await importHistoricalInvoices(validRows, {
        file_name: file?.name,
        file_type: file?.name?.split(".").pop(),
        mapping,
      });
      setResult(importResult);
      toast.success(`Imported ${importResult.inserted} invoices`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="import-hero">
        <div>
          <div className="table-title"><FileSpreadsheet size={15} /> Historical Sales Import</div>
          <div className="pos-sub">Upload CSV, TSV, or Excel exports, map columns, validate rows, and merge them into analytics.</div>
        </div>
        <label className="btn-add upload-btn">
          <Upload size={14} /> Upload File
          <input type="file" accept=".csv,.tsv,.txt,.xls,.xlsx" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
      </div>

      <div className="import-grid">
        <div className="table-wrap">
          <div className="table-header">
            <div>
              <div className="table-title">Column Mapping</div>
              <div className="pos-sub">{file?.name || "No file selected"}</div>
            </div>
          </div>
          <div className="mapping-list">
            {fields.map(([field, label]) => (
              <div className="mapping-row" key={field}>
                <span>{label}</span>
                <select className="form-input" value={mapping[field] || ""} onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}>
                  <option value="">Ignore / not available</option>
                  {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </select>
              </div>
            ))}
            {!headers.length && <div className="admin-empty compact">Upload a file to start mapping.</div>}
          </div>
        </div>

        <div className="table-wrap">
          <div className="table-header">
            <div>
              <div className="table-title">Import Preview</div>
              <div className="pos-sub">{validRows.length} valid rows from {rows.length} total</div>
            </div>
            <button className="btn-add" disabled={!validRows.length || importing} onClick={runImport}>{importing ? "Importing..." : "Confirm Import"}</button>
          </div>
          <div className="preview-table">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Phone</th>
                  <th>Service</th>
                  <th>Total</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index}>
                    <td>{row.client_name || "Missing"}</td>
                    <td>{row.mobile || "Invalid"}</td>
                    <td>{row.service_name || "Imported service"}</td>
                    <td>Rs {Number(row.total || row.price || 0).toLocaleString("en-IN")}</td>
                    <td>{row.billing_at ? new Date(row.billing_at).toLocaleDateString("en-IN") : "Today"}</td>
                  </tr>
                ))}
                {!preview.length && <tr><td colSpan="5" style={{ textAlign: "center", padding: "2rem", color: "var(--a-faint)" }}>Preview rows appear here.</td></tr>}
              </tbody>
            </table>
          </div>
          {result && (
            <div className="import-result">
              <strong>{result.inserted}</strong> inserted · <strong>{result.skipped}</strong> skipped duplicates · <strong>{result.errors.length}</strong> errors
            </div>
          )}
        </div>
      </div>
    </>
  );
}

async function parseSpreadsheet(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "xlsx") {
    try {
      const xlsxPackage = "xlsx";
      const XLSX = await import(/* @vite-ignore */ xlsxPackage);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      return { headers: Object.keys(rows[0] || {}), rows };
    } catch {
      throw new Error("XLSX parsing needs the optional xlsx package. Export as CSV or install xlsx for native Excel imports.");
    }
  }
  const text = await file.text();
  const delimiter = ext === "tsv" ? "\t" : detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const headers = splitLine(lines[0], delimiter).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const values = splitLine(line, delimiter);
    return headers.reduce((acc, header, index) => ({ ...acc, [header]: values[index]?.trim() || "" }), {});
  });
  return { headers, rows };
}

function autoMap(headers) {
  const normalized = Object.fromEntries(headers.map((header) => [clean(header), header]));
  const find = (...names) => names.map(clean).map((name) => normalized[name]).find(Boolean) || "";
  return {
    client_name: find("client name", "customer name", "name"),
    mobile: find("mobile", "phone", "phone number", "contact"),
    service_name: find("service", "service name", "item"),
    quantity: find("qty", "quantity"),
    price: find("price", "rate", "service price"),
    total: find("total", "amount", "total amount", "bill amount"),
    discount: find("discount"),
    tax_rate: find("gst", "tax", "tax rate"),
    payment_method: find("payment", "payment method", "mode"),
    transaction_id: find("txn id", "transaction id", "upi id", "reference"),
    invoice_number: find("invoice", "invoice number", "bill no"),
    billing_at: find("date", "billing date", "created at"),
    staff_name: find("staff", "operator", "stylist"),
    notes: find("notes", "remarks"),
  };
}

function normalizeMappedRow(row, mapping) {
  const get = (field) => row[mapping[field]] ?? "";
  return {
    client_name: String(get("client_name")).trim(),
    mobile: String(get("mobile")).replace(/\D/g, "").slice(-10),
    service_name: String(get("service_name") || "Imported service").trim(),
    quantity: Number(get("quantity") || 1),
    price: money(get("price") || get("total")),
    total: money(get("total") || get("price")),
    discount: money(get("discount")),
    tax_rate: Number(String(get("tax_rate")).replace(/[^\d.]/g, "") || 0),
    payment_method: normalizePayment(get("payment_method")),
    transaction_id: String(get("transaction_id")).trim(),
    invoice_number: String(get("invoice_number")).trim(),
    billing_at: normalizeDate(get("billing_at")),
    staff_name: String(get("staff_name")).trim(),
    notes: String(get("notes")).trim(),
  };
}

function splitLine(line, delimiter) {
  const out = [];
  let value = "";
  let quoted = false;
  for (const char of line) {
    if (char === "\"") quoted = !quoted;
    else if (char === delimiter && !quoted) {
      out.push(value);
      value = "";
    } else value += char;
  }
  out.push(value);
  return out.map((item) => item.replace(/^"|"$/g, ""));
}

function detectDelimiter(text) {
  const first = text.split(/\r?\n/)[0] || "";
  return first.includes("\t") ? "\t" : ",";
}

function clean(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function money(value) {
  return Number(String(value || "0").replace(/[^\d.-]/g, "")) || 0;
}

function normalizeDate(value) {
  if (!value) return new Date().toISOString();
  if (typeof value === "number") return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  const parts = String(value).match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (parts) {
    const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
    return new Date(`${year}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`).toISOString();
  }
  return new Date().toISOString();
}

function normalizePayment(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("upi")) return "UPI";
  if (v.includes("card")) return "Card";
  if (v.includes("bank") || v.includes("transfer")) return "Bank Transfer";
  return "Cash";
}
