import { getPool } from "@/lib/db"

export type ProfileSettings = {
  displayName: string
  phone: string
  department: string
  timezone: string
}

export type NotificationSettings = {
  taskAssignedInApp: boolean
  taskAssignedEmail: boolean
  taskAssignedSms: boolean
  taskOverdueInApp: boolean
  taskOverdueEmail: boolean
  taskOverdueSms: boolean
  requestSubmittedInApp: boolean
  requestSubmittedEmail: boolean
  requestSubmittedSms: boolean
  requestDecisionInApp: boolean
  requestDecisionEmail: boolean
  requestDecisionSms: boolean
  formSubmittedInApp: boolean
  formSubmittedEmail: boolean
  formSubmittedSms: boolean
  workOrderAssignedInApp: boolean
  workOrderAssignedEmail: boolean
  workOrderAssignedSms: boolean
  lowInventoryInApp: boolean
  lowInventoryEmail: boolean
  lowInventorySms: boolean
  timesheetSubmittedInApp: boolean
  timesheetSubmittedEmail: boolean
  timesheetSubmittedSms: boolean
  weeklyLeadershipSummaryInApp: boolean
  weeklyLeadershipSummaryEmail: boolean
  weeklyLeadershipSummarySms: boolean
  securityAlertInApp: boolean
  securityAlertEmail: boolean
  securityAlertSms: boolean
  digestFrequency: "immediate" | "daily" | "weekly"
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  toastStyle: "minimal" | "detailed" | "silent"
}

export type AppearanceSettings = {
  theme: "light" | "dark" | "system"
  density: "comfortable" | "compact"
  sidebarBehavior: "expanded" | "collapsed" | "remember"
  showStatusBadges: boolean
  showPriorityColor: boolean
  showCompactTimestamps: boolean
  showAssignedUserAvatars: boolean
  reduceMotion: boolean
}

export type WorkspaceSettings = {
  defaultLandingPage: "dashboard" | "tasks" | "projection-calendar" | "requests" | "work-orders" | "reports" | "chat"
  defaultModuleView: "cards" | "table" | "split"
  defaultDateRange: "today" | "this-week" | "this-month"
  companyDivision: string
  department: string
  quickActionsEnabled: boolean
  leadershipCardsEnabled: boolean
}

export type SecuritySettings = {
  sessionTimeout: "30m" | "1h" | "8h" | "keep-signed-in"
  requireReauthForAdminActions: boolean
  twoFactorEnabled: boolean
}

export type UserSettingsRecord = {
  profile: ProfileSettings
  notifications: NotificationSettings
  appearance: AppearanceSettings
  workspace: WorkspaceSettings
  security: SecuritySettings
  updatedAt: string | null
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
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
}

const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: "system",
  density: "comfortable",
  sidebarBehavior: "remember",
  showStatusBadges: true,
  showPriorityColor: true,
  showCompactTimestamps: false,
  showAssignedUserAvatars: true,
  reduceMotion: false,
}

const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  defaultLandingPage: "chat",
  defaultModuleView: "cards",
  defaultDateRange: "this-week",
  companyDivision: "",
  department: "",
  quickActionsEnabled: true,
  leadershipCardsEnabled: true,
}

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  sessionTimeout: "1h",
  requireReauthForAdminActions: true,
  twoFactorEnabled: false,
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function mergeSection<T extends Record<string, unknown>>(defaults: T, raw: unknown): T {
  const input = asObject(raw)
  const merged = { ...defaults }

  for (const key of Object.keys(defaults)) {
    const candidate = input[key]
    if (candidate === undefined) {
      continue
    }

    const defaultValue = defaults[key]
    if (typeof defaultValue === "boolean" && typeof candidate === "boolean") {
      ;(merged as Record<string, unknown>)[key] = candidate
      continue
    }

    if (typeof defaultValue === "string" && typeof candidate === "string") {
      ;(merged as Record<string, unknown>)[key] = candidate
    }
  }

  return merged as T
}

function getDefaultProfile(name: string): ProfileSettings {
  return {
    displayName: name,
    phone: "",
    department: "",
    timezone: "UTC",
  }
}

export async function getOrCreateUserSettings(userKey: string, profileName: string): Promise<UserSettingsRecord> {
  const pool = getPool()
  const defaultProfile = getDefaultProfile(profileName)

  const result = await pool.query<{
    profile: unknown
    notifications: unknown
    appearance: unknown
    workspace: unknown
    security: unknown
    updated_at: string | null
  }>(
    `
    INSERT INTO user_settings (user_key, profile, notifications, appearance, workspace, security)
    VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
    ON CONFLICT (user_key) DO UPDATE
      SET user_key = EXCLUDED.user_key
    RETURNING profile, notifications, appearance, workspace, security, updated_at
    `,
    [
      userKey,
      JSON.stringify(defaultProfile),
      JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS),
      JSON.stringify(DEFAULT_APPEARANCE_SETTINGS),
      JSON.stringify(DEFAULT_WORKSPACE_SETTINGS),
      JSON.stringify(DEFAULT_SECURITY_SETTINGS),
    ],
  )

  const row = result.rows[0]

  return {
    profile: mergeSection(defaultProfile, row.profile),
    notifications: mergeSection(DEFAULT_NOTIFICATION_SETTINGS, row.notifications),
    appearance: mergeSection(DEFAULT_APPEARANCE_SETTINGS, row.appearance),
    workspace: mergeSection(DEFAULT_WORKSPACE_SETTINGS, row.workspace),
    security: mergeSection(DEFAULT_SECURITY_SETTINGS, row.security),
    updatedAt: row.updated_at,
  }
}

export async function updateUserSettingsSection(
  userKey: string,
  section: "profile" | "notifications" | "appearance" | "workspace" | "security",
  payload: Record<string, unknown>,
): Promise<UserSettingsRecord> {
  const current = await getOrCreateUserSettings(userKey, "User")

  const next: UserSettingsRecord = {
    ...current,
    profile: section === "profile" ? mergeSection(current.profile, payload) : current.profile,
    notifications:
      section === "notifications" ? mergeSection(current.notifications, payload) : current.notifications,
    appearance: section === "appearance" ? mergeSection(current.appearance, payload) : current.appearance,
    workspace: section === "workspace" ? mergeSection(current.workspace, payload) : current.workspace,
    security: section === "security" ? mergeSection(current.security, payload) : current.security,
    updatedAt: current.updatedAt,
  }

  const pool = getPool()

  const persisted = await pool.query<{
    profile: unknown
    notifications: unknown
    appearance: unknown
    workspace: unknown
    security: unknown
    updated_at: string | null
  }>(
    `
    UPDATE user_settings
    SET profile = $2::jsonb,
        notifications = $3::jsonb,
        appearance = $4::jsonb,
        workspace = $5::jsonb,
        security = $6::jsonb,
        updated_at = NOW()
    WHERE user_key = $1
    RETURNING profile, notifications, appearance, workspace, security, updated_at
    `,
    [
      userKey,
      JSON.stringify(next.profile),
      JSON.stringify(next.notifications),
      JSON.stringify(next.appearance),
      JSON.stringify(next.workspace),
      JSON.stringify(next.security),
    ],
  )

  const row = persisted.rows[0]

  return {
    profile: mergeSection(getDefaultProfile(next.profile.displayName || "User"), row.profile),
    notifications: mergeSection(DEFAULT_NOTIFICATION_SETTINGS, row.notifications),
    appearance: mergeSection(DEFAULT_APPEARANCE_SETTINGS, row.appearance),
    workspace: mergeSection(DEFAULT_WORKSPACE_SETTINGS, row.workspace),
    security: mergeSection(DEFAULT_SECURITY_SETTINGS, row.security),
    updatedAt: row.updated_at,
  }
}
