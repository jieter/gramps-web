import {describe, it, expect} from 'vitest'
import {GrampsjsViewPlaces} from '../../src/views/GrampsjsViewPlaces.js'

function makeView() {
  const view = new GrampsjsViewPlaces()
  view.appState = {i18n: {lang: 'nl', strings: {City: 'Stad'}}}
  return view
}

const row = placeType => ({
  gramps_id: 'P1',
  name: {value: 'Leiden'},
  place_type: placeType,
  change: 0,
})

describe('places list', () => {
  it('translates the place type', () => {
    expect(makeView()._formatRow(row('City')).type).toBe('Stad')
  })

  it('keeps a custom place type and an empty one', () => {
    const view = makeView()
    expect(view._formatRow(row('Polder')).type).toBe('Polder')
    expect(view._formatRow(row('')).type).toBe('')
  })

  it('translates the rows again when the translations arrive', () => {
    const view = new GrampsjsViewPlaces()
    const before = {i18n: {lang: 'nl', strings: {}}}
    view.appState = before
    view._rawData = [row('City')]
    view._data = view._formatRows(view._rawData)
    expect(view._data[0].type).toBe('City')
    view.appState = {i18n: {lang: 'nl', strings: {City: 'Stad'}}}
    view.willUpdate(new Map([['appState', before]]))
    expect(view._data[0].type).toBe('Stad')
  })
})
