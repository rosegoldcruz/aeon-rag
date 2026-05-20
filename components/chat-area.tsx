"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  ImageIcon,
  Lightbulb,
  LogOut,
  Menu,
  Mic,
  Paperclip,
  Search,
  Settings,
  Shield,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { ParticleOrb, type OrbState } from "@/components/particle-orb"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/components/ui/use-mobile"

type ChatMode = "chat" | "brainstorm" | "plan" | "image_prompt"
type ResponseStyle = "balanced" | "direct" | "detailed"

type ChatMessage = {
  id: string
  role: "user" | "assistant" | "system"
  text: string
  mode: ChatMode
  timestamp: string
  model?: string
  sources?: Array<{ documentName: string; content: string; score?: number }>
}

type ChatSession = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lastMessagePreview?: string | null
}

type ModelOption = {
  id: string
  label: string
}

type UploadedFile = {
  id: string
  name: string
  size: number
  type: string
  storedPath: string
  status?: "uploaded" | "indexed" | "failed"
  chunkCount?: number
  indexingMessage?: string
  ingested?: boolean
  ingestError?: string
}

type UploadFailure = {
  name: string
  reason: string
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: {
    resultIndex: number
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
  }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

type FailedSubmission = {
  mode: ChatMode
  text: string
}

type ToolPanelItem = {
  key: "documents" | "drive_imports" | "drive_worker" | "memory" | "vision" | "image_generation" | "github" | "mcp_servers"
  label: string
  state: "enabled" | "disabled" | "coming_soon"
  detail: string
}

const MODEL_FALLBACK: ModelOption[] = [
  { id: "gemini-2.5-flash", label: "AEON Core" },
  { id: "gemini-2.5-pro", label: "AEON Deep Focus" },
  { id: "gemini-2.0-flash", label: "AEON Swift" },
]

const MODE_LABEL: Record<ChatMode, string> = {
  chat: "Chat",
  brainstorm: "Brainstorm",
  plan: "Plan",
  image_prompt: "Image Prompt",
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelativeTime(iso: string) {
  const date = new Date(iso)
  const now = Date.now()
  const diff = date.getTime() - now
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (Math.abs(diff) < hour) {
    return rtf.format(Math.round(diff / minute), "minute")
  }

  if (Math.abs(diff) < day) {
    return rtf.format(Math.round(diff / hour), "hour")
  }

  return rtf.format(Math.round(diff / day), "day")
}

function stripPreview(input: string | null | undefined) {
  if (!input) {
    return ""
  }

  return input.replace(/\s+/g, " ").trim()
}

function getInitials(input: string) {
  const parts = input
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return "AO"
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase()
}

export function ChatArea() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const sessionState = useSession()
  const session = sessionState?.data
  const waveBarCount = isMobile ? 24 : 52

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sessionSearch, setSessionSearch] = useState("")

  const [inputMessage, setInputMessage] = useState("")
  const [activeMode, setActiveMode] = useState<ChatMode>("chat")
  const [isLoading, setIsLoading] = useState(false)
  const [uiMessage, setUiMessage] = useState("")
  const [lastFailedSubmission, setLastFailedSubmission] = useState<FailedSubmission | null>(null)

  const [models, setModels] = useState<ModelOption[]>(MODEL_FALLBACK)
  const [selectedModel, setSelectedModel] = useState(MODEL_FALLBACK[0].id)

  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false)
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const [responseStyle, setResponseStyle] = useState<ResponseStyle>("balanced")
  const [includeExecutionSteps, setIncludeExecutionSteps] = useState(true)
  const [useUploadedContext, setUseUploadedContext] = useState(true)

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState("")

  const [ragStatus, setRagStatus] = useState({
    documents: 0,
    indexedDocuments: 0,
    chunks: 0,
  })

  const [isListening, setIsListening] = useState(false)
  const [isRequestingMic, setIsRequestingMic] = useState(false)
  const [voiceMessage, setVoiceMessage] = useState("")
  const [orbState, setOrbState] = useState<OrbState>("idle")
  const [toolPanelItems, setToolPanelItems] = useState<ToolPanelItem[]>([
    {
      key: "documents",
      label: "Documents/RAG",
      state: "disabled",
      detail: "Checking...",
    },
    {
      key: "drive_imports",
      label: "Drive Imports",
      state: "disabled",
      detail: "CLI only (run rag:drive:ingest)",
    },
    {
      key: "drive_worker",
      label: "Drive Worker",
      state: "disabled",
      detail: "CLI/PM2 controlled",
    },
    {
      key: "memory",
      label: "Memory",
      state: "disabled",
      detail: "Checking...",
    },
    {
      key: "vision",
      label: "Vision",
      state: "coming_soon",
      detail: "Coming soon",
    },
    {
      key: "image_generation",
      label: "Image Generation",
      state: "coming_soon",
      detail: "Coming soon",
    },
    {
      key: "github",
      label: "GitHub",
      state: "coming_soon",
      detail: "Coming soon",
    },
    {
      key: "mcp_servers",
      label: "MCP Servers",
      state: "coming_soon",
      detail: "Coming soon",
    },
  ])

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalTranscriptRef = useRef("")
  const baseInputRef = useRef("")
  const heardSpeechRef = useRef(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null)
  const optionsMenuRef = useRef<HTMLDivElement | null>(null)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const threadEndRef = useRef<HTMLLIElement | null>(null)

  const profileName = session?.user?.name?.trim() || "ZITADEL User"
  const profileEmail = session?.user?.email?.trim() || "Authenticated session"
  const profileImage = session?.user?.image || ""
  const profileInitials = getInitials(profileName)

  const sidebarIsCollapsed = !isMobile && sidebarCollapsed

  const visibleSessions = useMemo(() => {
    const needle = sessionSearch.trim().toLowerCase()
    if (!needle) {
      return sessions
    }

    return sessions.filter((item) => {
      const title = item.title.toLowerCase()
      const preview = stripPreview(item.lastMessagePreview).toLowerCase()
      return title.includes(needle) || preview.includes(needle)
    })
  }, [sessionSearch, sessions])

  const currentOrbState: OrbState = isListening ? "listening" : orbState

  const refreshRagStatus = async () => {
    try {
      const response = await fetch("/api/rag/status", { cache: "no-store" })
      const payload = (await response.json()) as {
        ok?: boolean
        documents?: number
        indexedDocuments?: number
        chunks?: number
      }

      if (!response.ok || !payload.ok) {
        return
      }

      setRagStatus({
        documents: Number(payload.documents || 0),
        indexedDocuments: Number(payload.indexedDocuments || 0),
        chunks: Number(payload.chunks || 0),
      })
    } catch {
      // Keep current status values.
    }
  }

  const refreshModels = async () => {
    try {
      const response = await fetch("/api/models", { cache: "no-store" })
      const payload = (await response.json()) as {
        ok?: boolean
        models?: ModelOption[]
        selected?: string
      }

      if (response.ok && payload.ok && Array.isArray(payload.models) && payload.models.length > 0) {
        setModels(payload.models)
        setSelectedModel(payload.selected || payload.models[0].id)
      }
    } catch {
      setUiMessage("Could not load model metadata. Using defaults.")
    }
  }

  const refreshToolsPanel = async () => {
    let documentsState: ToolPanelItem = {
      key: "documents",
      label: "Documents/RAG",
      state: "disabled",
      detail: "Not configured",
    }

    let memoryState: ToolPanelItem = {
      key: "memory",
      label: "Memory",
      state: "disabled",
      detail: "Not configured",
    }

    let driveImportsState: ToolPanelItem = {
      key: "drive_imports",
      label: "Drive Imports",
      state: "disabled",
      detail: "CLI only (run rag:drive:ingest)",
    }

    let driveWorkerState: ToolPanelItem = {
      key: "drive_worker",
      label: "Drive Worker",
      state: "disabled",
      detail: "CLI/PM2 controlled",
    }

    try {
      setOrbState("reading_docs")
      const ragResponse = await fetch("/api/tools/rag/status", { cache: "no-store" })
      const ragPayload = (await ragResponse.json()) as {
        ok?: boolean
        message?: string
        error?: string
      }

      if (ragResponse.ok && ragPayload.ok) {
        documentsState = {
          key: "documents",
          label: "Documents/RAG",
          state: "enabled",
          detail: ragPayload.message || "Enabled",
        }
      } else {
        documentsState = {
          key: "documents",
          label: "Documents/RAG",
          state: "disabled",
          detail: ragPayload.error || "Not configured",
        }
      }
    } catch {
      documentsState = {
        key: "documents",
        label: "Documents/RAG",
        state: "disabled",
        detail: "Not configured",
      }
    }

    try {
      setOrbState("writing_memory")
      const memoryResponse = await fetch("/api/memory?limit=1", { cache: "no-store" })
      const memoryPayload = (await memoryResponse.json()) as {
        ok?: boolean
        error?: string
      }

      if (memoryResponse.ok && memoryPayload.ok) {
        memoryState = {
          key: "memory",
          label: "Memory",
          state: "enabled",
          detail: "Enabled",
        }
      } else {
        memoryState = {
          key: "memory",
          label: "Memory",
          state: "disabled",
          detail: memoryPayload.error || "Not configured",
        }
      }
    } catch {
      memoryState = {
        key: "memory",
        label: "Memory",
        state: "disabled",
        detail: "Not configured",
      }
    }

    try {
      setOrbState("reading_docs")
      const driveResponse = await fetch("/api/tools/drive/imports/status", { cache: "no-store" })
      const drivePayload = (await driveResponse.json()) as {
        ok?: boolean
        hasRuns?: boolean
        latestStatus?: string | null
        indexedDriveDocuments?: number
        indexedDriveChunks?: number
        failedItemsCount?: number
        skippedItemsCount?: number
        topFailureStage?: string
        lastRunTimestamp?: string | null
      }

      const runStateResponse = await fetch("/api/tools/drive/imports/run", {
        method: "POST",
      })
      const runStatePayload = (await runStateResponse.json()) as {
        ok?: boolean
        status?: string
        message?: string
      }

      const indexed = Number(drivePayload.indexedDriveDocuments || 0)
      const chunks = Number(drivePayload.indexedDriveChunks || 0)
      const latestStatus = drivePayload.latestStatus || "none"
      const failedItems = Number(drivePayload.failedItemsCount || 0)
      const skippedItems = Number(drivePayload.skippedItemsCount || 0)
      const topFailureStage = drivePayload.topFailureStage || "none"
      const lastRunTimestamp = drivePayload.lastRunTimestamp
        ? new Date(drivePayload.lastRunTimestamp).toLocaleString()
        : "never"
      const cliOnly = runStateResponse.ok && runStatePayload.status === "cli_only"
      const cliDetail = cliOnly ? "CLI-only" : "UI run available"

      const driveDetail = [
        `Indexed Drive docs: ${indexed}`,
        `Drive chunks: ${chunks}`,
        `Latest import status: ${latestStatus}`,
        `Failed items: ${failedItems}`,
        `Skipped items: ${skippedItems}`,
        `Top failure stage: ${topFailureStage}`,
        `Last run: ${lastRunTimestamp}`,
        cliDetail,
      ].join(" | ")

      if (documentsState.state === "enabled") {
        documentsState = {
          ...documentsState,
          detail: driveDetail,
        }
      }

      driveImportsState = {
        key: "drive_imports",
        label: "Drive Imports",
        state: indexed > 0 || latestStatus === "success" || latestStatus === "partial" ? "enabled" : "disabled",
        detail: driveResponse.ok && drivePayload.ok ? `${driveDetail}` : "CLI only (run rag:drive:ingest)",
      }

      const workerResponse = await fetch("/api/tools/drive/worker/status", { cache: "no-store" })
      const workerPayload = (await workerResponse.json()) as {
        ok?: boolean
        worker?: {
          status?: string
          enabled?: boolean
          folder?: string
          folderId?: string | null
          lastFinishedAt?: string
          message?: string
          lastJob?: {
            id?: string
            importedCount?: number
            skippedCount?: number
            failedCount?: number
          } | null
        } | null
        latestJob?: {
          id?: string
          imported_count?: number
          skipped_count?: number
          failed_count?: number
        } | null
      }

      const worker = workerPayload.worker
      const workerStatus = worker?.status || "unknown"
      const workerFolder = worker?.folder || "unknown"
      const workerFolderId = worker?.folderId || "unknown"
      const lastWorkerRun = worker?.lastFinishedAt ? new Date(worker.lastFinishedAt).toLocaleString() : "never"
      const workerJobId = worker?.lastJob?.id || workerPayload.latestJob?.id || "none"
      const workerImported = worker?.lastJob?.importedCount ?? workerPayload.latestJob?.imported_count ?? 0
      const workerSkipped = worker?.lastJob?.skippedCount ?? workerPayload.latestJob?.skipped_count ?? 0
      const workerFailed = worker?.lastJob?.failedCount ?? workerPayload.latestJob?.failed_count ?? 0
      const workerDetail = [
        `Status: ${workerStatus}`,
        `Folder: ${workerFolder}`,
        `Folder ID: ${workerFolderId}`,
        `Last run: ${lastWorkerRun}`,
        `Last job: ${workerJobId}`,
        `Imported: ${workerImported}`,
        `Skipped: ${workerSkipped}`,
        `Failed: ${workerFailed}`,
        "CLI/PM2 controlled",
      ].join(" | ")

      driveWorkerState = {
        key: "drive_worker",
        label: "Drive Worker",
        state: workerResponse.ok && workerPayload.ok && (workerStatus === "running" || workerStatus === "idle") ? "enabled" : "disabled",
        detail: workerResponse.ok && workerPayload.ok ? workerDetail : "CLI/PM2 controlled",
      }
    } catch {
      driveImportsState = {
        key: "drive_imports",
        label: "Drive Imports",
        state: "disabled",
        detail: "CLI only (run rag:drive:ingest)",
      }
      driveWorkerState = {
        key: "drive_worker",
        label: "Drive Worker",
        state: "disabled",
        detail: "CLI/PM2 controlled",
      }
    }

    setToolPanelItems((prev) => [
      documentsState,
      driveImportsState,
      driveWorkerState,
      memoryState,
      ...prev.filter((item) => item.state === "coming_soon"),
    ])

    setOrbState("idle")
  }

  const refreshSessions = async (preferredSessionId?: string | null) => {
    const response = await fetch("/api/chats", { cache: "no-store" })
    const payload = (await response.json()) as {
      ok?: boolean
      sessions?: ChatSession[]
      error?: string
    }

    if (!response.ok || !payload.ok || !Array.isArray(payload.sessions)) {
      throw new Error(payload.error || "Could not load chats.")
    }

    setSessions(payload.sessions)

    const nextActive = preferredSessionId || activeSessionId || payload.sessions[0]?.id || null
    setActiveSessionId(nextActive)
    return payload.sessions
  }

  const loadSessionMessages = async (sessionId: string) => {
    const response = await fetch(`/api/chats/${sessionId}`, { cache: "no-store" })
    const payload = (await response.json()) as {
      ok?: boolean
      messages?: Array<{
        id: string
        role: "user" | "assistant" | "system"
        content: string
        model?: string
        sources?: Array<{ documentName: string; content: string; score?: number }>
        createdAt: string
      }>
      error?: string
    }

    if (!response.ok || !payload.ok || !Array.isArray(payload.messages)) {
      throw new Error(payload.error || "Could not load messages for this chat.")
    }

    setMessages(
      payload.messages.map((item) => ({
        id: item.id,
        role: item.role,
        text: item.content,
        mode: "chat",
        timestamp: item.createdAt,
        model: item.model,
        sources: item.sources,
      })),
    )
  }

  const createNewChat = async () => {
    if (isLoading) {
      return
    }

    setUiMessage("")
    setMessages([])
    setLastFailedSubmission(null)
    setActiveMode("chat")
    setOrbState("idle")

    const response = await fetch("/api/chats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "New Chat" }),
    })

    const payload = (await response.json()) as {
      ok?: boolean
      session?: ChatSession
      error?: string
    }

    if (!response.ok || !payload.ok || !payload.session) {
      throw new Error(payload.error || "Could not create a new chat session.")
    }

    setActiveSessionId(payload.session.id)
    setSessions((prev) => [payload.session!, ...prev])
    setMobileSidebarOpen(false)
  }

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await Promise.all([refreshModels(), refreshRagStatus(), refreshToolsPanel()])
        const loadedSessions = await refreshSessions(null)
        if (loadedSessions[0]?.id) {
          await loadSessionMessages(loadedSessions[0].id)
        }
      } catch (error) {
        const safe = error instanceof Error ? error.message : "Could not initialize chat workspace."
        setUiMessage(safe)
      }
    }

    void bootstrap()
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node

      if (optionsMenuRef.current && !optionsMenuRef.current.contains(target)) {
        setOptionsMenuOpen(false)
      }

      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setExportDropdownOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return

      setMobileSidebarOpen(false)
      setOptionsMenuOpen(false)
      setExportDropdownOpen(false)
      setToolsOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false)
    }
  }, [isMobile])

  useEffect(() => {
    const body = document.body
    const previousOverflow = body.style.overflow
    const previousTouchAction = body.style.touchAction

    if (isMobile && mobileSidebarOpen) {
      body.style.overflow = "hidden"
      body.style.touchAction = "none"
    } else {
      body.style.overflow = ""
      body.style.touchAction = ""
    }

    return () => {
      body.style.overflow = previousOverflow
      body.style.touchAction = previousTouchAction
    }
  }, [isMobile, mobileSidebarOpen])

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      return
    }

    let cancelled = false

    const run = async () => {
      try {
        await loadSessionMessages(activeSessionId)
      } catch (error) {
        if (!cancelled) {
          const safe = error instanceof Error ? error.message : "Could not load selected chat."
          setUiMessage(safe)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [activeSessionId])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, isLoading])

  const stopListening = (discardTranscript: boolean) => {
    if (discardTranscript) {
      setInputMessage(baseInputRef.current)
      finalTranscriptRef.current = ""
      heardSpeechRef.current = false
    }

    recognitionRef.current?.stop()
  }

  const startVoiceInput = async () => {
    if (typeof window === "undefined") return
    if (isListening || isRequestingMic) return

    const SpeechCtor = (window as typeof window & {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }).SpeechRecognition ||
      (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition

    if (!SpeechCtor) {
      setVoiceMessage("Voice input is not supported in this browser.")
      return
    }

    setVoiceMessage("")
    setIsRequestingMic(true)

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setVoiceMessage("Voice input is not supported in this browser.")
        setIsRequestingMic(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())

      baseInputRef.current = inputMessage.trim()
      finalTranscriptRef.current = ""
      heardSpeechRef.current = false

      const recognition = new SpeechCtor()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = "en-US"

      recognition.onstart = () => {
        setIsListening(true)
        setIsRequestingMic(false)
        setVoiceMessage("")
      }

      recognition.onresult = (event) => {
        let finalPart = ""
        let interimPart = ""

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const segment = event.results[i][0].transcript.trim()
          if (!segment) continue

          heardSpeechRef.current = true
          if (event.results[i].isFinal) {
            finalPart = `${finalPart} ${segment}`.trim()
          } else {
            interimPart = `${interimPart} ${segment}`.trim()
          }
        }

        if (finalPart) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${finalPart}`.trim()
        }

        const mergedTranscript = [finalTranscriptRef.current, interimPart].filter(Boolean).join(" ").trim()
        const merged = [baseInputRef.current, mergedTranscript].filter(Boolean).join(baseInputRef.current ? "\n" : "")
        setInputMessage(merged)
      }

      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
          setVoiceMessage("Microphone permission denied.")
        } else if (event.error === "no-speech") {
          setVoiceMessage("No speech detected. Try again.")
        } else {
          setVoiceMessage("Could not transcribe audio. Recording stopped.")
        }
      }

      recognition.onend = () => {
        setIsListening(false)
        setIsRequestingMic(false)
        recognitionRef.current = null

        if (!heardSpeechRef.current) {
          setVoiceMessage("No speech detected. Try again.")
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch {
      setIsListening(false)
      setIsRequestingMic(false)
      setVoiceMessage("Microphone permission denied.")
    }
  }

  const uploadSelectedFiles = async (files: File[]) => {
    if (files.length === 0 || isUploading) return

    setIsUploading(true)
    setUploadMessage("")

    const uploaded: UploadedFile[] = []
    const failed: UploadFailure[] = []

    for (const file of files) {
      const formData = new FormData()
      formData.append("file", file)

      try {
        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        })

        const contentType = response.headers.get("content-type") || ""
        let payload: {
          ok?: boolean
          file?: UploadedFile
          ingested?: boolean
          chunkCount?: number
          ingestError?: string
          reason?: string
          error?: string
        } | null = null
        let fallbackError = ""

        if (contentType.includes("application/json")) {
          payload = (await response.json()) as {
            ok?: boolean
            file?: UploadedFile
            ingested?: boolean
            chunkCount?: number
            ingestError?: string
            reason?: string
            error?: string
          }
        } else {
          const raw = await response.text()
          fallbackError = raw
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 220)
        }

        if (!response.ok || !payload?.ok || !payload?.file) {
          if (response.status === 413) {
            throw new Error("File exceeds upload size limit.")
          }

          if (response.status === 401 || response.status === 403) {
            throw new Error("Upload unauthorized. Refresh and sign in again.")
          }

          if (response.redirected && !contentType.includes("application/json")) {
            throw new Error("Upload request was redirected. Refresh and sign in again.")
          }

          throw new Error(
            payload?.error ||
              payload?.reason ||
              fallbackError ||
              `Upload failed (HTTP ${response.status}).`,
          )
        }

        uploaded.push({
          ...payload.file,
          ingested: payload.ingested,
          chunkCount: payload.chunkCount ?? payload.file.chunkCount,
          ingestError: payload.ingestError,
          status: payload.ingested ? "indexed" : payload.file.status,
          indexingMessage: payload.ingested ? "Indexed for retrieval" : payload.ingestError || payload.file.indexingMessage,
        })

        if (!payload.ingested && payload.file.status === "failed") {
          failed.push({
            name: payload.file.name,
            reason: payload.ingestError || payload.reason || "Unknown ingestion failure",
          })
        }
      } catch (error) {
        const safeReason = error instanceof Error && error.message ? error.message : "Upload request failed."
        failed.push({
          name: file.name,
          reason: safeReason,
        })
      }
    }

    if (uploaded.length > 0) {
      setUploadedFiles((prev) => [...prev, ...uploaded])
      const indexedCount = uploaded.filter((item) => item.status === "indexed").length
      const failedCount = uploaded.filter((item) => item.status === "failed").length
      const uploadedOnlyCount = uploaded.filter((item) => item.status === "uploaded").length
      setUploadMessage(
        `${uploaded.length} file(s) processed: indexed ${indexedCount}, uploaded ${uploadedOnlyCount}, failed ${failedCount}.`,
      )
      await refreshRagStatus()
    }

    if (failed.length > 0) {
      const details = failed.map((item) => `${item.name}: ${item.reason}`).join(" | ")
      setUploadMessage(`Some uploads failed: ${details}`)
    }

    setIsUploading(false)
  }

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files ? Array.from(event.target.files) : []
    await uploadSelectedFiles(selected)
    event.target.value = ""
  }

  const handleComposerPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(event.clipboardData?.items || [])
    const pastedImages = items
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)

    if (pastedImages.length === 0) {
      return
    }

    setUploadMessage(`Uploading ${pastedImages.length} pasted image(s)...`)
    void uploadSelectedFiles(pastedImages)
  }

  const submitChat = async (mode: ChatMode, rawText?: string) => {
    if (isLoading) {
      return
    }

    const submittedText = (rawText ?? inputMessage).trim()
    if (!submittedText) {
      setUiMessage("Type a message before sending.")
      return
    }

    setUiMessage("")
    setLastFailedSubmission(null)
    setActiveMode(mode)
    setInputMessage("")
    setOrbState("thinking")

    let sessionId = activeSessionId

    if (!sessionId) {
      try {
        const response = await fetch("/api/chats", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title: "New Chat" }),
        })

        const payload = (await response.json()) as {
          ok?: boolean
          session?: ChatSession
          error?: string
        }

        if (!response.ok || !payload.ok || !payload.session) {
          throw new Error(payload.error || "Could not create chat session.")
        }

        sessionId = payload.session.id
        setActiveSessionId(payload.session.id)
        setSessions((prev) => [payload.session!, ...prev])
      } catch (error) {
        const safe = error instanceof Error ? error.message : "Could not create chat session."
        setUiMessage(safe)
        setInputMessage(submittedText)
        setOrbState("error")
        return
      }
    }

    const optimisticUserMessage: ChatMessage = {
      id: makeId(),
      role: "user",
      text: submittedText,
      mode,
      timestamp: new Date().toISOString(),
      model: selectedModel,
    }

    setMessages((prev) => [...prev, optimisticUserMessage])
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: submittedText,
          mode,
          model: selectedModel,
          sessionId,
          attachments: uploadedFiles.map((file) => ({
            id: file.id,
            name: file.name,
            size: file.size,
            type: file.type,
            storedPath: file.storedPath,
          })),
          options: {
            responseStyle,
            includeExecutionSteps,
            useUploadedContext,
          },
        }),
      })

      const payload = (await response.json()) as {
        ok?: boolean
        message?: string
        error?: string
        model?: string
        sessionId?: string
        sources?: Array<{ documentName: string; content: string; score?: number }>
      }

      if (!response.ok || !payload.ok || !payload.message) {
        throw new Error(payload.error || "Request failed.")
      }

      const assistantText =
        mode === "image_prompt" && !payload.message.trim().toLowerCase().startsWith("image prompt:")
          ? `Image prompt:\n${payload.message}`
          : payload.message

      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          text: assistantText,
          mode,
          timestamp: new Date().toISOString(),
          model: payload.model || selectedModel,
          sources: payload.sources,
        },
      ])

      const nextSessionId = payload.sessionId || sessionId
      if (nextSessionId) {
        setActiveSessionId(nextSessionId)
      }

      await refreshSessions(nextSessionId)

      if (payload.sources && payload.sources.length > 0) {
        setOrbState("retrieving")
        window.setTimeout(() => setOrbState("idle"), 900)
      } else {
        setOrbState("idle")
      }
    } catch (error) {
      const safe = error instanceof Error ? error.message : "Chat request failed."
      setUiMessage(`${safe} Retry when ready.`)
      setLastFailedSubmission({ mode, text: submittedText })
      setInputMessage(submittedText)
      setOrbState("error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickAction = (prompt: string) => {
    setActiveMode("chat")
    setInputMessage(prompt)
    composerInputRef.current?.focus()
    setUiMessage("Prompt starter inserted. Edit if needed, then send.")
  }

  const removeAttachment = (id: string) => {
    setUploadedFiles((prev) => prev.filter((item) => item.id !== id))
  }

  const buildMarkdownExport = () => {
    const lines = ["# AEON Ops Chat Export", "", `Generated: ${new Date().toISOString()}`, ""]

    for (const item of messages) {
      lines.push(`## ${item.role === "user" ? "User" : item.role === "assistant" ? "Assistant" : "System"} (${MODE_LABEL[item.mode]})`)
      lines.push(item.text)
      lines.push("")
    }

    return lines.join("\n")
  }

  const buildShareText = () => {
    return messages
      .map((item) => `${item.role === "user" ? "User" : item.role === "assistant" ? "Assistant" : "System"} [${MODE_LABEL[item.mode]}]:\n${item.text}`)
      .join("\n\n")
  }

  const triggerDownload = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const exportMarkdown = () => {
    if (messages.length === 0) {
      setUiMessage("No chat to export.")
      return
    }

    triggerDownload("aeon-chat.md", buildMarkdownExport(), "text/markdown")
    setExportDropdownOpen(false)
  }

  const exportJson = () => {
    if (messages.length === 0) {
      setUiMessage("No chat to export.")
      return
    }

    triggerDownload("aeon-chat.json", JSON.stringify(messages, null, 2), "application/json")
    setExportDropdownOpen(false)
  }

  const copyShareableText = async () => {
    if (messages.length === 0) {
      setUiMessage("No chat to share yet.")
      return
    }

    try {
      await navigator.clipboard.writeText(buildShareText())
      setUiMessage("Shareable text copied.")
      setExportDropdownOpen(false)
    } catch {
      setUiMessage("Clipboard copy failed in this browser.")
    }
  }

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chats/${sessionId}`, {
        method: "DELETE",
      })

      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not delete chat.")
      }

      const remaining = sessions.filter((session) => session.id !== sessionId)
      setSessions(remaining)

      if (activeSessionId === sessionId) {
        const next = remaining[0]?.id || null
        setActiveSessionId(next)
        if (!next) {
          setMessages([])
        }
      }
    } catch (error) {
      const safe = error instanceof Error ? error.message : "Could not delete chat."
      setUiMessage(safe)
    }
  }

  const sidebarPanel = (
    <aside
      className="h-full w-[300px] border-r border-border/40 bg-background/80 backdrop-blur-sm transition-all duration-200"
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-border/40 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">AEON Ops</p>
              {!sidebarCollapsed && <p className="text-xs text-muted-foreground">Private Workspace</p>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                if (isMobile) {
                  setMobileSidebarOpen(false)
                  return
                }
                setSidebarCollapsed((prev) => !prev)
              }}
              aria-label={isMobile ? "Close sidebar" : sidebarIsCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isMobile ? <X className="h-4 w-4" /> : sidebarIsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          <Button
            className="h-10 w-full justify-start gap-2"
            onClick={() => {
              void createNewChat().catch((error) => {
                const safe = error instanceof Error ? error.message : "Could not create chat."
                setUiMessage(safe)
              })
            }}
          >
            <FileText className="h-4 w-4" />
            {!sidebarIsCollapsed && "New Chat"}
          </Button>

          {!sidebarIsCollapsed && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/50 px-2 py-1.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={sessionSearch}
                onChange={(event) => setSessionSearch(event.target.value)}
                placeholder="Search chats"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {visibleSessions.length === 0 && !sidebarIsCollapsed ? (
              <div className="rounded-md border border-dashed border-border/50 p-3 text-xs text-muted-foreground">
                No chats yet. Start with New Chat.
              </div>
            ) : (
              visibleSessions.map((session) => {
                const isActive = session.id === activeSessionId
                return (
                  <div
                    key={session.id}
                    className={`group rounded-lg border p-2 transition ${
                      isActive ? "border-primary/50 bg-primary/10" : "border-border/40 hover:border-border/70 hover:bg-secondary/30"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => {
                        setActiveSessionId(session.id)
                        setMobileSidebarOpen(false)
                      }}
                    >
                      <p className={`truncate text-sm ${isActive ? "font-semibold" : "font-medium"}`}>
                        {sidebarIsCollapsed ? "Chat" : session.title}
                      </p>
                      {!sidebarIsCollapsed && (
                        <>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {stripPreview(session.lastMessagePreview) || "No messages yet"}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{formatRelativeTime(session.updatedAt)}</p>
                        </>
                      )}
                    </button>
                    {!sidebarIsCollapsed && (
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          onClick={() => {
                            void deleteSession(session.id)
                          }}
                          aria-label="Delete chat"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {sidebarIsCollapsed ? (
          <div className="border-t border-border/40 p-3">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-9 w-9">
                {profileImage ? <AvatarImage src={profileImage} alt={profileName} /> : null}
                <AvatarFallback>{profileInitials}</AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => router.push("/settings")}
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => router.push("/admin")}
                aria-label="Admin"
              >
                <Shield className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  void signOut({ callbackUrl: "/login" })
                }}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t border-border/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">RAG Status</p>
            <p className="mt-1">Indexed docs: {ragStatus.indexedDocuments}</p>
            <p>Chunks: {ragStatus.chunks}</p>
            <p>Total docs: {ragStatus.documents}</p>

            <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">ZITADEL Profile</p>
              <div className="mt-2 flex items-start gap-2">
                <Avatar className="h-9 w-9">
                  {profileImage ? <AvatarImage src={profileImage} alt={profileName} /> : null}
                  <AvatarFallback>{profileInitials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{profileName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{profileEmail}</p>
                </div>
              </div>
              <Button
                variant="secondary"
                className="mt-2 h-8 w-full justify-start gap-2 text-xs"
                onClick={() => router.push("/settings")}
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Button>
              <Button
                variant="secondary"
                className="mt-2 h-8 w-full justify-start gap-2 text-xs"
                onClick={() => router.push("/admin")}
              >
                <Shield className="h-3.5 w-3.5" />
                Admin Portal
              </Button>
              <Button
                variant="secondary"
                className="mt-2 h-8 w-full justify-start gap-2 text-xs"
                onClick={() => {
                  void signOut({ callbackUrl: "/login" })
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                Log Out
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )

  return (
    <main className="relative flex min-h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />
      <div className="absolute inset-0 opacity-[0.15] grid-background" />

      <div className="relative z-10 flex w-full">
        <div
          className={`hidden overflow-hidden border-r border-border/40 transition-[width] duration-200 md:block ${
            sidebarIsCollapsed ? "w-0 border-r-0" : "w-[300px]"
          }`}
        >
          {sidebarPanel}
        </div>

        <section className="flex min-h-[100dvh] min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-2 border-b border-border/50 bg-background/40 px-3 py-2.5 backdrop-blur-sm sm:px-6">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="hidden h-9 w-9 md:flex"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                aria-label={sidebarIsCollapsed ? "Open chat sidebar" : "Close chat sidebar"}
              >
                {sidebarIsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>

              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 md:hidden"
                onClick={() => {
                  setMobileSidebarOpen(true)
                }}
                aria-label="Open chat sidebar"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div>
                <p className="text-sm font-medium text-foreground">AEON Control Surface</p>
                <p className="text-xs text-muted-foreground">Private Business Intelligence Workspace</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button className="h-9 gap-2" onClick={() => setToolsOpen(true)}>
                <FileText className="h-4 w-4" />
                Tools
              </Button>

              <Button className="h-9 gap-2" onClick={() => router.push("/settings")}>
                <Settings className="h-4 w-4" />
                Settings
              </Button>

              <Button className="h-9 gap-2" onClick={() => router.push("/admin") }>
                <Shield className="h-4 w-4" />
                Admin
              </Button>

              <div ref={exportMenuRef} className="relative">
                <Button className="h-9 gap-2" onClick={() => setExportDropdownOpen((prev) => !prev)}>
                  <Upload className="h-4 w-4" />
                  Export
                </Button>

                {exportDropdownOpen && (
                  <div className="dropdown-menu right-0">
                    <button className="dropdown-item" onClick={exportMarkdown}>
                      Export as Markdown
                    </button>
                    <button className="dropdown-item" onClick={exportJson}>
                      Export as JSON
                    </button>
                    <button className="dropdown-item" onClick={() => void copyShareableText()}>
                      Copy shareable text
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
            <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 bg-background/70">
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-2 sm:px-4 sm:pb-4 sm:pt-4">
              {messages.length === 0 ? (
                <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-8 text-center sm:py-12">
                  <div className="relative mb-4 w-full max-w-[120px] sm:mb-5 sm:max-w-[168px]">
                    <ParticleOrb state={currentOrbState} />
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">AEON Ops Private Workspace</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                    Your private operations intelligence workspace for business documents, repo context, and execution planning.
                  </p>

                  <div className="mt-6 grid w-full max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      variant="secondary"
                      className="h-10 w-full justify-start gap-2"
                      onClick={() => handleQuickAction("What documents are currently indexed in the knowledge base?")}
                    >
                      <Search className="h-4 w-4" />
                      Ask about business docs
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-10 w-full justify-start gap-2"
                      onClick={() => handleQuickAction("Check Drive ingestion coverage and report current indexed status.")}
                    >
                      <Upload className="h-4 w-4" />
                      Check Drive ingestion
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-10 w-full justify-start gap-2"
                      onClick={() => handleQuickAction("Summarize the latest files that were indexed and what they contain.")}
                    >
                      <FileText className="h-4 w-4" />
                      Summarize latest files
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-10 w-full justify-start gap-2"
                      onClick={() => handleQuickAction("Plan the next execution step based on current project state.")}
                    >
                      <Lightbulb className="h-4 w-4" />
                      Plan next execution step
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-10 w-full justify-start gap-2 sm:col-span-2"
                      onClick={() => handleQuickAction("Audit repo status, recent changes, and immediate risks.")}
                    >
                      <ImageIcon className="h-4 w-4" />
                      Audit repo status
                    </Button>
                  </div>
                </div>
              ) : (
                <ul className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-5 sm:py-6">
                  {messages.map((item) => {
                    const isUser = item.role === "user"
                    const isAssistant = item.role === "assistant"

                    return (
                      <li key={item.id} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[85%] ${
                            isUser
                              ? "bg-primary text-primary-foreground"
                              : isAssistant
                                ? "border border-border/60 bg-secondary/35 text-foreground"
                                : "border border-amber-500/40 bg-amber-500/10 text-foreground"
                          }`}
                        >
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {item.role} · {MODE_LABEL[item.mode]}
                          </p>
                          <p className="whitespace-pre-wrap break-words">{item.text}</p>

                          {item.sources && item.sources.length > 0 && (
                            <div className="mt-3 rounded-xl border border-border/50 bg-background/50 p-2.5">
                              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                                Retrieved Sources ({item.sources.length})
                              </p>
                              <ul className="space-y-1">
                                {item.sources.slice(0, 4).map((source, sourceIndex) => (
                                  <li key={`${item.id}-source-${sourceIndex}`} className="text-xs text-muted-foreground">
                                    {source.documentName}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}

                  {isLoading && (
                    <li className="flex w-full justify-start">
                      <div className="max-w-[85%] rounded-2xl border border-border/60 bg-secondary/35 px-4 py-3 text-sm text-muted-foreground">
                        AEON is thinking...
                      </div>
                    </li>
                  )}

                  <li aria-hidden="true" className="h-1" ref={threadEndRef} />
                </ul>
              )}
            </div>

              <div className="z-20 shrink-0 border-t border-border/40 bg-background/70 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:px-6 sm:pb-4">
              {isListening && (
                <div className="mb-3 w-full rounded-2xl border border-border/50 bg-gradient-to-r from-black/90 via-black/95 to-black/90 px-4 py-3 shadow-2xl sm:rounded-full sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-6">
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                      <p className="text-sm font-medium text-foreground">Listening...</p>
                    </div>

                    <div className="flex h-10 min-w-0 flex-1 items-center justify-center gap-[2px] overflow-hidden">
                      {[...Array(waveBarCount)].map((_, i) => (
                        <div
                          key={i}
                          className="voice-wave-bar-horizontal shrink-0 rounded-full bg-foreground/70"
                          style={{
                            width: "2px",
                            animationDelay: `${-i * 0.03}s`,
                            animationDirection: "reverse",
                          }}
                        />
                      ))}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" onClick={() => stopListening(true)}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="icon" className="h-11 w-11 rounded-full" onClick={() => stopListening(false)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4 py-1 sm:py-2">
                  <textarea
                    ref={composerInputRef}
                    placeholder="Ask AEON anything..."
                    value={inputMessage}
                    onChange={(event) => setInputMessage(event.target.value)}
                    onPaste={handleComposerPaste}
                    onKeyDown={(event) => {
                      if (!isMobile && event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        void submitChat("chat")
                      }
                    }}
                    className="min-h-[96px] w-full resize-none border-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:min-h-[84px]"
                  />

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Mode: {MODE_LABEL[activeMode]}</span>
                    <span>·</span>
                    <label className="flex items-center gap-2">
                      <span>AEON Engine</span>
                      <select
                        value={selectedModel}
                        onChange={(event) => setSelectedModel(event.target.value)}
                        className="h-8 rounded-md border border-border/50 bg-background/70 px-2 text-xs text-foreground"
                      >
                        {models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {uploadedFiles.map((file) => (
                        <div key={file.id} className="flex items-center gap-2 rounded-full border border-border/50 px-3 py-1 text-xs">
                          <span>{file.name}</span>
                          <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 ${
                              file.status === "indexed"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : file.status === "failed"
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-secondary/40 text-muted-foreground"
                            }`}
                          >
                            {file.status || "uploaded"}
                          </span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => removeAttachment(file.id)}
                            aria-label={`Remove ${file.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(uiMessage || uploadMessage || voiceMessage || isRequestingMic || isUploading || lastFailedSubmission) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {isRequestingMic
                          ? "Requesting microphone permission..."
                          : isUploading
                            ? "Uploading file..."
                            : uiMessage || uploadMessage || voiceMessage}
                      </span>
                      {lastFailedSubmission && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            void submitChat(lastFailedSubmission.mode, lastFailedSubmission.text)
                          }}
                          disabled={isLoading}
                        >
                          Retry last send
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t border-border/30 pt-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept=".pdf,.txt,.md,.json,.csv,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif"
                        onChange={(event) => {
                          void handleFileInputChange(event)
                        }}
                      />
                      <Button variant="ghost" size="sm" className="min-h-11 gap-2 px-3" onClick={() => fileInputRef.current?.click()}>
                        <Paperclip className="h-4 w-4" />
                        Attach
                      </Button>

                      <Button variant="ghost" size="sm" className="min-h-11 gap-2 px-3" onClick={() => router.push("/settings")}>
                        <Settings className="h-4 w-4" />
                        Settings
                      </Button>

                      <div ref={optionsMenuRef} className="relative">
                        <Button variant="ghost" size="sm" className="min-h-11 gap-2 px-3" onClick={() => setOptionsMenuOpen((prev) => !prev)}>
                          Options
                        </Button>

                        {optionsMenuOpen && (
                          <div className="dropdown-menu left-0">
                            <button className="dropdown-item" onClick={() => setResponseStyle("balanced")}>
                              Response mode: Balanced {responseStyle === "balanced" ? "(active)" : ""}
                            </button>
                            <button className="dropdown-item" onClick={() => setResponseStyle("direct")}>
                              Response mode: Direct {responseStyle === "direct" ? "(active)" : ""}
                            </button>
                            <button className="dropdown-item" onClick={() => setResponseStyle("detailed")}>
                              Response mode: Detailed {responseStyle === "detailed" ? "(active)" : ""}
                            </button>
                            <button className="dropdown-item" onClick={() => setIncludeExecutionSteps((prev) => !prev)}>
                              Include execution steps: {includeExecutionSteps ? "on" : "off"}
                            </button>
                            <button className="dropdown-item" onClick={() => setUseUploadedContext((prev) => !prev)}>
                              Use uploaded context: {useUploadedContext ? "enabled" : "off"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-11 w-11 ${isListening ? "bg-primary/20 ring-1 ring-primary/60" : ""}`}
                        aria-label={isListening ? "Stop voice input" : "Start voice input"}
                        onClick={() => {
                          if (isListening) {
                            stopListening(false)
                            return
                          }

                          void startVoiceInput()
                        }}
                      >
                        <Mic className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="h-11 w-11 rounded-full"
                        onClick={() => void submitChat("chat")}
                        aria-label="Send message"
                        disabled={isLoading || inputMessage.trim().length === 0}
                      >
                        <ArrowUp className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div
        className={`fixed inset-0 z-50 transition-opacity duration-200 md:hidden ${
          mobileSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!mobileSidebarOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/60"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close sidebar backdrop"
          tabIndex={mobileSidebarOpen ? 0 : -1}
        />
        <div
          className={`absolute inset-y-0 left-0 w-[86%] max-w-[320px] transform transition-transform duration-200 ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarPanel}
        </div>
      </div>

      {toolsOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setToolsOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-sm border-l border-border/40 bg-background p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Tools</h2>
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setToolsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mb-3 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void refreshToolsPanel()
                }}
              >
                Refresh
              </Button>
            </div>

            <div className="space-y-2">
              {toolPanelItems.map((item) => (
                <div key={item.key} className="rounded-lg border border-border/40 bg-secondary/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.label}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                        item.state === "enabled"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : item.state === "disabled"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-secondary/60 text-muted-foreground"
                      }`}
                    >
                      {item.state === "coming_soon" ? "coming soon" : item.state}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

    </main>
  )
}
