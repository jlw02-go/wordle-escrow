// pages/HomePage.tsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const DEFAULT_GROUP_ID = "main"; // change if you prefer a different id

export default function HomePage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/group/${DEFAULT_GROUP_ID}`, { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Loading…</p>
    </div>
  );
}
