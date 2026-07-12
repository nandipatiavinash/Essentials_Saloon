import React, { useState, useEffect, useRef } from "react";

export default function SearchableStaffDropdown({ 
  staffList, 
  value, 
  onChange, 
  placeholder = "Select Staff", 
  isInvalid = false 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);

  // Filter staff by search term
  const activeStaff = (staffList || []).filter(s => s.active && s.name?.trim().toLowerCase() !== "other");
  const sortedStaff = [...activeStaff].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const filtered = sortedStaff.filter(s => {
    if (!search || search === value) return true;
    return (
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.role?.toLowerCase().includes(search.toLowerCase())
    );
  });

  useEffect(() => {
    // Sync search text with selected value
    if (value) {
      setSearch(value);
    } else {
      setSearch("");
    }
  }, [value, isOpen]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch(value || "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const handleSelect = (staffName) => {
    onChange(staffName);
    setSearch(staffName);
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      setFocusedIndex(prev => Math.min(prev + 1, filtered.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setFocusedIndex(prev => Math.max(prev - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (focusedIndex >= 0 && focusedIndex < filtered.length) {
        handleSelect(filtered[focusedIndex].name);
      } else if (filtered.length > 0) {
        handleSelect(filtered[0].name);
      }
      e.preventDefault();
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSearch(value || "");
      e.preventDefault();
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", zIndex: isOpen ? 1010 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
            setFocusedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            padding: "0.55rem 2rem 0.55rem 0.75rem",
            fontSize: "0.8rem",
            border: isInvalid ? "2px solid var(--a-red, #b71c1c)" : "1px solid var(--a-border, #e8e8e4)",
            background: "var(--a-bg, #f8f8f6)",
            color: "var(--a-text, #1a1a1a)",
            outline: "none",
            borderRadius: "0",
            transition: "border-color 0.2s"
          }}
        />
        <span 
          onClick={() => setIsOpen(!isOpen)}
          style={{ 
            position: "absolute", 
            right: "0.75rem", 
            cursor: "pointer", 
            fontSize: "0.5rem", 
            userSelect: "none",
            color: "var(--a-gold, #c9b99a)",
            pointerEvents: "auto"
          }}
        >
          {isOpen ? "▲" : "▼"}
        </span>
      </div>

      {isOpen && (
        <ul style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          zIndex: 1020,
          background: "var(--a-surface, #fff)",
          border: "1px solid var(--a-border, #e8e8e4)",
          borderTop: "none",
          maxHeight: "180px",
          overflowY: "auto",
          listStyle: "none",
          padding: 0,
          margin: 0,
          boxShadow: "0 6px 16px rgba(0,0,0,0.08)"
        }}>
          {filtered.length > 0 ? (
            filtered.map((staff, idx) => {
              const isSelected = value === staff.name;
              const isFocused = focusedIndex === idx;
              return (
                <li
                  key={staff.id}
                  onClick={() => handleSelect(staff.name)}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.72rem",
                    cursor: "pointer",
                    background: isSelected ? "rgba(201,185,154,0.15)" : isFocused ? "var(--a-bg, #f8f8f6)" : "transparent",
                    color: isSelected ? "var(--a-gold, #c9b99a)" : "var(--a-text, #1a1a1a)",
                    borderBottom: "1px solid var(--a-border, #e8e8e4)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <span style={{ fontWeight: isSelected ? "bold" : "normal" }}>{staff.name}</span>
                  <span style={{ fontSize: "0.6rem", color: "var(--a-muted, #666)" }}>{staff.role}</span>
                </li>
              );
            })
          ) : (
            <li style={{ padding: "0.5rem 0.75rem", fontSize: "0.72rem", color: "var(--a-faint, #999)", textAlign: "center" }}>
              No staff found
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
