import { addConfigListener } from '@/_helpers/config-manager'
import {
  addActiveProfileListener,
  createProfileIDListStream
} from '@/_helpers/profile-manager'
import {
  isPopupPage,
  isQuickSearchPage,
  isOptionsPage,
  isStandalonePage
} from '@/_helpers/saladict'
import { message } from '@/_helpers/browser-api'
import { PreloadSource } from '@/app-config'
import { Dispatch } from 'redux'
import { Word, newWord } from '@/_helpers/record-manager'
import { MessageResponse } from '@/typings/message'
import { timer } from '@/_helpers/promise-more'
import { StoreAction, StoreState } from './modules'

export const init = (
  dispatch: Dispatch<StoreAction>,
  getState: () => StoreState
) => {
  window.addEventListener('resize', () => {
    dispatch({ type: 'WINDOW_RESIZE' })
  })

  addConfigListener(({ newConfig }) => {
    if (newConfig.active !== getState().config.active) {
      message.send({
        type: 'SEND_TAB_BADGE_INFO',
        payload: {
          active: newConfig.active,
          tempDisable: getState().isTempDisabled,
          unsupported: isStandalonePage()
            ? false
            : document.body.tagName !== 'BODY'
        }
      })
    }

    dispatch({ type: 'NEW_CONFIG', payload: newConfig })
  })

  addActiveProfileListener(({ newProfile }) => {
    dispatch({ type: 'NEW_ACTIVE_PROFILE', payload: newProfile })
  })

  createProfileIDListStream().subscribe(idlist => {
    dispatch({ type: 'NEW_PROFILES', payload: idlist })
  })

  message.addListener(msg => {
    switch (msg.type) {
      case 'TEMP_DISABLED_STATE':
        if (msg.payload.op === 'set') {
          dispatch({ type: 'TEMP_DISABLED_STATE', payload: msg.payload.value })
          setTimeout(() => {
            const state = getState()
            message.send({
              type: 'SEND_TAB_BADGE_INFO',
              payload: {
                active: state.config.active,
                tempDisable: state.isTempDisabled,
                unsupported: isStandalonePage()
                  ? false
                  : document.body.tagName !== 'BODY'
              }
            })
          }, 0)
          return Promise.resolve(true)
        } else {
          return Promise.resolve(getState().isTempDisabled)
        }

      case 'SEARCH_TEXT_BOX': {
        const { searchHistory, historyIndex, text } = getState()
        dispatch({
          type: 'SEARCH_START',
          payload: {
            word:
              searchHistory[historyIndex]?.text === text
                ? searchHistory[historyIndex]
                : newWord({
                    text,
                    title: 'Saladict',
                    favicon: 'https://saladict.crimx.com/favicon.ico'
                  })
          }
        })
        return isPopupPage() ? Promise.resolve(true) : Promise.resolve()
      }

      case 'ADD_NOTEBOOK': {
        if (msg.payload.popup === isPopupPage()) {
          dispatch({ type: 'ADD_TO_NOTEBOOK' })
          return Promise.resolve(true)
        }
        return
      }

      case 'QS_PANEL_SEARCH_TEXT':
        if (isQuickSearchPage()) {
          // request searching text, from other tabs
          dispatch({ type: 'SEARCH_START', payload: { word: msg.payload } })

          if (getState().isQSFocus) {
            // focus standalone panel
            message.send({ type: 'OPEN_QS_PANEL' })
          }
        }
        return Promise.resolve()

      case 'QS_PANEL_CHANGED':
        if (!isQuickSearchPage()) {
          dispatch({ type: 'QS_PANEL_CHANGED', payload: msg.payload })
        }
        return Promise.resolve()

      case 'QS_PANEL_FOCUSED':
        if (isQuickSearchPage()) {
          const input = document.querySelector<
            HTMLTextAreaElement | HTMLInputElement
          >(
            getState().isExpandMtaBox
              ? '.mtaBox-TextArea'
              : '.menuBar-SearchBox'
          )
          if (input) {
            input.focus()
            input.select()
          }
        }
        return Promise.resolve()

      case 'GET_TAB_BADGE_INFO': {
        const state = getState()
        return Promise.resolve<MessageResponse<'GET_TAB_BADGE_INFO'>>({
          active: state.config.active,
          tempDisable: state.isTempDisabled,
          unsupported: isStandalonePage()
            ? false
            : document.body.tagName !== 'BODY'
        })
      }
    }
  })

  /**
   * Date of last instant capture.
   * To skip extra event after resuming selection
   */
  let lastInstantDate = 0

  message.self.addListener(msg => {
    switch (msg.type) {
      case 'SELECTION':
        if (msg.payload.instant) {
          lastInstantDate = Date.now()
        } else if (Date.now() - lastInstantDate < 500) {
          return Promise.resolve()
        }
        dispatch({ type: 'NEW_SELECTION', payload: msg.payload })
        return Promise.resolve()

      case 'ESCAPE_KEY':
        dispatch({ type: 'CLOSE_PANEL' })
        return Promise.resolve()

      case 'SEARCH_TEXT':
        dispatch({ type: 'SEARCH_START', payload: { word: msg.payload } })
        return Promise.resolve()

      case 'CLOSE_PANEL':
        dispatch({ type: 'CLOSE_PANEL' })
        return Promise.resolve()

      case 'TRIPLE_CTRL':
        if (!isPopupPage() && !isOptionsPage()) {
          const { isShowDictPanel, config, selection } = getState()
          if (config.tripleCtrl) {
            if (config.qsStandalone) {
              // focus if the standalone panel is already opened
              message.send({ type: 'OPEN_QS_PANEL' })
            } else if (!isShowDictPanel) {
              dispatch({ type: 'OPEN_QS_PANEL' })
              summonedPanelInit(
                dispatch,
                selection.word,
                config.qsPreload,
                config.qsAuto,
                ''
              )
            }
          }
        }
        return Promise.resolve()

      case 'UPDATE_WORD_EDITOR_WORD':
        dispatch({ type: 'WORD_EDITOR_STATUS', payload: msg.payload })
        return timer(100).then(() => {
          // wait till snapshot is taken
          dispatch({
            type: 'SEARCH_START',
            payload: { word: msg.payload.word }
          })
        })

      case 'LAST_PLAY_AUDIO':
        return Promise.resolve(getState().lastPlayAudio)
    }
  })

  if (isPopupPage()) {
    const { config, selection } = getState()
    summonedPanelInit(
      dispatch,
      selection.word,
      config.baPreload,
      config.baAuto,
      'popup'
    )
  }

  if (isQuickSearchPage()) {
    const { config, selection } = getState()
    summonedPanelInit(
      dispatch,
      selection.word,
      config.qsPreload,
      config.qsAuto,
      'quick-search'
    )
  } else {
    message
      .send<'QUERY_QS_PANEL'>({ type: 'QUERY_QS_PANEL' })
      .then(response =>
        dispatch({ type: 'QS_PANEL_CHANGED', payload: response })
      )
  }
}

/**
 * Summoned panel could be the dict panel
 * 1. in Standalone Quick Search page.
 * 2. in Popup page (Browser Action).
 * 3. triggered by triple ctrl shortcut.
 */
async function summonedPanelInit(
  dispatch: Dispatch<StoreAction>,
  word: Word | null,
  preload: PreloadSource,
  autoSearch: boolean,
  // quick-search could be turned off so this argument is needed
  standalone: '' | 'popup' | 'quick-search'
) {
  if (!preload) {
    return
  }

  const { searchParams } = new URL(document.URL)

  if (isQuickSearchPage() && !searchParams.get('sidebar')) {
    // pin panel if not sidebar mode
    dispatch({ type: 'TOGGLE_PIN' })
  }

  try {
    if (preload === 'selection') {
      if (standalone === 'popup') {
        const tab = (
          await browser.tabs.query({
            active: true,
            currentWindow: true
          })
        )[0]
        if (tab && tab.id != null) {
          word = await message.send<'PRELOAD_SELECTION'>(tab.id, {
            type: 'PRELOAD_SELECTION'
          })
        }
      } else if (standalone === 'quick-search') {
        const wordString = searchParams.get('word')
        if (wordString) {
          try {
            word = JSON.parse(decodeURIComponent(wordString))
          } catch (err) {
            word = null
          }
        }
      }
    } else if (preload === 'clipboard') {
      const text = await message.send<'GET_CLIPBOARD'>({
        type: 'GET_CLIPBOARD'
      })
      word = newWord({ text, title: 'From Clipboard' })
    }
  } catch (e) {
    if (process.env.DEBUG) {
      console.warn(e)
    }
  }

  if (word) {
    if (autoSearch && word.text) {
      dispatch({ type: 'SEARCH_START', payload: { word } })
    } else {
      dispatch({ type: 'SUMMONED_PANEL_INIT', payload: word.text })
    }
  }
}
