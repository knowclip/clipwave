import { MutableRefObject, useState, useCallback, useEffect } from 'react'
import { setCursorX, startMovingCursor, stopMovingCursor } from './utils'
import { usePrevious } from './usePrevious'

export type PlayButtonSync = ReturnType<typeof usePlayButtonSync>

export function usePlayButtonSync(
  pixelsPerSecond: number,
  playerRef: MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>
) {
  const [playing, setPlaying] = useState(false)
  const playMedia = useCallback(() => {
    startMovingCursor(pixelsPerSecond, playerRef)
    setPlaying(true)
  }, [pixelsPerSecond, playerRef])
  const pauseMedia = useCallback(() => {
    stopMovingCursor()
    setPlaying(false)
  }, [])

  const previousPixelsPerSecond = usePrevious(pixelsPerSecond)
  useEffect(() => {
    if (!playing) {
      return
    }
    if (pixelsPerSecond !== previousPixelsPerSecond) {
      stopMovingCursor()
      startMovingCursor(pixelsPerSecond, playerRef)
    }
  }, [playing, previousPixelsPerSecond, pixelsPerSecond, playerRef])

  useEffect(() => {
    const startPlaying = () => {
      playMedia()
    }

    document.addEventListener('play', startPlaying, true)

    return () => document.removeEventListener('play', startPlaying, true)
  }, [playMedia])
  useEffect(() => {
    const stopPlaying = () => pauseMedia()

    document.addEventListener('pause', stopPlaying, true)

    return () => document.removeEventListener('pause', stopPlaying, true)
  }, [pauseMedia])

  const playOrPauseAudio = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    player.paused ? player.play() : player.pause()
  }, [playerRef])

  useEffect(() => {
    const resetPlayButton = () => {
      pauseMedia()
      setCursorX(0)
    }
    document.addEventListener('loadeddata', resetPlayButton, true)
    return () => document.removeEventListener('loadeddata', resetPlayButton)
  }, [pauseMedia])

  return { playOrPauseAudio, playing }
}
