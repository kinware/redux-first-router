import createListeners from '../utils/createListeners'
import { createLocation, createKey } from '../utils/location'
import { createPath, stripSlashes } from '../utils/path'

export default class History {
  constructor(opts) {
    const { index, entries, basename, saveHistory } = opts

    this.index = index
    this.entries = entries
    this.basename = basename ? stripSlashes(basename) : ''
    this.saveHistory = saveHistory || function () {}

    this.kind = 'load'
    this.length = entries.length
    this.location = entries[index]

    this.listeners = createListeners()
  }

  // API:

  push(path, state = {}) {
    const key = createKey()
    const location = createLocation(path, state, key, this.location)

    const back = this._isBack(location)
    const next = this._isNext(location)
    const kind = back ? 'back' : next ? 'next' : 'push'

    if (/back|next/.test(kind)) {
      return this.jump(back ? -1 : 1, state)
    }

    const index = back ? this.index - 1 : this.index + 1
    const entries = this._pushToFront(location, this.entries, index, kind)
    const nextState = { kind, location, index, entries }
    const nextHistory = this._createNextHistory(nextState)

    const commit = () => {
      this._pushState(location)
      this._updateHistory(nextState)
    }

    return this.listeners.notify({ history: this, nextHistory, commit })
  }

  redirect(path, state = {}, merge = true) {
    const key = createKey()
    const prevState = merge && this.entries[this.index].state
    const s = { ...prevState, ...state }
    const location = createLocation(path, s, key, this.location)
    const entries = this.entries.slice(0)
    const index = this.index

    entries[index] = location

    const kind = 'redirect'
    const nextState = { kind, location, entries, index }
    const nextHistory = this._createNextHistory(nextState)

    const commit = () => {
      this._replaceState(location)
      this._updateHistory(nextState)
    }

    return this.listeners.notify({ history: this, nextHistory, commit })
  }

  jump(n, state) {
    const kind = n === -1 ? 'back' : n === 1 ? 'next' : 'jump'
    const index = this.index + n
    const entries = this.entries.slice(0)
    const location = { ...this.entries[index] }

    location.state = { ...location.state, ...state }
    entries[index] = location

    const nextState = { kind, location, index, entries }
    const nextHistory = this._createNextHistory(nextState)

    const commit = () => this._replaceState(location, n, this.location).then(() =>
        this._updateHistory(nextState)
      )

    return this.listeners.notify({ history: this, nextHistory, commit })
  }

  back(state) {
    return this.jump(-1, state)
  }

  next(state) {
    return this.jump(1, state)
  }

  canJunp(n) {
    const nextIndex = this.index + n
    return nextIndex >= 0 && nextIndex < this.entries.length
  }

  listen(fn) {
    return this.listeners.add(fn)
  }

  // UTILS:

  _createHref(location) {
    return this.basename + createPath(location)
  }

  _isBack(location) {
    const entry = this.entries[this.index - 1]
    return entry && entry.url === location.url
  }

  _isNext(location) {
    const entry = this.entries[this.index + 1]
    return entry && entry.url === location.url
  }

  _updateHistory(state) {
    Object.assign(this, state)
    this.length = state.entries ? state.entries.length : this.length
    this.saveHistory(this)
  }

  _createNextHistory(state) {
    const next = Object.assign({}, this, state)
    next.length = state.entries ? state.entries.length : this.length
    return next
  }

  _pushToFront(location, prevEntries, index) {
    const entries = prevEntries.slice(0)
    const isBehindHead = entries.length > index
    const entriesToDelete = entries.length - index

    if (isBehindHead) {
      entries.splice(index, entriesToDelete, location)
    }
    else {
      entries.push(location)
    }

    return entries
  }
}
