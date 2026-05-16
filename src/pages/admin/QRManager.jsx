import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";

export default function QRManager() {
  const [branchName, setBranchName] = useState("");
  const baseUrl = window.location.origin;

  const slug = branchName ? branchName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : "";
  const qrUrl = slug ? `${baseUrl}/menu/${slug}` : `${baseUrl}/menu`;

  const handleDownload = () => {
    const svg = document.getElementById("qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_Menu_${slug || "Default"}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
      toast.success("QR Code downloaded");
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 className="topbar-title" style={{ marginBottom: "1.5rem" }}>Digital Menu QR Generator</h2>
      
      <div className="qr-card">
        <div style={{ marginBottom: "1.5rem" }}>
          <label className="form-label" style={{ textAlign: "center" }}>Branch Name (Optional)</label>
          <input
            className="form-input"
            style={{ maxWidth: 300, margin: "0 auto", textAlign: "center" }}
            placeholder="e.g. Chennai Anna Nagar"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
          />
        </div>

        <div className="qr-frame">
          <QRCodeSVG
            id="qr-svg"
            value={qrUrl}
            size={200}
            level={"H"}
            includeMargin={false}
            fgColor={"#0d0d0d"}
            bgColor={"#ffffff"}
          />
        </div>
        
        <div className="qr-url">{qrUrl}</div>

        <div className="qr-actions">
          <button className="btn-add" onClick={handleDownload}>Download PNG</button>
          <button className="btn-outline" style={{ borderColor: "var(--a-border)", color: "var(--a-text)" }} onClick={() => window.open(qrUrl, "_blank")}>Preview</button>
        </div>

        <div className="qr-scan-count">
          <div className="qr-scan-label">Note</div>
          <div style={{ fontSize: "0.75rem", color: "var(--a-muted)" }}>
            Print this QR code and place it on salon mirrors or reception desks. Customers scanning it will see a mobile-optimized, fast-loading digital menu.
          </div>
        </div>
      </div>
    </div>
  );
}
