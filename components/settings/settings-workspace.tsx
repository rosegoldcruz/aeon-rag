"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { UserSettingsRecord } from "@/lib/user-settings"

type SettingsPayload = {
  ok: boolean
  settings: UserSettingsRecord
  capabilities: {
    smsNotifications: boolean
    passwordChange: boolean
    twoFactor: boolean
    sessionInventory: boolean
    employeeDirectory: boolean
    billingPortal: boolean
  }
}

const TABS = ["profile", "notifications", "appearance", "workspace", "security"] as const
type TabId = (typeof TABS)[number]

const EMPTY_SETTINGS: UserSettingsRecord = {
  profile: {
    displayName: "",
    phone: "",
    department: "",
    timezone: "UTC",
  },
  notifications: {
    taskAssignedInApp: true,
    taskAssignedEmail: true,
    taskAssignedSms: false,
    taskOverdueInApp: true,
    taskOverdueEmail: true,
    taskOverdueSms: false,
    requestSubmittedInApp: true,
    requestSubmittedEmail: true,
    requestSubmittedSms: false,
    requestDecisionInApp: true,
    requestDecisionEmail: true,
    requestDecisionSms: false,
    formSubmittedInApp: true,
    formSubmittedEmail: true,
    formSubmittedSms: false,
    workOrderAssignedInApp: true,
    workOrderAssignedEmail: true,
    workOrderAssignedSms: false,
    lowInventoryInApp: true,
    lowInventoryEmail: true,
    lowInventorySms: false,
    timesheetSubmittedInApp: true,
    timesheetSubmittedEmail: true,
    timesheetSubmittedSms: false,
    weeklyLeadershipSummaryInApp: true,
    weeklyLeadershipSummaryEmail: true,
    weeklyLeadershipSummarySms: false,
    securityAlertInApp: true,
    securityAlertEmail: true,
    securityAlertSms: false,
    digestFrequency: "daily",
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    toastStyle: "detailed",
  },
  appearance: {
    theme: "system",
    density: "comfortable",
    sidebarBehavior: "remember",
    showStatusBadges: true,
    showPriorityColor: true,
    showCompactTimestamps: false,
    showAssignedUserAvatars: true,
    reduceMotion: false,
  },
  workspace: {
    defaultLandingPage: "chat",
    defaultModuleView: "cards",
    defaultDateRange: "this-week",
    companyDivision: "",
    department: "",
    quickActionsEnabled: true,
    leadershipCardsEnabled: true,
  },
  security: {
    sessionTimeout: "1h",
    requireReauthForAdminActions: true,
    twoFactorEnabled: false,
  },
  updatedAt: null,
}

type Props = {
  userName: string
  userEmail: string
}

const notificationRows = [
  ["Task Assigned", "taskAssigned"],
  ["Task Overdue", "taskOverdue"],
  ["Request Submitted", "requestSubmitted"],
  ["Request Decision", "requestDecision"],
  ["Form Submitted", "formSubmitted"],
  ["Work Order Assigned", "workOrderAssigned"],
  ["Low Inventory", "lowInventory"],
  ["Timesheet Submitted", "timesheetSubmitted"],
  ["Weekly Leadership Summary", "weeklyLeadershipSummary"],
  ["Security Alert", "securityAlert"],
] as const

function endpointForTab(tab: TabId) {
  return `/api/settings/${tab}`
}

export function SettingsWorkspace({ userName, userEmail }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("profile")
  const [settings, setSettings] = useState<UserSettingsRecord>(EMPTY_SETTINGS)
  const [capabilities, setCapabilities] = useState<SettingsPayload["capabilities"]>({
    smsNotifications: false,
    passwordChange: false,
    twoFactor: false,
    sessionInventory: false,
    employeeDirectory: false,
    billingPortal: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" })
        const payload = (await response.json()) as SettingsPayload & { error?: string }
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Failed to load settings")
        }

        if (!cancelled) {
          setSettings(payload.settings)
          setCapabilities(payload.capabilities)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load settings"
        toast.error(message)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const disabledModules = useMemo(
    () => [
      "tasks",
      "projection-calendar",
      "requests",
      "work-orders",
      "reports",
    ],
    [],
  )

  async function saveTab(tab: TabId) {
    setSaving(true)
    try {
      const response = await fetch(endpointForTab(tab), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings[tab]),
      })

      const payload = (await response.json()) as { ok: boolean; settings: UserSettingsRecord; error?: string }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to save settings")
      }

      setSettings(payload.settings)
      toast.success("Settings saved")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  function setNotification(prefix: string, channel: "InApp" | "Email" | "Sms", value: boolean) {
    const key = `${prefix}${channel}` as keyof UserSettingsRecord["notifications"]
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value,
      },
    }))
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <header className="rounded-xl border border-border/70 bg-card/60 p-4 md:p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Diversified OS</p>
        <h1 className="mt-1 text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Logged in as <span className="text-foreground">{userName || "User"}</span>
          {userEmail ? ` (${userEmail})` : ""}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="rounded-xl border border-border/70 bg-card/60 p-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm capitalize ${
                tab === activeTab ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        <section className="rounded-xl border border-border/70 bg-card/60 p-4 md:p-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading settings...</p>
          ) : (
            <>
              {activeTab === "profile" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Profile</h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Display Name</span>
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.profile.displayName}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            profile: { ...prev.profile, displayName: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Email (read only)</span>
                      <input
                        className="w-full rounded-md border border-border bg-muted px-3 py-2 text-muted-foreground"
                        value={userEmail}
                        readOnly
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Phone</span>
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.profile.phone}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            profile: { ...prev.profile, phone: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Department</span>
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.profile.department}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            profile: { ...prev.profile, department: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="text-sm md:col-span-2">
                      <span className="mb-1 block text-muted-foreground">Timezone</span>
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.profile.timezone}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            profile: { ...prev.profile, timezone: event.target.value },
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
                    Profile photo upload and role editing are not implemented in this repository.
                  </div>
                  <Button disabled={saving} onClick={() => saveTab("profile")}>Save Profile</Button>
                </div>
              )}

              {activeTab === "notifications" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Notifications</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead>
                        <tr className="border-b border-border/70 text-left text-muted-foreground">
                          <th className="px-2 py-2">Event</th>
                          <th className="px-2 py-2">In-App</th>
                          <th className="px-2 py-2">Email</th>
                          <th className="px-2 py-2">SMS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {notificationRows.map(([label, keyPrefix]) => (
                          <tr key={keyPrefix} className="border-b border-border/50 last:border-b-0">
                            <td className="px-2 py-2">{label}</td>
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={Boolean(settings.notifications[`${keyPrefix}InApp` as keyof typeof settings.notifications])}
                                onChange={(event) => setNotification(keyPrefix, "InApp", event.target.checked)}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={Boolean(settings.notifications[`${keyPrefix}Email` as keyof typeof settings.notifications])}
                                onChange={(event) => setNotification(keyPrefix, "Email", event.target.checked)}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                disabled={!capabilities.smsNotifications}
                                checked={Boolean(settings.notifications[`${keyPrefix}Sms` as keyof typeof settings.notifications])}
                                onChange={(event) => setNotification(keyPrefix, "Sms", event.target.checked)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Digest Frequency</span>
                      <select
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.notifications.digestFrequency}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            notifications: {
                              ...prev.notifications,
                              digestFrequency: event.target.value as UserSettingsRecord["notifications"]["digestFrequency"],
                            },
                          }))
                        }
                      >
                        <option value="immediate">Immediate</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </label>

                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Quiet Hours Start</span>
                      <input
                        type="time"
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.notifications.quietHoursStart}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            notifications: {
                              ...prev.notifications,
                              quietHoursStart: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>

                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Quiet Hours End</span>
                      <input
                        type="time"
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.notifications.quietHoursEnd}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            notifications: {
                              ...prev.notifications,
                              quietHoursEnd: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.notifications.quietHoursEnabled}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          notifications: {
                            ...prev.notifications,
                            quietHoursEnabled: event.target.checked,
                          },
                        }))
                      }
                    />
                    Enable quiet hours
                  </label>

                  <div className="rounded-md border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
                    SMS notifications are disabled because no SMS provider integration exists in this deployment.
                  </div>
                  <Button disabled={saving} onClick={() => saveTab("notifications")}>Save Notifications</Button>
                </div>
              )}

              {activeTab === "appearance" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Appearance</h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Theme</span>
                      <select
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.appearance.theme}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            appearance: {
                              ...prev.appearance,
                              theme: event.target.value as UserSettingsRecord["appearance"]["theme"],
                            },
                          }))
                        }
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">System</option>
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Density</span>
                      <select
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.appearance.density}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            appearance: {
                              ...prev.appearance,
                              density: event.target.value as UserSettingsRecord["appearance"]["density"],
                            },
                          }))
                        }
                      >
                        <option value="comfortable">Comfortable</option>
                        <option value="compact">Compact</option>
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Sidebar</span>
                      <select
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.appearance.sidebarBehavior}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            appearance: {
                              ...prev.appearance,
                              sidebarBehavior: event.target.value as UserSettingsRecord["appearance"]["sidebarBehavior"],
                            },
                          }))
                        }
                      >
                        <option value="expanded">Expanded</option>
                        <option value="collapsed">Collapsed</option>
                        <option value="remember">Remember last state</option>
                      </select>
                    </label>
                  </div>

                  {[
                    ["Show status badges", "showStatusBadges"],
                    ["Show priority color coding", "showPriorityColor"],
                    ["Show compact timestamps", "showCompactTimestamps"],
                    ["Show assigned user avatars", "showAssignedUserAvatars"],
                    ["Reduce motion", "reduceMotion"],
                  ].map(([label, key]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(settings.appearance[key as keyof UserSettingsRecord["appearance"]])}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            appearance: {
                              ...prev.appearance,
                              [key]: event.target.checked,
                            },
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}

                  <Button disabled={saving} onClick={() => saveTab("appearance")}>Save Appearance</Button>
                </div>
              )}

              {activeTab === "workspace" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Workspace</h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Default Landing Page</span>
                      <select
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.workspace.defaultLandingPage}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            workspace: {
                              ...prev.workspace,
                              defaultLandingPage: event.target.value as UserSettingsRecord["workspace"]["defaultLandingPage"],
                            },
                          }))
                        }
                      >
                        <option value="dashboard">Dashboard (not available)</option>
                        <option value="tasks">Tasks (not available)</option>
                        <option value="projection-calendar">Projection Calendar (not available)</option>
                        <option value="requests">Requests (not available)</option>
                        <option value="work-orders">Work Orders (not available)</option>
                        <option value="reports">Reports (not available)</option>
                        <option value="chat">Chat (available)</option>
                      </select>
                    </label>

                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Default Module View</span>
                      <select
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.workspace.defaultModuleView}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            workspace: {
                              ...prev.workspace,
                              defaultModuleView: event.target.value as UserSettingsRecord["workspace"]["defaultModuleView"],
                            },
                          }))
                        }
                      >
                        <option value="cards">Cards</option>
                        <option value="table">Table</option>
                        <option value="split">Split</option>
                      </select>
                    </label>

                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Default Date Range</span>
                      <select
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.workspace.defaultDateRange}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            workspace: {
                              ...prev.workspace,
                              defaultDateRange: event.target.value as UserSettingsRecord["workspace"]["defaultDateRange"],
                            },
                          }))
                        }
                      >
                        <option value="today">Today</option>
                        <option value="this-week">This Week</option>
                        <option value="this-month">This Month</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Company Division</span>
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.workspace.companyDivision}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            workspace: {
                              ...prev.workspace,
                              companyDivision: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>

                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Department</span>
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        value={settings.workspace.department}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            workspace: {
                              ...prev.workspace,
                              department: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.workspace.quickActionsEnabled}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          workspace: {
                            ...prev.workspace,
                            quickActionsEnabled: event.target.checked,
                          },
                        }))
                      }
                    />
                    Enable quick actions panel
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.workspace.leadershipCardsEnabled}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          workspace: {
                            ...prev.workspace,
                            leadershipCardsEnabled: event.target.checked,
                          },
                        }))
                      }
                    />
                    Enable leadership summary cards
                  </label>

                  <div className="rounded-md border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
                    Modules unavailable in this repository: {disabledModules.join(", ")}. Values are saved but these modules will stay disabled until implemented.
                  </div>
                  <Button disabled={saving} onClick={() => saveTab("workspace")}>Save Workspace</Button>
                </div>
              )}

              {activeTab === "security" && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Security</h2>
                  <label className="text-sm">
                    <span className="mb-1 block text-muted-foreground">Session Timeout</span>
                    <select
                      className="w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.security.sessionTimeout}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          security: {
                            ...prev.security,
                            sessionTimeout: event.target.value as UserSettingsRecord["security"]["sessionTimeout"],
                          },
                        }))
                      }
                    >
                      <option value="30m">30 minutes</option>
                      <option value="1h">1 hour</option>
                      <option value="8h">8 hours</option>
                      <option value="keep-signed-in">Keep signed in</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.security.requireReauthForAdminActions}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          security: {
                            ...prev.security,
                            requireReauthForAdminActions: event.target.checked,
                          },
                        }))
                      }
                    />
                    Require re-auth for admin actions
                  </label>

                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={settings.security.twoFactorEnabled} disabled={!capabilities.twoFactor} readOnly />
                    Enable 2FA (not available)
                  </label>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Button
                      variant="outline"
                      onClick={() => toast.error("Password changes are managed through ZITADEL, not this app.")}
                    >
                      Update Password
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => toast.error("Session inventory is not implemented in this deployment.")}
                    >
                      View Active Sessions
                    </Button>
                  </div>

                  <Button disabled={saving} onClick={() => saveTab("security")}>Save Security</Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <footer className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Button asChild variant="outline">
          <Link href="/">Back to Workspace</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin">Open Admin Portal</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings/billing">Billing</Link>
        </Button>
      </footer>
    </div>
  )
}
