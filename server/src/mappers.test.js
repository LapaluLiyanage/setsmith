import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodeEntities, mapBpmSearch, mapOembed, mapVideo, parseIsoDuration } from './mappers.js'

test('parseIsoDuration', () => {
  assert.equal(parseIsoDuration('PT4M13S'), 253)
  assert.equal(parseIsoDuration('PT1H'), 3600)
  assert.equal(parseIsoDuration('P1D'), null)
})

test('decodeEntities', () => {
  assert.equal(decodeEntities('Rock &amp; Roll &quot;Live&quot; &#39;96'), 'Rock & Roll "Live" \'96')
})

test('mapVideo', () => {
  const item = { id: 'abcdefghijk', snippet: { title: 'Song &amp; Dance', channelTitle: 'Band' }, contentDetails: { duration: 'PT3M5S' } }
  assert.deepEqual(mapVideo(item), { youtubeId: 'abcdefghijk', title: 'Song & Dance', channel: 'Band', durationSec: 185 })
})

test('mapOembed', () => {
  assert.deepEqual(mapOembed('abcdefghijk', { title: 'T', author_name: 'A' }),
    { youtubeId: 'abcdefghijk', title: 'T', channel: 'A', durationSec: null })
})

test('mapBpmSearch handles hits and misses', () => {
  const hit = { search: [{ title: 'Perfect', tempo: '95', key_of: 'A♭', artist: { name: 'Ed Sheeran' } }] }
  assert.deepEqual(mapBpmSearch(hit), [{ title: 'Perfect', artist: 'Ed Sheeran', bpm: 95, key: 'A♭' }])
  assert.deepEqual(mapBpmSearch({ search: { error: 'no result' } }), [])
})
