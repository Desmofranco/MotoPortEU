import React from "react";
import { useNavigate } from "react-router-dom";

export default function BackButton({ to = null, label = "Indietro" }) {
  const navigate = useNavigate();

  const goBack = () => {
    if (to) navigate(to);
    else navigate(-1);
  };

  return (
    <button
      onClick={goBack}
      className="rounded-xl bg-white/10 border border-white/15 text-white px-4 py-2"
    >
      ← {label}
    </button>
  );
}