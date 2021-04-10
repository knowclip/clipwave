import React, { useRef } from 'react'

import { useWaveform, Waveform } from 'clipwave'
import 'clipwave/dist/index.css'

const App = () => {
  const waveform = useWaveform({} as any, {})
  return <Waveform waveform={waveform} images={[]} playerRef={useRef(null)} />
}

export default App
