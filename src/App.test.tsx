// @vitest-environment jsdom

import { it } from 'vitest'
import React, { useRef } from 'react'
import ReactDOM from 'react-dom'
import { useWaveform } from './useWaveform'
import Waveform from './Waveform'

it('renders without crashing', () => {
  const div = document.createElement('div')
  ReactDOM.render(<App />, div)
  ReactDOM.unmountComponentAtNode(div)
})

const App = () => {
  const waveform = useWaveform({} as any, 'waveform')
  return <Waveform waveform={waveform} images={[]} playerRef={useRef(null)} />
}
