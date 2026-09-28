import { describe, expect, it } from 'vitest'
import { parseIsoDuration, parseYouTubeId } from './youtube'

describe('parseYouTubeId', () => {
  it.each([
    'https://www.youtube.com/watch?v=2Vv-BfVoq4g',
    'https://youtube.com/watch?v=2Vv-BfVoq4g&t=30s',
    'https://youtu.be/2Vv-BfVoq4g?si=abc',
    'https://m.youtube.com/watch?v=2Vv-BfVoq4g',
    'https://music.youtube.com/watch?v=2Vv-BfVoq4g',
    'https://www.youtube.com/shorts/2Vv-BfVoq4g',
    'https://www.youtube.com/embed/2Vv-BfVoq4g',
    'youtu.be/2Vv-BfVoq4g',
    '2Vv-BfVoq4g',
  ])('reads %s', (url) => {
    expect(parseYouTubeId(url)).toBe('2Vv-BfVoq4g')
  })

  it('rejects other sites and junk', () => {
    expect(parseYouTubeId('https://vimeo.com/123456789')).toBeNull()
    expect(parseYouTubeId('hello world')).toBeNull()
  })
})

describe('parseIsoDuration', () => {
  it('converts API durations', () => {
    expect(parseIsoDuration('PT4M13S')).toBe(253)
    expect(parseIsoDuration('PT1H2M')).toBe(3720)
    expect(parseIsoDuration('PT45S')).toBe(45)
  })
})
