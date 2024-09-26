import React, { useEffect, useRef } from 'react'

import { useWaveform, Waveform, WaveformItem } from './index'
import '../dist/index.css'
import { Meta, StoryObj } from '@storybook/react/*'

const meta = {
  title: 'Waveform',
  component: Waveform,
  parameters: {
    layout: 'fullscreen'
  }
} as Meta<typeof Waveform>

export default meta

type Story = StoryObj<typeof meta>

const sortedWaveformItems: WaveformItem[] = [
  {
    clipwaveType: 'Primary',
    id: '1',
    start: 100,
    end: 400
  },
  {
    clipwaveType: 'Secondary',
    id: '2',
    start: 200,
    end: 300
  },
  {
    clipwaveType: 'Primary',
    id: '3',
    start: 500,
    end: 600
  }
]

export const BlankWaveform: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const waveform = useWaveform(
      (id) => sortedWaveformItems.find((item) => item.id === id) || null
    )

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const playerRef = useRef(null)

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const durationSeconds = 60

      waveform.actions.resetWaveformState(
        { duration: durationSeconds } as HTMLAudioElement,
        sortedWaveformItems
      )
    }, [waveform.actions])
    return <Waveform waveform={waveform} images={[]} playerRef={playerRef} />
  }
}
