import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import es from './locales/es.json'

/**
 * Traducciones (react-i18next). Equivale a `messages_es.properties` / `messages_en.properties` del backend:
 * los componentes solo conocen CLAVES (`t('login.submit')`), nunca el texto.
 */
export const SUPPORTED_LANGUAGES = ['es', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]
export const LANG_KEY = 'cuartico.lang'

/** CA-21: lo guardado manda; si no hay nada, inglés si el navegador está en `en*`; si no, español. */
export function detectLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(LANG_KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    /* sin almacenamiento: seguimos con el navegador */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : ''
  return nav?.toLowerCase().startsWith('en') ? 'en' : 'es'
}

/** CA-22: cambia todos los textos sin recargar y recuerda la elección. */
export async function changeLanguage(lang: Language) {
  try {
    window.localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* no pasa nada si no se puede guardar */
  }
  await i18n.changeLanguage(lang)
}

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng // los lectores de pantalla pronuncian en el idioma correcto
})

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: detectLanguage(),
  fallbackLng: 'es',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false }, // React ya escapa el texto al pintarlo
})

export default i18n
