import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { changeLanguage, SUPPORTED_LANGUAGES, type Language } from '../i18n'

/**
 * Selector de idioma (HU-01 CA-22). Los nombres se muestran en su propio idioma («Español», «English»).
 * - `buttons`: grupo de botones con `aria-pressed` (login, arriba a la derecha).
 * - `select`: desplegable con etiqueta (zona de cuenta).
 */
export function LanguageSwitch({ variant }: { variant: 'buttons' | 'select' }) {
  const { t, i18n } = useTranslation()
  const id = useId()
  const current = i18n.language as Language

  if (variant === 'buttons') {
    return (
      <div className="lang-switch" role="group" aria-label={t('common.language')}>
        {SUPPORTED_LANGUAGES.map((lng) => (
          <button
            key={lng}
            type="button"
            lang={lng}
            aria-pressed={current === lng}
            onClick={() => void changeLanguage(lng)}
          >
            {t(`language.${lng}`)}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="c-field">
      <label className="c-label small" htmlFor={id}>
        {t('common.language')}
      </label>
      <select
        id={id}
        className="c-select"
        value={current}
        onChange={(e) => void changeLanguage(e.target.value as Language)}
      >
        {SUPPORTED_LANGUAGES.map((lng) => (
          <option key={lng} value={lng} lang={lng}>
            {t(`language.${lng}`)}
          </option>
        ))}
      </select>
    </div>
  )
}
