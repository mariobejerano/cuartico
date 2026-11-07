import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { wakeServer } from '../../api/auth'
import { isApiError } from '../../api/errors'
import { session } from '../../auth/session'
import { useSession } from '../../auth/useSession'
import { Alert } from '../../components/Alert'
import { ErrorAlert } from '../../components/ErrorAlert'
import { messageForError, type UiMessage } from '../../components/errorMessage'
import { BrandMark, Icon } from '../../components/Icon'
import { LanguageSwitch } from '../../components/LanguageSwitch'
import { ServerWakingNotice } from '../../components/ServerWakingNotice'
import { useDocumentTitle } from '../../components/useDocumentTitle'
import { loginSchema, type LoginForm } from './loginSchema'

/**
 * Pantalla de login (HU-01, prototipo docs/design/prototypes/login.html).
 * Solo pinta y recoge datos: la lógica de sesión vive en `auth/session.ts`.
 * Al iniciar sesión no navegamos desde aquí: la guarda `GuestOnly` ve la sesión nueva y redirige (CA-1, CA-6).
 */
export function LoginPage() {
  const { t } = useTranslation()
  useDocumentTitle('login.page_title')
  const sessionState = useSession()
  const [error, setError] = useState<UiMessage | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [hideEndedNotice, setHideEndedNotice] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  // useMutation (TanStack Query): ejecuta la llamada y nos da su estado (`isPending`…) sin escribirlo a mano.
  const login = useMutation({
    mutationFn: (form: LoginForm) => session.login(form.username, form.password),
    onError: (e) => {
      setError(messageForError(e))
      if (isApiError(e) && e.code === 'auth.invalid_credentials') {
        setValue('password', '') // CA-2: se vacía la contraseña, el usuario se conserva
        setFocus('password')
      }
    },
  })

  // Efecto al montar: despertar el servidor (CA-7) y, solo en escritorio, poner el foco en «Usuario».
  useEffect(() => {
    wakeServer()
    if (window.matchMedia?.('(min-width: 768px)').matches) setFocus('username')
  }, [setFocus])

  const onSubmit = (form: LoginForm) => {
    if (login.isPending) return // CA-4: un doble clic no produce dos peticiones
    setError(null)
    setHideEndedNotice(true)
    login.mutate(form)
  }
  const submit = handleSubmit(onSubmit) // CA-3: si Zod falla, onSubmit no se llama (ni la API)

  const busy = login.isPending || isSubmitting // botón deshabilitado desde el primer clic (CA-4)
  const showEnded = sessionState.status === 'anonymous' && sessionState.reason === 'ended' && !hideEndedNotice

  return (
    <div className="login-page">
      <header className="login-top">
        <LanguageSwitch variant="buttons" />
      </header>

      <main className="login-main" id="main">
        <div className="login-card">
          <div className="brand" aria-hidden="true">
            <BrandMark />
            {t('app.name')}
          </div>
          <div className="login-head">
            <h1>{t('login.title')}</h1>
            <p className="muted">{t('login.subtitle')}</p>
          </div>

          <form className="login-form" onSubmit={submit} noValidate>
            <div className="alerts">
              {showEnded && <Alert variant="warning">{t('session.ended')}</Alert>}
              {login.isPending && <ServerWakingNotice />}
              {error && <ErrorAlert message={error} onRetry={() => void submit()} />}
            </div>

            <div className="c-field">
              <label className="c-label" htmlFor="username">
                {t('login.username')}
              </label>
              <input
                id="username"
                className="c-input"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={errors.username ? true : undefined}
                aria-describedby={errors.username ? 'username-error' : undefined}
                {...register('username')}
              />
              {errors.username?.message && (
                <p className="c-error" id="username-error">
                  <Icon name="alert" />
                  <span>{t(errors.username.message)}</span>
                </p>
              )}
            </div>

            <div className="c-field">
              <label className="c-label" htmlFor="password">
                {t('login.password')}
              </label>
              <div className="pw-group">
                <input
                  id="password"
                  className="c-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  aria-controls="password"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {t(showPassword ? 'login.hide_password' : 'login.show_password')}
                </button>
              </div>
              {errors.password?.message && (
                <p className="c-error" id="password-error">
                  <Icon name="alert" />
                  <span>{t(errors.password.message)}</span>
                </p>
              )}
            </div>

            <button className="c-btn c-btn--primary c-btn--block" type="submit" disabled={busy} aria-busy={busy}>
              {busy && <span className="spinner" aria-hidden="true" />}
              <span>{t(busy ? 'login.submitting' : 'login.submit')}</span>
            </button>
          </form>

          <p className="help-foot">{t('login.forgot_help')}</p>
        </div>
      </main>
    </div>
  )
}
