"use client"

import { useState, useEffect, useCallback, useRef } from "react"

// WebSocket URL for direct connection to Platform
// Set NEXT_PUBLIC_PLATFORM_WS_URL in .env.local (e.g., ws://192.168.100.94:8000)
// Falls back to localhost for local development
function getWebSocketBaseUrl(): string {
    // Check for environment variable first
    if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_PLATFORM_WS_URL) {
        return process.env.NEXT_PUBLIC_PLATFORM_WS_URL
    }
    // Default to localhost
    return "ws://localhost:8000"
}

export interface TickTimerInfo {
    currentTick: number
    tickDurationSeconds: number
    secondsElapsed: number
    secondsRemaining: number
    progressPercent: number
    tickStartedAt: string
    gameStatus: "running" | "paused" | "finished" | "draft"
    serverTime: string
}

export interface ScoreboardEntry {
    team_id: string
    attack_points: number
    defense_points: number
    sla_points: number
    total_points: number
    rank: number
    flags_captured: number
    flags_lost: number
}

export interface GameState {
    gameId: string
    gameName: string
    gameStatus: string
    currentTick: number
    maxTicks: number | null
}

interface WebSocketMessage {
    type: string
    game_id: string
    [key: string]: unknown
}

export interface UseGameWebSocketReturn {
    isConnected: boolean
    isConnecting: boolean
    tickInfo: TickTimerInfo | null
    scoreboard: ScoreboardEntry[]
    gameState: GameState | null
    error: string | null
    reconnect: () => void
    requestScoreboardRefresh: () => void
}

export function useGameWebSocket(gameId: string | null): UseGameWebSocketReturn {
    const [isConnected, setIsConnected] = useState(false)
    const [isConnecting, setIsConnecting] = useState(false)
    const [tickInfo, setTickInfo] = useState<TickTimerInfo | null>(null)
    const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([])
    const [gameState, setGameState] = useState<GameState | null>(null)
    const [error, setError] = useState<string | null>(null)

    const wsRef = useRef<WebSocket | null>(null)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const reconnectAttempts = useRef(0)
    const maxReconnectAttempts = 5
    const baseReconnectDelay = 1000 // 1 second

    const cleanup = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
        }
        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }
        setIsConnected(false)
        setIsConnecting(false)
    }, [])

    const connect = useCallback(() => {
        if (!gameId) return

        cleanup()
        setIsConnecting(true)
        setError(null)

        const wsUrl = `${getWebSocketBaseUrl()}/ws/game/${gameId}`
        console.log(`[WebSocket] Connecting to ${wsUrl}`)

        try {
            const ws = new WebSocket(wsUrl)
            wsRef.current = ws

            ws.onopen = () => {
                console.log("[WebSocket] Connected")
                setIsConnected(true)
                setIsConnecting(false)
                setError(null)
                reconnectAttempts.current = 0
            }

            ws.onmessage = (event) => {
                try {
                    const data: WebSocketMessage = JSON.parse(event.data)
                    handleMessage(data)
                } catch (e) {
                    // Handle non-JSON messages (like "pong")
                    if (event.data !== "pong") {
                        console.warn("[WebSocket] Non-JSON message:", event.data)
                    }
                }
            }

            ws.onerror = (event) => {
                console.error("[WebSocket] Error:", event)
                setError("WebSocket connection error")
            }

            ws.onclose = (event) => {
                console.log(`[WebSocket] Closed: ${event.code} ${event.reason}`)
                setIsConnected(false)
                setIsConnecting(false)
                wsRef.current = null

                // Attempt reconnection with exponential backoff
                if (reconnectAttempts.current < maxReconnectAttempts && gameId) {
                    const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current)
                    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`)
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current++
                        connect()
                    }, delay)
                } else if (reconnectAttempts.current >= maxReconnectAttempts) {
                    setError("Failed to connect after multiple attempts")
                }
            }
        } catch (e) {
            console.error("[WebSocket] Failed to create:", e)
            setError("Failed to create WebSocket connection")
            setIsConnecting(false)
        }
    }, [gameId, cleanup])

    const handleMessage = useCallback((data: WebSocketMessage) => {
        switch (data.type) {
            case "initial":
                // Initial game state on connection
                setGameState({
                    gameId: data.game_id,
                    gameName: data.game_name as string,
                    gameStatus: data.game_status as string,
                    currentTick: data.current_tick as number,
                    maxTicks: data.max_ticks as number | null,
                })
                setTickInfo({
                    currentTick: data.current_tick as number,
                    tickDurationSeconds: data.tick_duration_seconds as number,
                    secondsElapsed: data.seconds_elapsed as number,
                    secondsRemaining: data.seconds_remaining as number,
                    progressPercent: Math.min(100, Math.round(((data.seconds_elapsed as number) / (data.tick_duration_seconds as number)) * 100)),
                    tickStartedAt: data.tick_started_at as string || data.server_time as string,
                    gameStatus: data.game_status as TickTimerInfo["gameStatus"],
                    serverTime: data.server_time as string,
                })
                break

            case "scoreboard":
                // Full scoreboard update
                setScoreboard(data.entries as ScoreboardEntry[])
                break

            case "tick_timer":
                // Periodic tick timer update (every second)
                setTickInfo({
                    currentTick: data.current_tick as number,
                    tickDurationSeconds: data.tick_duration_seconds as number,
                    secondsElapsed: data.seconds_elapsed as number,
                    secondsRemaining: data.seconds_remaining as number,
                    progressPercent: data.progress_percent as number,
                    tickStartedAt: data.tick_started_at as string,
                    gameStatus: data.game_status as TickTimerInfo["gameStatus"],
                    serverTime: data.server_time as string,
                })
                break

            case "tick_change":
                // New tick started
                setTickInfo((prev) => prev ? {
                    ...prev,
                    currentTick: data.new_tick as number,
                    secondsElapsed: 0,
                    secondsRemaining: data.tick_duration_seconds as number,
                    progressPercent: 0,
                } : null)
                if (gameState) {
                    setGameState({
                        ...gameState,
                        currentTick: data.new_tick as number,
                    })
                }
                break

            case "scoreboard_update":
                // Incremental scoreboard update - trigger full refresh
                requestScoreboardRefresh()
                break

            case "game_state":
                // Game status changed
                setGameState((prev) => prev ? {
                    ...prev,
                    gameStatus: data.status as string,
                    currentTick: data.current_tick as number,
                } : null)
                setTickInfo((prev) => prev ? {
                    ...prev,
                    gameStatus: data.status as TickTimerInfo["gameStatus"],
                } : null)
                break

            case "error":
                console.error("[WebSocket] Server error:", data.message)
                setError(data.message as string)
                break

            default:
                console.log("[WebSocket] Unknown message type:", data.type, data)
        }
    }, [gameState])

    const requestScoreboardRefresh = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send("refresh")
        }
    }, [])

    const reconnect = useCallback(() => {
        reconnectAttempts.current = 0
        connect()
    }, [connect])

    // Setup ping interval to keep connection alive
    useEffect(() => {
        if (!isConnected) return

        const pingInterval = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send("ping")
            }
        }, 30000) // Ping every 30 seconds

        return () => clearInterval(pingInterval)
    }, [isConnected])

    // Connect when gameId changes
    useEffect(() => {
        if (gameId) {
            connect()
        } else {
            cleanup()
            setTickInfo(null)
            setScoreboard([])
            setGameState(null)
        }

        return cleanup
    }, [gameId, connect, cleanup])

    return {
        isConnected,
        isConnecting,
        tickInfo,
        scoreboard,
        gameState,
        error,
        reconnect,
        requestScoreboardRefresh,
    }
}
