"use client";
import { useState, useEffect, useRef } from "react";

export default function AutocompletePage() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ id: string; text: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autcomplete-test?query=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setSuggestions(data);
        setShowDropdown(true);
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      }
    }, 10);
  }, [query]);

  return (
    <div style={{ minWidth: 600, maxWidth: 600, margin: "50px auto", fontFamily: "sans-serif" }}>
      <h2>Autocomplete Search</h2>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        onFocus={() => query && setShowDropdown(true)}
        placeholder="Search..."
        style={{
          width: "100%",
          padding: "12px",
          fontSize: "16px",
          border: "1px solid #ccc",
          borderRadius: "4px",
        }}
      />

      {showDropdown && suggestions.length > 0 && (
        <ul
          style={{
            marginTop: "4px",
            padding: 0,
            listStyle: "none",
            border: "1px solid #ccc",
            borderRadius: "4px",
            background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {suggestions.map((item) => (
            <li
              key={item.id}
              style={{
                padding: "10px",
                borderBottom: "1px solid #eee",
                cursor: "pointer",
              }}
              onMouseDown={() => {
                setQuery(item.text);
                setShowDropdown(false);
              }}
            >
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
