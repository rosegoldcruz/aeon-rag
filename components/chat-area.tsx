"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUp,
  Check,
  ChevronDown,
  FileText,
  ImageIcon,
  Lightbulb,
  Menu,
  Mic,
  Paperclip,
  Settings,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ParticleOrb } from "@/components/particle-orb"
import { useIsMobile } from "@/components/ui/use-mobile"

type ChatMode = "chat" | "brainstorm" | "plan" | "image_prompt"
type ResponseStyle = "balanced" | "direct" | "detailed"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  mode: ChatMode
  timestamp: string
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

const MODEL_FALLBACK: ModelOption[] = [
  { id: "gemini-1.5-pro", label: "AEON / Gemini 1.5 Pro" },
  { id: "gemini-1.5-flash", label: "AEON / Gemini 1.5 Flash" },
  { id: "gemini-2.0-flash", label: "AEON / Gemini 2.0 Flash" },
  { id: "gemini-2.5-flash", label: "AEON / Gemini 2.5 Flash" },
]

const MODE_LABEL: Record<ChatMode, string> = {
  chat: "Chat",
  brainstorm: "Brainstorm",
  plan: "Plan",
  image_prompt: "Image prompt",
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

export function ChatArea() {
  const isMobile = useIsMobile()
  const waveBarCount = isMobile ? 28 : 60

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [activeMode, setActiveMode] = useState<ChatMode>("chat")
  const [isLoading, setIsLoading] = useState(false)
  const [uiMessage, setUiMessage] = useState("")

  const [models, setModels] = useState<ModelOption[]>(MODEL_FALLBACK)
  const [selectedModel, setSelectedModel] = useState(MODEL_FALLBACK[0].id)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false)
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [responseStyle, setResponseStyle] = useState<ResponseStyle>("balanced")
  const [includeExecutionSteps, setIncludeExecutionSteps] = useState(true)
  const [useUploadedContext] = useState(false)

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState("")

  const [statusInfo, setStatusInfo] = useState<{
    vertexProjectConfigured: boolean
    vertexLocationConfigured: boolean
    uploadStorage: string
    ragIngestion: string
  }>({
    vertexProjectConfigured: false,
    vertexLocationConfigured: false,
    uploadStorage: "unknown",
    ragIngestion: "coming next",
  })

  const [isListening, setIsListening] = useState(false)
  const [isRequestingMic, setIsRequestingMic] = useState(false)
  const [voiceMessage, setVoiceMessage] = useState("")

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalTranscriptRef = useRef("")
  const baseInputRef = useRef("")
  const heardSpeechRef = useRef(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const modelMenuRef = useRef<HTMLDivElement | null>(null)
  const optionsMenuRef = useRef<HTMLDivElement | null>(null)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLElement | null>(null)

  const selectedModelLabel = useMemo(() => {
    return models.find((item) => item.id === selectedModel)?.label || selectedModel
  }, [models, selectedModel])

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch("/api/models")
        const payload = (await response.json()) as {
          ok?: boolean
          models?: ModelOption[]
          selected?: string
          status?: {
            vertexProjectConfigured?: boolean
            vertexLocationConfigured?: boolean
            uploadStorage?: string
            ragIngestion?: string
          }
        }

        if (response.ok && payload.ok && Array.isArray(payload.models) && payload.models.length > 0) {
          setModels(payload.models)
          setSelectedModel(payload.selected || payload.models[0].id)
        }

        if (payload.status) {
          setStatusInfo({
            vertexProjectConfigured: Boolean(payload.status.vertexProjectConfigured),
            vertexLocationConfigured: Boolean(payload.status.vertexLocationConfigured),
            uploadStorage: payload.status.uploadStorage || "unknown",
            ragIngestion: payload.status.ragIngestion || "coming next",
          })
        }
      } catch {
        setUiMessage("Could not load model metadata. Using defaults.")
      }
    }

    void fetchModels()
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node

      if (modelMenuRef.current && !modelMenuRef.current.contains(target)) {
        setModelDropdownOpen(false)
      }

      if (optionsMenuRef.current && !optionsMenuRef.current.contains(target)) {
        setOptionsMenuOpen(false)
      }

      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setExportDropdownOpen(false)
      }

      if (mobileMenuOpen && headerRef.current && !headerRef.current.contains(target)) {
        setMobileMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return

      setModelDropdownOpen(false)
      setOptionsMenuOpen(false)
      setExportDropdownOpen(false)
      setMobileMenuOpen(false)
      setSettingsOpen(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [mobileMenuOpen])

  const addMessage = (message: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages((prev) => [
      ...prev,
      {
        ...message,
        id: makeId(),
        timestamp: new Date().toISOString(),
      },
    ])
  }

  const callChat = async (mode: ChatMode, text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) {
      if (!trimmed) {
        setUiMessage("Type a message before sending.")
      }
      return
    }

    setUiMessage("")
    setActiveMode(mode)
    addMessage({ role: "user", text: trimmed, mode })
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          mode,
          model: selectedModel,
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
          },
        }),
      })

      const payload = (await response.json()) as {
        ok?: boolean
        message?: string
        error?: string
      }

      if (!response.ok || !payload.ok || !payload.message) {
        throw new Error(payload.error || "Request failed.")
      }

      const assistantText =
        mode === "image_prompt" && !payload.message.trim().toLowerCase().startsWith("image prompt:")
          ? `Image prompt:\n${payload.message}`
          : payload.message

      addMessage({ role: "assistant", text: assistantText, mode })
      setInputMessage("")
    } catch (error) {
      const safe = error instanceof Error ? error.message : "Chat request failed."
      setUiMessage(safe)
    } finally {
      setIsLoading(false)
    }
  }

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
    if (files.length === 0) return

    setIsUploading(true)
    setUploadMessage("")

    const uploaded: UploadedFile[] = []
    const failed: string[] = []

    for (const file of files) {
      const formData = new FormData()
      formData.append("file", file)

      try {
        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        })

        const payload = (await response.json()) as {
          ok?: boolean
          file?: UploadedFile
          error?: string
        }

        if (!response.ok || !payload.ok || !payload.file) {
          throw new Error(payload.error || "Upload failed")
        }

        uploaded.push(payload.file)
      } catch {
        failed.push(file.name)
      }
    }

    if (uploaded.length > 0) {
      setUploadedFiles((prev) => [...prev, ...uploaded])
      setUploadMessage(`${uploaded.length} file(s) uploaded. Retrieval coming next.`)
    }

    if (failed.length > 0) {
      setUploadMessage(`Some uploads failed: ${failed.join(", ")}`)
    }

    setIsUploading(false)
  }

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files ? Array.from(event.target.files) : []
    await uploadSelectedFiles(selected)
    event.target.value = ""
  }

  const handleSend = async () => {
    await callChat("chat", inputMessage)
  }

  const handleBrainstorm = async () => {
    setActiveMode("brainstorm")
    if (!inputMessage.trim()) {
      setUiMessage("What do you want to brainstorm?")
      return
    }

    await callChat("brainstorm", inputMessage)
  }

  const handlePlan = async () => {
    setActiveMode("plan")
    if (!inputMessage.trim()) {
      setUiMessage("What do you want a plan for?")
      return
    }

    await callChat("plan", inputMessage)
  }

  const handleCreateImage = async () => {
    setActiveMode("image_prompt")
    if (!inputMessage.trim()) {
      setInputMessage("Create an image of ")
      setUiMessage("Add your concept and send, or tap Create Image again to generate a prompt.")
      return
    }

    await callChat("image_prompt", inputMessage)
  }

  const removeAttachment = (id: string) => {
    setUploadedFiles((prev) => prev.filter((item) => item.id !== id))
  }

  const clearChat = () => {
    setMessages([])
    setUiMessage("Current chat cleared.")
    setOptionsMenuOpen(false)
    setMobileMenuOpen(false)
  }

  const copyLastResponse = async () => {
    const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant")
    if (!lastAssistant) {
      setUiMessage("No assistant response available yet.")
      return
    }

    try {
      await navigator.clipboard.writeText(lastAssistant.text)
      setUiMessage("Last response copied.")
      setOptionsMenuOpen(false)
    } catch {
      setUiMessage("Clipboard copy failed in this browser.")
    }
  }

  const buildMarkdownExport = () => {
    const lines = ["# AEON Ops Chat Export", "", `Generated: ${new Date().toISOString()}`, ""]

    for (const item of messages) {
      lines.push(`## ${item.role === "user" ? "User" : "Assistant"} (${MODE_LABEL[item.mode]})`)
      lines.push(item.text)
      lines.push("")
    }

    return lines.join("\n")
  }

  const buildShareText = () => {
    return messages
      .map((item) => `${item.role === "user" ? "User" : "Assistant"} [${MODE_LABEL[item.mode]}]:\n${item.text}`)
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

  return (
    <main className="relative flex min-h-[100dvh] flex-1 flex-col overflow-hidden overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="shader-orb shader-orb-1" />
        <div className="shader-orb shader-orb-2" />
        <div className="shader-orb shader-orb-3" />
      </div>

      <div className="absolute inset-0 opacity-[0.15] grid-background" />

      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <header
        ref={headerRef}
        className="relative z-20 flex items-center justify-between gap-2 border-b border-border/50 bg-background/30 px-3 py-3 backdrop-blur-sm sm:px-6 sm:py-4"
      >
        <div ref={modelMenuRef} className="relative">
          <Button
            className="btn-3d btn-glow h-11 max-w-[58vw] gap-2 truncate bg-gradient-to-br from-secondary/90 to-secondary/70 text-foreground shadow-lg backdrop-blur-sm hover:from-secondary/70 hover:to-secondary/50"
            onClick={() => setModelDropdownOpen((prev) => !prev)}
          >
            <span className="truncate">{selectedModelLabel}</span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${modelDropdownOpen ? "rotate-180" : ""}`} />
          </Button>

          {modelDropdownOpen && (
            <div className="dropdown-menu">
              {models.map((model) => (
                <button
                  key={model.id}
                  className="dropdown-item"
                  onClick={() => {
                    setSelectedModel(model.id)
                    setModelDropdownOpen(false)
                  }}
                >
                  {model.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button
            className="btn-3d btn-glow h-11 gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 text-foreground shadow-lg backdrop-blur-sm hover:from-secondary/70 hover:to-secondary/50"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
            Configuration
          </Button>

          <div ref={exportMenuRef} className="relative">
            <Button
              className="btn-3d btn-glow h-11 gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 text-foreground shadow-lg backdrop-blur-sm hover:from-secondary/70 hover:to-secondary/50"
              onClick={() => setExportDropdownOpen((prev) => !prev)}
            >
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
                <button className="dropdown-item" onClick={copyShareableText}>
                  Copy shareable text
                </button>
              </div>
            )}
          </div>
        </div>

        <Button
          variant="secondary"
          size="icon"
          className="btn-3d h-11 w-11 md:hidden"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label="Toggle mobile menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-72 border-l border-border/40 bg-background p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">AEON Ops</h2>
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Button variant="ghost" className="h-11 w-full justify-start" onClick={clearChat}>
                New chat
              </Button>
              <div className="rounded-md border border-border/40 px-3 py-2 text-sm text-muted-foreground">
                Chat history coming next.
              </div>
              <Button
                variant="ghost"
                className="h-11 w-full justify-start"
                onClick={() => {
                  setSettingsOpen(true)
                  setMobileMenuOpen(false)
                }}
              >
                Settings
              </Button>
              <Button
                variant="ghost"
                className="h-11 w-full justify-start"
                onClick={() => {
                  setExportDropdownOpen(true)
                  setMobileMenuOpen(false)
                }}
              >
                Export
              </Button>
              <div className="rounded-md border border-border/40 px-3 py-2 text-sm text-muted-foreground">
                About AEON Ops: private operating intelligence for execution-focused planning and implementation.
              </div>
            </div>
          </aside>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSettingsOpen(false)} />
          <section className="relative w-full max-w-lg rounded-xl border border-border/40 bg-background p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Settings and Configuration</h2>
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setSettingsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 text-sm">
              <p>
                <span className="font-semibold">Current model:</span> {selectedModelLabel}
              </p>
              <p>
                <span className="font-semibold">Vertex project:</span>{" "}
                {statusInfo.vertexProjectConfigured ? "configured" : "not configured"}
              </p>
              <p>
                <span className="font-semibold">Vertex location:</span>{" "}
                {statusInfo.vertexLocationConfigured ? "configured" : "not configured"}
              </p>
              <p>
                <span className="font-semibold">Theme:</span> current theme active
              </p>
              <p>
                <span className="font-semibold">Voice input support:</span> browser-dependent
              </p>
              <p>
                <span className="font-semibold">Upload/storage status:</span>{" "}
                {statusInfo.uploadStorage === "enabled" ? "Knowledge upload enabled" : "Ready on first upload"}
              </p>
              <p>
                <span className="font-semibold">RAG ingestion:</span> {statusInfo.ragIngestion}
              </p>
              <p>
                <span className="font-semibold">App version:</span> v0.1.0
              </p>
            </div>
          </section>
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-6 sm:pb-6 sm:pt-6">
        <div className="relative mb-4 mt-1 w-full max-w-full overflow-visible sm:mb-8 sm:mt-2">
          <ParticleOrb />
        </div>

        <h1 className="mb-5 text-center font-[var(--font-heading)] text-2xl font-semibold tracking-tight text-foreground sm:mb-8 sm:text-4xl">
          Ready to Create Something New?
        </h1>

        <div className="mb-6 grid w-full max-w-4xl grid-cols-1 gap-2 sm:mb-8 sm:grid-cols-3 sm:gap-3">
          <Button
            variant="secondary"
            className="btn-3d btn-glow h-11 w-full gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 font-medium text-foreground shadow-lg backdrop-blur-sm hover:from-secondary/70 hover:to-secondary/50"
            onClick={() => void handleCreateImage()}
          >
            <ImageIcon className="h-4 w-4" />
            Create Image
          </Button>
          <Button
            variant="secondary"
            className="btn-3d btn-glow h-11 w-full gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 font-medium text-foreground shadow-lg backdrop-blur-sm hover:from-secondary/70 hover:to-secondary/50"
            onClick={() => void handleBrainstorm()}
          >
            <Lightbulb className="h-4 w-4" />
            Brainstorm
          </Button>
          <Button
            variant="secondary"
            className="btn-3d btn-glow h-11 w-full gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 font-medium text-foreground shadow-lg backdrop-blur-sm hover:from-secondary/70 hover:to-secondary/50"
            onClick={() => void handlePlan()}
          >
            <FileText className="h-4 w-4" />
            Make a plan
          </Button>
        </div>

        <div className="mb-4 w-full max-w-4xl">
          <div className="max-h-52 overflow-y-auto rounded-xl border border-border/40 bg-background/40 p-3 sm:max-h-72">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet. Use Send or a quick action to start.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-lg border p-3 text-sm ${item.role === "user" ? "border-primary/40 bg-primary/10" : "border-border/40 bg-secondary/20"}`}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.role} · {MODE_LABEL[item.mode]}
                    </p>
                    <p className="whitespace-pre-wrap">{item.text}</p>
                  </article>
                ))}
                {isLoading && <p className="text-sm text-muted-foreground">AEON Ops is thinking...</p>}
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto w-full max-w-4xl">
          {isListening && (
            <div className="input-3d animate-in slide-in-from-bottom-2 mb-3 rounded-2xl border border-border/50 bg-gradient-to-r from-black/90 via-black/95 to-black/90 px-4 py-3 shadow-2xl duration-300 fade-in sm:rounded-full sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-6">
                <div className="flex shrink-0 items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                  <p className="text-sm font-medium text-foreground">Recording...</p>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="btn-3d h-11 w-11 rounded-full bg-secondary/30 text-white hover:bg-destructive/20 hover:text-destructive"
                    onClick={() => stopListening(true)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="btn-3d btn-glow h-11 w-11 rounded-full bg-gradient-to-br from-primary via-gray-900 to-black text-white shadow-xl hover:from-gray-900 hover:to-black"
                    onClick={() => stopListening(false)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="input-3d rounded-2xl border border-border/50 bg-gradient-to-br from-secondary/70 via-secondary/60 to-secondary/50 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <textarea
                  placeholder="Ask Anything..."
                  value={inputMessage}
                  onChange={(event) => setInputMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (!isMobile && event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      void handleSend()
                    }
                  }}
                  className="min-h-[96px] w-full flex-1 resize-none border-none bg-transparent text-base font-normal text-foreground outline-none placeholder:text-muted-foreground sm:min-h-[80px] sm:text-lg"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Mode: {MODE_LABEL[activeMode]}</span>
                <span>·</span>
                <span>Model: {selectedModelLabel}</span>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-2 rounded-full border border-border/50 px-3 py-1 text-xs">
                      <span>{file.name}</span>
                      <span className="text-muted-foreground">{formatBytes(file.size)}</span>
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

              {(uiMessage || uploadMessage || voiceMessage || isRequestingMic || isUploading) && (
                <p className="text-xs text-muted-foreground">
                  {isRequestingMic
                    ? "Requesting microphone permission..."
                    : isUploading
                      ? "Uploading file..."
                      : uiMessage || uploadMessage || voiceMessage}
                </p>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="btn-3d min-h-11 gap-2 px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                    Attach
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="btn-3d min-h-11 gap-2 px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Button>

                  <div ref={optionsMenuRef} className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="btn-3d min-h-11 gap-2 px-3 text-muted-foreground hover:text-foreground"
                      onClick={() => setOptionsMenuOpen((prev) => !prev)}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 3H7V7H3V3Z" fill="currentColor" opacity="0.6" />
                        <path d="M9 3H13V7H9V3Z" fill="currentColor" opacity="0.6" />
                        <path d="M3 9H7V13H3V9Z" fill="currentColor" opacity="0.6" />
                        <path d="M9 9H13V13H9V9Z" fill="currentColor" opacity="0.6" />
                      </svg>
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
                        <button
                          className="dropdown-item"
                          onClick={() => setIncludeExecutionSteps((prev) => !prev)}
                        >
                          Include execution steps: {includeExecutionSteps ? "on" : "off"}
                        </button>
                        <button className="dropdown-item" disabled>
                          Use uploaded context: {useUploadedContext ? "enabled" : "coming soon"}
                        </button>
                        <button className="dropdown-item" onClick={clearChat}>
                          Clear current chat
                        </button>
                        <button className="dropdown-item" onClick={() => void copyLastResponse()}>
                          Copy last response
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`btn-3d h-11 w-11 text-white hover:text-foreground ${isListening ? "bg-primary/20 ring-1 ring-primary/60" : ""}`}
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
                    className="btn-3d btn-glow h-11 w-11 rounded-full bg-gradient-to-br from-primary via-gray-900 to-black text-white shadow-xl hover:from-gray-900 hover:to-black"
                    onClick={() => void handleSend()}
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
    </main>
  )
}