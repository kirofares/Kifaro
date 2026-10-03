import { createContext, useCallback, useContext } from 'react'

export type Lang = 'en' | 'ar'

const LangContext = createContext<Lang>('en')

export const LangProvider = LangContext.Provider

export function useLang() {
  return useContext(LangContext)
}

/** Returns a picker for inline English/Arabic string pairs: tr('Log in', 'تسجيل الدخول'). */
export function useTr() {
  const lang = useLang()
  return useCallback((en: string, ar: string) => (lang === 'ar' ? ar : en), [lang])
}
