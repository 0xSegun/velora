"use client";

import { useState } from "react";
import { MESSAGES, toast } from "@/lib/feedback";
import { useUserProfileStore } from "@/store/settingsStore";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Building2,
  Globe,
  Lock,
  Shield,
  Bell,
  Palette,
  FileDown,
  Save,
  Camera,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { COUNTRY_DIRECTORY } from "@/lib/countries";
import { CountryFlag } from "@/components/ui/CountryFlag";
import ToggleSwitch from "@/components/ui/ToggleSwitch";

const countries = COUNTRY_DIRECTORY;

function InputField({
  id,
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled = false,
  rightElement,
}: {
  id: string;
  label: string;
  icon: React.ElementType;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rightElement?: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--text-muted)] mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="app-input w-full rounded-xl pl-10 pr-4 py-2.5 text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)] transition disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  // Persisted profile store
  const profile = useUserProfileStore();
  const fullName = profile.fullName;
  const setFullName = (v: string) => profile.updateField('fullName', v);
  const email = profile.email;
  const phone = profile.phone;
  const setPhone = (v: string) => profile.updateField('phone', v);
  const institution = profile.institution;
  const setInstitution = (v: string) => profile.updateField('institution', v);
  const country = profile.country;
  const setCountry = (v: string) => profile.updateField('country', v);

  // Security (transient — not persisted)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Preferences (persisted)
  const defaultCountry = profile.defaultCountry;
  const setDefaultCountry = (v: string) => profile.updateField('defaultCountry', v);
  const emailNotifications = profile.emailNotifications;
  const setEmailNotifications = (v: boolean) => profile.updateField('emailNotifications', v);
  const darkMode = profile.darkMode;
  const setDarkMode = (v: boolean) => profile.updateField('darkMode', v);
  const exportFormat = profile.exportFormat;
  const setExportFormat = (v: string) => profile.updateField('exportFormat', v);

  // UI state
  const [saving, setSaving] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast.success(MESSAGES.profile.updated);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Profile Settings</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Manage your account settings and preferences
          </p>
        </motion.div>

        {/* Avatar Section */}
        <motion.div
          variants={itemVariants}
          className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-6"
        >
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-2xl font-bold shadow-glow">
                {fullName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <button
                id="change-avatar"
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="w-5 h-5 text-[var(--text-primary)]" />
              </button>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{fullName}</h2>
              <p className="text-sm text-[var(--text-muted)]">{email}</p>
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[var(--accent-faint)] text-[var(--text-primary)] text-xs font-medium">
                <Shield className="w-3 h-3" />
                Verified Account
              </span>
            </div>
          </div>
        </motion.div>

        {/* Personal Information */}
        <motion.div
          variants={itemVariants}
          className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-6"
        >
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
            Personal Information
          </h3>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            Update your personal details
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              id="settings-fullname"
              label="Full Name"
              icon={User}
              value={fullName}
              onChange={setFullName}
              placeholder="Enter your full name"
            />
            <InputField
              id="settings-email"
              label="Email Address"
              icon={Mail}
              value={email}
              onChange={() => {}}
              disabled
              rightElement={
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <Check className="w-3 h-3" />
                  Verified
                </span>
              }
            />
            <InputField
              id="settings-phone"
              label="Phone Number"
              icon={Phone}
              value={phone}
              onChange={setPhone}
              placeholder="+234 xxx xxxx"
            />
            <InputField
              id="settings-institution"
              label="Institution / Organization"
              icon={Building2}
              value={institution}
              onChange={setInstitution}
              placeholder="e.g. University of Lagos"
            />
            <div>
              <label
                htmlFor="settings-country"
                className="block text-sm font-medium text-[var(--text-muted)] mb-1.5"
              >
                Country
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
                  <CountryFlag code={country} size="sm" />
                </div>
                <select
                  id="settings-country"
                  name="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-[var(--border-hover)] bg-[var(--accent-faint)] py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] transition focus:border-[var(--border-active)] focus:ring-1 focus:ring-[var(--border-hover)]"
                >
                  {countries.map((c) => (
                    <option
                      key={c.code}
                      value={c.code}
                      className="bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Security */}
        <motion.div
          variants={itemVariants}
          className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-6"
        >
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Security</h3>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            Manage your password and security settings
          </p>

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[var(--text-secondary)]">
              Change Password
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField
                id="settings-current-password"
                label="Current Password"
                icon={Lock}
                type={showCurrentPw ? "text" : "password"}
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="••••••••"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  >
                    {showCurrentPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
              />
              <InputField
                id="settings-new-password"
                label="New Password"
                icon={Lock}
                type={showNewPw ? "text" : "password"}
                value={newPassword}
                onChange={setNewPassword}
                placeholder="••••••••"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  >
                    {showNewPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
              />
              <InputField
                id="settings-confirm-password"
                label="Confirm Password"
                icon={Lock}
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="••••••••"
              />
            </div>

            <div className="h-px bg-[var(--accent-faint)] my-6" />

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-[var(--text-primary)]">
                  Two-Factor Authentication
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Add an extra layer of security to your account
                </p>
              </div>
              <ToggleSwitch
                id="settings-2fa"
                checked={false}
                onChange={() => {}}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-[var(--text-primary)]">
                  Google Account
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Connect your Google account for easy sign-in
                </p>
              </div>
              <button
                id="connect-google"
                className="px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] border border-[var(--border-active)] rounded-lg hover:bg-[var(--accent-faint)] transition"
              >
                Connect
              </button>
            </div>
          </div>
        </motion.div>

        {/* Preferences */}
        <motion.div
          variants={itemVariants}
          className="rounded-xl bg-[var(--glass-bg)] border border-[var(--border-primary)] p-6"
        >
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Preferences</h3>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            Customize your experience
          </p>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-[var(--text-muted)]" />
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">
                    Default Country
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]">
                    For predictions and analysis
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CountryFlag code={defaultCountry} size="sm" />
                <select
                  id="settings-default-country"
                  value={defaultCountry}
                  onChange={(e) => setDefaultCountry(e.target.value)}
                  className="appearance-none rounded-lg border border-[var(--border-hover)] bg-[var(--accent-faint)] px-3 py-1.5 text-sm text-[var(--text-primary)] transition focus:border-[var(--border-active)]"
                >
                  {countries.map((c) => (
                    <option
                      key={c.code}
                      value={c.code}
                      className="bg-[var(--bg-secondary)]"
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="h-px bg-[var(--accent-faint)]" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-[var(--text-muted)]" />
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">
                    Email Notifications
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]">
                    Receive prediction alerts via email
                  </p>
                </div>
              </div>
              <ToggleSwitch
                id="settings-notifications"
                checked={emailNotifications}
                onChange={setEmailNotifications}
              />
            </div>

            <div className="h-px bg-[var(--accent-faint)]" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Palette className="w-4 h-4 text-[var(--text-muted)]" />
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">Dark Mode</h4>
                  <p className="text-xs text-[var(--text-muted)]">
                    Toggle between dark and light themes
                  </p>
                </div>
              </div>
              <ToggleSwitch
                id="settings-dark-mode"
                checked={darkMode}
                onChange={setDarkMode}
              />
            </div>

            <div className="h-px bg-[var(--accent-faint)]" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileDown className="w-4 h-4 text-[var(--text-muted)]" />
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">
                    Export Format
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]">
                    Default format for report downloads
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {["pdf", "csv"].map((fmt) => (
                  <button
                    key={fmt}
                    id={`export-format-${fmt}`}
                    onClick={() => setExportFormat(fmt)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                      exportFormat === fmt
                        ? "bg-[var(--accent-faint)] text-[var(--text-primary)] border border-[var(--border-active)]"
                        : "bg-[var(--accent-faint)] text-[var(--text-muted)] border border-[var(--border-hover)] hover:bg-[var(--glass-bg-hover)]"
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Save Button */}
        <motion.div variants={itemVariants} className="flex justify-end">
          <button
            id="save-settings"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary btn-shine px-6 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          variants={itemVariants}
          className="rounded-xl bg-red-500/5 border border-red-500/10 p-6"
        >
          <h3 className="text-lg font-semibold text-red-400 mb-1">
            Danger Zone
          </h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Irreversible actions that affect your account
          </p>
          <button
            id="delete-account"
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        </motion.div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full mx-4 glass-panel rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Delete Account
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                Are you sure you want to delete your account? All your
                predictions, reports, and data will be permanently removed. This
                action is irreversible.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  id="cancel-delete"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--accent-faint)] border border-[var(--border-hover)] rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  id="confirm-delete"
                  className="px-4 py-2 text-sm text-[var(--text-primary)] bg-red-600 hover:bg-red-500 rounded-xl transition"
                >
                  Delete Account
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
