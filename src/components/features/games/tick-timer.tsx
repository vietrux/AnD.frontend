"use client"

import { cn } from "@/lib/utils"
import { Clock, Pause, Play, Trophy } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import type { TickTimerInfo } from "@/hooks/use-websocket"

interface TickTimerProps {
    tickInfo: TickTimerInfo | null
    maxTicks?: number | null
    className?: string
    variant?: "default" | "compact" | "large"
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
}

function getStatusColor(status: string): string {
    switch (status) {
        case "running":
            return "bg-green-500"
        case "paused":
            return "bg-yellow-500"
        case "finished":
            return "bg-blue-500"
        default:
            return "bg-gray-500"
    }
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
        case "running":
            return "default"
        case "paused":
            return "secondary"
        case "finished":
            return "outline"
        default:
            return "secondary"
    }
}

export function TickTimer({ tickInfo, maxTicks, className, variant = "default" }: TickTimerProps) {
    if (!tickInfo) {
        return (
            <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
                <Clock className="h-4 w-4 animate-pulse" />
                <span className="text-sm">Connecting...</span>
            </div>
        )
    }

    const { currentTick, secondsRemaining, progressPercent, gameStatus, tickDurationSeconds } = tickInfo
    const isRunning = gameStatus === "running"
    const isPaused = gameStatus === "paused"
    const isFinished = gameStatus === "finished"

    // Compact variant - for inline display
    if (variant === "compact") {
        return (
            <div className={cn("flex items-center gap-3", className)}>
                <Badge variant={getStatusBadgeVariant(gameStatus)} className="capitalize">
                    {isPaused && <Pause className="h-3 w-3 mr-1" />}
                    {isRunning && <Play className="h-3 w-3 mr-1" />}
                    {isFinished && <Trophy className="h-3 w-3 mr-1" />}
                    {gameStatus}
                </Badge>
                <span className="text-sm font-medium">
                    Tick {currentTick}{maxTicks ? ` / ${maxTicks}` : ""}
                </span>
                {isRunning && (
                    <span className="text-sm text-muted-foreground">
                        {formatTime(secondsRemaining)} remaining
                    </span>
                )}
            </div>
        )
    }

    // Large variant - for dedicated display
    if (variant === "large") {
        return (
            <div className={cn("rounded-xl border bg-card p-6 shadow-sm", className)}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={cn("h-3 w-3 rounded-full animate-pulse", getStatusColor(gameStatus))} />
                        <h3 className="text-lg font-semibold">Game Status</h3>
                    </div>
                    <Badge variant={getStatusBadgeVariant(gameStatus)} className="capitalize text-sm">
                        {gameStatus}
                    </Badge>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Current Tick</p>
                        <p className="text-3xl font-bold">
                            {currentTick}
                            {maxTicks && (
                                <span className="text-lg text-muted-foreground font-normal"> / {maxTicks}</span>
                            )}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Time Remaining</p>
                        <p className={cn(
                            "text-3xl font-bold font-mono",
                            secondsRemaining <= 10 && isRunning && "text-red-500 animate-pulse"
                        )}>
                            {formatTime(secondsRemaining)}
                        </p>
                    </div>
                </div>

                <div className="mt-4">
                    <div className="flex justify-between text-sm text-muted-foreground mb-2">
                        <span>Tick Progress</span>
                        <span>{progressPercent}%</span>
                    </div>
                    <Progress
                        value={progressPercent}
                        className={cn(
                            "h-3",
                            progressPercent >= 90 && isRunning && "[&>div]:bg-red-500"
                        )}
                    />
                </div>
            </div>
        )
    }

    // Default variant
    return (
        <div className={cn("rounded-lg border bg-card p-4 shadow-sm", className)}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", getStatusColor(gameStatus), isRunning && "animate-pulse")} />
                    <span className="text-sm font-medium capitalize">{gameStatus}</span>
                </div>
                <Badge variant="outline" className="font-mono">
                    Tick {currentTick}{maxTicks ? ` / ${maxTicks}` : ""}
                </Badge>
            </div>

            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className={cn(
                        "text-2xl font-bold font-mono",
                        secondsRemaining <= 10 && isRunning && "text-red-500"
                    )}>
                        {formatTime(secondsRemaining)}
                    </span>
                </div>
                <span className="text-sm text-muted-foreground">
                    of {formatTime(tickDurationSeconds)}
                </span>
            </div>

            <Progress
                value={progressPercent}
                className={cn(
                    "h-2",
                    progressPercent >= 90 && isRunning && "[&>div]:bg-red-500 [&>div]:animate-pulse"
                )}
            />
        </div>
    )
}
