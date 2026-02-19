"use client";

import { CONFIG } from "../../config";
import { useState } from "react";
import { getArrayMergePullURL } from "../../lib/array/array";
import { callArrayMergePull } from "../../lib/array/arrayclient";


export default function Home() {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [responseMsg, setResponseMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = getArrayMergePullURL(userName, password);
      setResponseMsg("Request URL: " + url);
      const result = await callArrayMergePull(url);
      let jsonResult;
      try {
        jsonResult = JSON.parse(result);
        setResponseMsg(prev => prev + "\nSuccess: " + result); // Print raw JSON string
      } catch {
        setResponseMsg(prev => prev + "\nSuccess: " + result);
      }
    } catch (error) {
      setResponseMsg(prev => prev + "\nError: " + error);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "2rem auto", padding: 24, border: "1px solid #eee", borderRadius: 8 }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label>
          UserName:
          <input
            type="text"
            value={userName}
            onChange={e => setUserName(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          Password:
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <button type="submit" style={{ padding: 10, background: "#0070f3", color: "#fff", border: "none", borderRadius: 4 }}>
          Submit
        </button>
      </form>
      <div style={{ marginTop: 24, fontSize: 14, color: "#555" }}>
        <div><strong>URL:</strong> {CONFIG.URL}</div>
        <div><strong>ArraySecret:</strong> {CONFIG.ArraySecret}</div>
        {responseMsg && (
          <div style={{ marginTop: 16, padding: 12, background: "#f9f9f9", borderRadius: 6, color: responseMsg.includes("Error") ? "#d32f2f" : "#388e3c", whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
            {responseMsg}
          </div>
        )}
      </div>
    </div>
  );
}

