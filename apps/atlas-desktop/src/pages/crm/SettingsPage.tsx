import React, { useEffect, useState } from "react";
import { useCrmStore } from "@/stores/crmStore";
import type { SaveSmtpConfigInput } from "@/stores/crmStore";

const SettingsPage: React.FC = () => {
  const { smtpConfig, loadSmtpConfig, saveSmtpConfig, loading, error } = useCrmStore();
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const [form, setForm] = useState<SaveSmtpConfigInput>({
    host: "", port: 587, username: "", password: "",
    fromName: "", fromEmail: "", useTls: true,
  });

  useEffect(() => { loadSmtpConfig(); }, [loadSmtpConfig]);

  useEffect(() => {
    if (smtpConfig) {
      setForm({
        host: smtpConfig.host,
        port: smtpConfig.port,
        username: smtpConfig.username,
        password: "", // never sent back
        fromName: smtpConfig.fromName,
        fromEmail: smtpConfig.fromEmail,
        useTls: smtpConfig.useTls,
      });
    }
  }, [smtpConfig]);

  const handleSave = async () => {
    if (!form.host || !form.username || !form.fromEmail) return;
    setSaved(false);
    await saveSmtpConfig(form);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleTest = async () => {
    if (!smtpConfig) {
      setTestStatus("Save SMTP config first");
      return;
    }
    setTestStatus("Sending test email...");
    try {
      const { sendEmail } = useCrmStore.getState();
      await sendEmail({
        toEmail: form.fromEmail,
        subject: "Atlas CRM — SMTP Test",
        body: "<h2>SMTP Test</h2><p>If you received this email, your SMTP configuration is working correctly!</p>",
      });
      setTestStatus("✅ Test email sent! Check your inbox.");
    } catch (err: any) {
      setTestStatus(`❌ Failed: ${err}`);
    }
  };

  return (
    <div className="crm-page">
      <div className="crm-page-header">
        <h1>Settings</h1>
      </div>

      {/* SMTP Configuration */}
      <div className="crm-card" style={{ maxWidth: 600 }}>
        <h2>📧 SMTP Email Server</h2>
        <p className="crm-help-text">
          Configure your outgoing email server for sending emails from the CRM. 
          Common providers: Gmail (smtp.gmail.com:587), Outlook (smtp-mail.outlook.com:587), 
          SendGrid (smtp.sendgrid.net:587).
        </p>

        {saved && <div className="crm-success-banner">✅ SMTP settings saved!</div>}
        {error && <div className="crm-error-banner">❌ {error}</div>}

        <div className="crm-form">
          <div className="crm-form-row">
            <div style={{ flex: 2 }}>
              <label>SMTP Host *</label>
              <input
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>Port</label>
              <input
                type="number"
                value={form.port ?? 587}
                onChange={(e) => setForm({ ...form, port: +e.target.value })}
              />
            </div>
          </div>

          <div className="crm-form-row">
            <div>
              <label>Username *</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label>Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={smtpConfig ? "••••••••" : "App password"}
              />
            </div>
          </div>

          <div className="crm-form-row">
            <div>
              <label>From Name</label>
              <input
                value={form.fromName}
                onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                placeholder="Atlas CRM"
              />
            </div>
            <div>
              <label>From Email *</label>
              <input
                type="email"
                value={form.fromEmail}
                onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                placeholder="noreply@yourdomain.com"
              />
            </div>
          </div>

          <label className="crm-checkbox-row">
            <input
              type="checkbox"
              checked={form.useTls ?? true}
              onChange={(e) => setForm({ ...form, useTls: e.target.checked })}
            />
            Use TLS (recommended)
          </label>

          <div className="crm-form-actions">
            <button className="crm-btn" onClick={handleTest}>🧪 Send Test Email</button>
            <div style={{ flex: 1 }} />
            <button className="crm-btn primary" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "💾 Save Settings"}
            </button>
          </div>

          {testStatus && (
            <div className="crm-info-banner" style={{ marginTop: 12 }}>{testStatus}</div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="crm-card" style={{ maxWidth: 600, marginTop: 16 }}>
        <h2>ℹ️ About Atlas CRM</h2>
        <p className="crm-help-text">
          Atlas CRM is a built-in contact and calendar management system. 
          Manage contacts, track deals through your pipeline, schedule events, 
          and send emails — all from your Atlas Desktop.
        </p>
        <ul className="crm-feature-list">
          <li>👥 Contact management with stages and priorities</li>
          <li>📅 Full calendar with event types and reminders</li>
          <li>💰 Deal pipeline with kanban board view</li>
          <li>✉️ SMTP email with templates</li>
          <li>📊 Activity tracking and statistics</li>
        </ul>
      </div>
    </div>
  );
};

export default SettingsPage;
