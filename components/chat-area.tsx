"use client"

import {
  ChevronDown,
  Menu,
  Settings,
  Upload,
  Lightbulb,
  FileText,
  ImageIcon,
  Mic,
  ArrowUp,
  Paperclip,
  X,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { ParticleOrb } from "@/components/particle-orb"
import { useIsMobile } from "@/components/ui/use-mobile"

export function ChatArea() {
  const isMobile = useIsMobile()
  const [isRecording, setIsRecording] = useState(false)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [configDropdownOpen, setConfigDropdownOpen] = useState(false)
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const waveBarCount = isMobile ? 28 : 60

  return (
    <main className="relative flex min-h-[100dvh] flex-1 flex-col overflow-hidden overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />

      {/* Animated gradient orbs for shader effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="shader-orb shader-orb-1" />
        <div className="shader-orb shader-orb-2" />
        <div className="shader-orb shader-orb-3" />
      </div>

      {/* Animated grid overlay */}
      <div className="absolute inset-0 opacity-[0.15] grid-background" />

      {/* Noise texture for depth */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-soft-light pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between gap-2 border-b border-border/50 bg-background/30 px-3 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
        <div className="relative">
          <Button
            className="btn-3d btn-glow h-11 max-w-[58vw] gap-2 truncate bg-gradient-to-br from-secondary/90 to-secondary/70 text-foreground shadow-lg backdrop-blur-sm hover:from-secondary/70 hover:to-secondary/50"
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
          >
            <span className="truncate">ChatGPT v4.0</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-300 ${modelDropdownOpen ? "rotate-180" : ""}`}
            />
          </Button>
          {modelDropdownOpen && (
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={() => setModelDropdownOpen(false)}>
                ChatGPT v4.0
              </button>
              <button className="dropdown-item" onClick={() => setModelDropdownOpen(false)}>
                ChatGPT v3.5
              </button>
              <button className="dropdown-item" onClick={() => setModelDropdownOpen(false)}>
                GPT-4 Turbo
              </button>
              <button className="dropdown-item" onClick={() => setModelDropdownOpen(false)}>
                GPT-4 Vision
              </button>
            </div>
          )}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <div className="relative">
            <Button
              className="btn-3d btn-glow h-11 gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 text-foreground shadow-lg backdrop-blur-sm hover:from-secondary/70 hover:to-secondary/50"
              onClick={() => setConfigDropdownOpen(!configDropdownOpen)}
            >
              <Settings className="w-4 h-4" />
              Configuration
            </Button>
            {configDropdownOpen && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={() => setConfigDropdownOpen(false)}>
                  General Settings
                </button>
                <button className="dropdown-item" onClick={() => setConfigDropdownOpen(false)}>
                  API Keys
                </button>
                <button className="dropdown-item" onClick={() => setConfigDropdownOpen(false)}>
                  Preferences
                </button>
                <button className="dropdown-item" onClick={() => setConfigDropdownOpen(false)}>
                  Advanced
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <Button
              className="btn-3d btn-glow h-11 gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 text-foreground shadow-lg backdrop-blur-sm hover:from-secondary/70 hover:to-secondary/50"
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            >
              <Upload className="w-4 h-4" />
              Export
            </Button>
            {exportDropdownOpen && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={() => setExportDropdownOpen(false)}>
                  Export as PDF
                </button>
                <button className="dropdown-item" onClick={() => setExportDropdownOpen(false)}>
                  Export as Markdown
                </button>
                <button className="dropdown-item" onClick={() => setExportDropdownOpen(false)}>
                  Export as JSON
                </button>
                <button className="dropdown-item" onClick={() => setExportDropdownOpen(false)}>
                  Share Link
                </button>
              </div>
            )}
          </div>
        </div>

        <Button
          variant="secondary"
          size="icon"
          className="btn-3d h-11 w-11 md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle mobile menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {mobileMenuOpen && (
          <div className="absolute left-3 right-3 top-full z-30 mt-2 rounded-xl border border-border/40 bg-background/95 p-2 shadow-xl backdrop-blur md:hidden">
            <Button
              variant="ghost"
              className="h-11 w-full justify-start"
              onClick={() => {
                setConfigDropdownOpen((prev) => !prev)
                setExportDropdownOpen(false)
              }}
            >
              <Settings className="h-4 w-4" />
              Configuration
            </Button>
            <Button
              variant="ghost"
              className="h-11 w-full justify-start"
              onClick={() => {
                setExportDropdownOpen((prev) => !prev)
                setConfigDropdownOpen(false)
              }}
            >
              <Upload className="h-4 w-4" />
              Export
            </Button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-6 sm:pb-6 sm:pt-6">
        <div className="relative mb-4 mt-1 w-full max-w-full overflow-visible sm:mb-8 sm:mt-2">
          <ParticleOrb />
        </div>

        {/* Title */}
        <h1 className="mb-5 text-center font-[var(--font-heading)] text-2xl font-semibold tracking-tight text-foreground sm:mb-8 sm:text-4xl">
          Ready to Create Something New?
        </h1>

        {/* Quick Actions */}
        <div className="mb-6 grid w-full max-w-4xl grid-cols-1 gap-2 sm:mb-8 sm:grid-cols-3 sm:gap-3">
          <Button
            variant="secondary"
            className="btn-3d btn-glow h-11 w-full gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 font-medium text-foreground shadow-lg backdrop-blur-sm hover:from-secondary/70 hover:to-secondary/50"
          >
            <ImageIcon className="w-4 h-4" />
            Create Image
          </Button>
          <Button
            variant="secondary"
            className="btn-3d btn-glow h-11 w-full gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 font-medium text-foreground shadow-lg backdrop-blur-sm hover:from-secondary/70 hover:to-secondary/50"
          >
            <Lightbulb className="w-4 h-4" />
            Brainstorm
          </Button>
          <Button
            variant="secondary"
            className="btn-3d btn-glow h-11 w-full gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 font-medium text-foreground shadow-lg backdrop-blur-sm hover:from-secondary/70 hover:to-secondary/50"
          >
            <FileText className="w-4 h-4" />
            Make a plan
          </Button>
        </div>

        {/* Input Area */}
        <div className="mt-auto w-full max-w-4xl">
          {isRecording && (
            <div className="input-3d animate-in slide-in-from-bottom-2 mb-3 rounded-2xl border border-border/50 bg-gradient-to-r from-black/90 via-black/95 to-black/90 px-4 py-3 shadow-2xl duration-300 fade-in sm:rounded-full sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-6">
                {/* Left: Recording indicator */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <p className="text-sm font-medium text-foreground">Recording...</p>
                </div>

                {/* Center: Voice wave animation spanning full width */}
                <div className="flex h-10 min-w-0 flex-1 items-center justify-center gap-[2px] overflow-hidden">
                  {[...Array(waveBarCount)].map((_, i) => (
                    <div
                      key={i}
                      className="voice-wave-bar-horizontal bg-foreground/70 rounded-full shrink-0"
                      style={{
                        width: "2px",
                        animationDelay: `${-i * 0.03}s`,
                        animationDirection: "reverse",
                      }}
                    />
                  ))}
                </div>

                {/* Right: Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="btn-3d h-11 w-11 rounded-full bg-secondary/30 text-white hover:bg-destructive/20 hover:text-destructive"
                    onClick={() => setIsRecording(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="btn-3d btn-glow h-11 w-11 rounded-full bg-gradient-to-br from-primary via-gray-900 to-black text-white shadow-xl hover:from-gray-900 hover:to-black"
                    onClick={() => setIsRecording(false)}
                  >
                    <Check className="w-4 h-4" />
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
                  className="min-h-[96px] w-full flex-1 resize-none border-none bg-transparent text-base font-normal text-foreground outline-none placeholder:text-muted-foreground sm:min-h-[80px] sm:text-lg"
                />
              </div>
              <div className="flex flex-col gap-3 border-t border-border/30 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="btn-3d min-h-11 gap-2 px-3 text-muted-foreground hover:text-foreground"
                  >
                    <Paperclip className="w-4 h-4" />
                    Attach
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="btn-3d min-h-11 gap-2 px-3 text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="btn-3d min-h-11 gap-2 px-3 text-muted-foreground hover:text-foreground"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 3H7V7H3V3Z" fill="currentColor" opacity="0.6" />
                      <path d="M9 3H13V7H9V3Z" fill="currentColor" opacity="0.6" />
                      <path d="M3 9H7V13H3V9Z" fill="currentColor" opacity="0.6" />
                      <path d="M9 9H13V13H9V9Z" fill="currentColor" opacity="0.6" />
                    </svg>
                    Options
                  </Button>
                </div>
                <div className="flex items-center justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="btn-3d h-11 w-11 text-white hover:text-foreground"
                    onClick={() => setIsRecording(true)}
                  >
                    <Mic className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="btn-3d btn-glow h-11 w-11 rounded-full bg-gradient-to-br from-primary via-gray-900 to-black text-white shadow-xl hover:from-gray-900 hover:to-black"
                  >
                    <ArrowUp className="w-5 h-5" />
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
