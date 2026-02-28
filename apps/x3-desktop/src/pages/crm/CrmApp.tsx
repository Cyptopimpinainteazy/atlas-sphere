import React, { useEffect } from "react";
import { useSocialStore } from "@/stores/socialStore";
import { useNavigate } from "react-router-dom";
import CrmShell from "./CrmShell";
import "@/styles/crm.css";

const CrmApp: React.FC = () => {
  const { isLoggedIn, restoreSession } = useSocialStore();
  const navigate = useNavigate();

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/social");
    }
  }, [isLoggedIn, navigate]);

  if (!isLoggedIn) return null;
  return <CrmShell />;
};

export default CrmApp;
