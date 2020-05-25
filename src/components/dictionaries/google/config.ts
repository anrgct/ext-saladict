import { DictItem } from '@/app-config/dicts'
import { Language } from '@opentranslate/translator'
import { Subunion } from '@/typings/helpers'

export type GoogleLanguage = Subunion<
  Language,
  'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru' | 'nl'
>

export type GoogleConfig = DictItem<{
  keepLF: 'none' | 'all' | 'webpage' | 'pdf'
  cnfirst: boolean
  concurrent: boolean
  tl: 'default' | GoogleLanguage
  tl2: 'default' | GoogleLanguage
}>

export default (): GoogleConfig => ({
  lang: '11111111',
  selectionLang: {
    english: true,
    chinese: true,
    japanese: true,
    korean: true,
    french: true,
    spanish: true,
    deutsch: true,
    others: true,
    matchAll: false
  },
  defaultUnfold: {
    english: true,
    chinese: true,
    japanese: true,
    korean: true,
    french: true,
    spanish: true,
    deutsch: true,
    others: true,
    matchAll: false
  },
  preferredHeight: 320,
  selectionWC: {
    min: 1,
    max: 999999999999999
  },
  options: {
    keepLF: 'webpage',
    cnfirst: true,
    concurrent: false,
    tl: 'default',
    tl2: 'default'
  },
  options_sel: {
    keepLF: ['none', 'all', 'webpage', 'pdf'],
    tl: [
      'default',
      'zh-CN',
      'zh-TW',
      'en',
      'ja',
      'ko',
      'fr',
      'de',
      'es',
      'ru',
      'nl'
    ],
    tl2: [
      'default',
      'zh-CN',
      'zh-TW',
      'en',
      'ja',
      'ko',
      'fr',
      'de',
      'es',
      'ru',
      'nl'
    ]
  }
})
