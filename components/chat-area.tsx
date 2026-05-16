"use client"

import {
  ChevronDown,
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

export function ChatArea() {
  const [isRecording, setIsRecording] = useState(false)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [configDropdownOpen, setConfigDropdownOpen] = useState(false)
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)

  return (
    <main className="flex-1 flex flex-col relative overflow-hidden">
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
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/50 backdrop-blur-sm bg-background/30">
        <div className="relative">
          <Button
            className="btn-3d btn-glow gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 text-foreground hover:from-secondary/70 hover:to-secondary/50 backdrop-blur-sm border border-border/30 shadow-lg"
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
          >
            ChatGPT v4.0
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

        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              className="btn-3d btn-glow gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 text-foreground hover:from-secondary/70 hover:to-secondary/50 backdrop-blur-sm border border-border/30 shadow-lg"
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
              className="btn-3d btn-glow gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 text-foreground hover:from-secondary/70 hover:to-secondary/50 backdrop-blur-sm border border-border/30 shadow-lg"
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
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-6">
        <div className="relative mb-8">
          <ParticleOrb />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-semibold text-foreground mb-8 text-center font-[var(--font-heading)] tracking-tight">
          Ready to Create Something New?
        </h1>

        {/* Quick Actions */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="secondary"
            className="btn-3d btn-glow gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 text-foreground hover:from-secondary/70 hover:to-secondary/50 backdrop-blur-sm shadow-lg font-medium"
          >
            <ImageIcon className="w-4 h-4" />
            Create Image
          </Button>
          <Button
            variant="secondary"
            className="btn-3d btn-glow gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 text-foreground hover:from-secondary/70 hover:to-secondary/50 backdrop-blur-sm shadow-lg font-medium"
          >
            <Lightbulb className="w-4 h-4" />
            Brainstorm
          </Button>
          <Button
            variant="secondary"
            className="btn-3d btn-glow gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 text-foreground hover:from-secondary/70 hover:to-secondary/50 backdrop-blur-sm shadow-lg font-medium"
          >
            <FileText className="w-4 h-4" />
            Make a plan
          </Button>
        </div>

        {/* Input Area */}
        <div className="w-full max-w-4xl">
          {isRecording && (
            <div className="mb-3 input-3d bg-gradient-to-r from-black/90 via-black/95 to-black/90 backdrop-blur-xl rounded-full border border-border/50 px-6 py-3 shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-300">
              <div className="flex items-center justify-between gap-6">
                {/* Left: Recording indicator */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <p className="text-sm font-medium text-foreground">Recording...</p>
                </div>

                {/* Center: Voice wave animation spanning full width */}
                <div className="flex-1 flex items-center justify-center gap-[2px] h-10 overflow-hidden">
                  {[...Array(60)].map((_, i) => (
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
                    className="btn-3d h-8 w-8 rounded-full bg-secondary/30 hover:bg-destructive/20 text-white hover:text-destructive"
                    onClick={() => setIsRecording(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="btn-3d btn-glow h-8 w-8 rounded-full bg-gradient-to-br from-primary via-gray-900 to-black hover:from-gray-900 hover:to-black text-white shadow-xl"
                    onClick={() => setIsRecording(false)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="input-3d bg-gradient-to-br from-secondary/70 via-secondary/60 to-secondary/50 backdrop-blur-xl rounded-2xl border border-border/50 p-4 shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <textarea
                  placeholder="Ask Anything..."
                  className="flex-1 bg-transparent border-none outline-none resize-none text-foreground placeholder:text-muted-foreground text-lg min-h-[80px] font-normal"
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="btn-3d gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Paperclip className="w-4 h-4" />
                    Attach
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="btn-3d gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="btn-3d gap-2 text-muted-foreground hover:text-foreground"
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="btn-3d h-9 w-9 text-white hover:text-foreground"
                    onClick={() => setIsRecording(true)}
                  >
                    <Mic className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="btn-3d btn-glow h-9 w-9 rounded-full bg-gradient-to-br from-primary via-gray-900 to-black hover:from-gray-900 hover:to-black text-white shadow-xl"
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
