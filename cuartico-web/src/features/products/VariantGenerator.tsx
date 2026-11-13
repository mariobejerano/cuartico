import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { useFocusAfterRender } from '../../components/useFocusAfterRender'
import {
  addColors,
  addSizes,
  cleanPrefix,
  combinations,
  draftsFor,
  firstSimilarColor,
  SIZE_PRESETS,
  splitNew,
  type DraftVariant,
  type VariantOptions,
} from './variants'

const MIN_STOCK_RE = /^\d{1,9}([.,]\d{1,3})?$/

type Axis = 'size' | 'color'

interface VariantGeneratorProps {
  /** Prefijo de los `id` («gen-new», «gen-add»): hay un generador en el alta y otro en «Añadir variantes». */
  idPrefix: string
  /** Combinaciones que ya existen (en el producto o en la lista por guardar): se omiten (CA-8, CA-22). */
  existing: readonly VariantOptions[]
  /** SKU ya usados (para que el sugerido no choque: añade «-2»). */
  takenSkus: readonly string[]
  /** Abreviatura de la unidad («u») junto al mínimo. */
  unitShort: string
  /** Recibe las filas nuevas (solo las que faltan) con su SKU sugerido y el mínimo común. */
  onApply: (rows: DraftVariant[]) => void
}

/**
 * Generador talla × color (HU-16 CA-21, D-2; ux-notes products-v2 §4). Componente CONTROLADO por su propio estado:
 * las etiquetas elegidas, el prefijo y el mínimo viven aquí (no en el formulario del producto: no se envían).
 * Lo que sale hacia fuera es solo el resultado, con `onApply` (como un evento de dominio).
 *
 * Intro nunca envía el formulario que lo rodea: en el alta, el generador está DENTRO del `<form>` del producto.
 * El campo «Tallas» tiene el id `${idPrefix}-size` (`generatorSizeId` en variants.ts): así quien lo usa puede llevar el foco ahí.
 */
export function VariantGenerator({ idPrefix, existing, takenSkus, unitShort, onApply }: VariantGeneratorProps) {
  const { t } = useTranslation()
  const [sizes, setSizes] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [text, setText] = useState<Record<Axis, string>>({ size: '', color: '' })
  const [prefix, setPrefix] = useState('')
  const [min, setMin] = useState('0')
  const focusAfter = useFocusAfterRender()
  const chipLists = { size: useRef<HTMLUListElement>(null), color: useRef<HTMLUListElement>(null) }
  const inputs = { size: useRef<HTMLInputElement>(null), color: useRef<HTMLInputElement>(null) }

  const add = (axis: Axis, value: string) =>
    axis === 'size' ? setSizes((list) => addSizes(list, value)) : setColors((list) => addColors(list, value))

  /** Intro añade lo escrito (y no envía el formulario de fuera). */
  const onKeyDown = (axis: Axis) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    add(axis, text[axis])
    setText((s) => ({ ...s, [axis]: '' }))
  }
  /** Al escribir una coma, lo anterior se convierte en etiqueta («S, M, » → S y M). */
  const onChange = (axis: Axis) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (!value.includes(',')) return setText((s) => ({ ...s, [axis]: value }))
    const parts = value.split(',')
    const rest = parts.pop() ?? ''
    add(axis, parts.join(','))
    setText((s) => ({ ...s, [axis]: rest }))
  }
  const onAddClick = (axis: Axis) => {
    add(axis, text[axis])
    setText((s) => ({ ...s, [axis]: '' }))
    inputs[axis].current?.focus()
  }
  const remove = (axis: Axis, index: number) => {
    const without = (list: string[]) => list.filter((_, i) => i !== index)
    if (axis === 'size') setSizes(without)
    else setColors(without)
    // Tras pintar, el «×» pulsado ya no existe: el foco pasa a la etiqueta siguiente o al campo (no se pierde).
    focusAfter(() => {
      const buttons = chipLists[axis].current?.querySelectorAll('button') ?? []
      return buttons[Math.min(index, buttons.length - 1)] ?? inputs[axis].current
    })
  }
  const togglePreset = (size: string) =>
    setSizes((list) => (list.includes(size) ? list.filter((s) => s !== size) : addSizes(list, size)))

  // Valores DERIVADOS (se recalculan en cada pintada, no son estado): combinaciones, nuevas, omitidas y el aviso de
  // tildes («Marron» junto a «Marrón», ya elegido o ya en el producto; no bloquea).
  const combos = combinations(sizes, colors)
  const { fresh, skipped } = splitNew(combos, existing)
  const similar = firstSimilarColor(colors, existing.map((o) => o.color))

  const apply = () => {
    const minStock = MIN_STOCK_RE.test(min.trim()) ? min.trim() : '0'
    onApply(draftsFor(fresh, { prefix, minStock, takenSkus }))
    setSizes([])
    setColors([])
  }

  const preview =
    combos.length === 0
      ? t('gen.preview_none')
      : [t('gen.preview', { count: fresh.length }), skipped > 0 ? t('gen.preview_skipped', { n: skipped }) : '']
          .filter(Boolean)
          .join(' ')

  const id = (s: string) => `${idPrefix}-${s}`
  const noSubmit = (e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && e.preventDefault()

  const chips = (axis: Axis, list: string[]) => (
    <ul className="chips" ref={chipLists[axis]} aria-label={t(axis === 'size' ? 'gen.chosen_sizes' : 'gen.chosen_colors')}>
      {list.map((v, i) => (
        <li className="chip" key={v}>
          {v}
          <button
            type="button"
            aria-label={t(axis === 'size' ? 'gen.remove_size' : 'gen.remove_color', { v })}
            onClick={() => remove(axis, i)}
          >
            <Icon name="x" />
          </button>
        </li>
      ))}
    </ul>
  )

  const tagField = (axis: Axis) => (
    <div className="tag-row">
      <input
        ref={inputs[axis]}
        className="c-input"
        id={id(axis)}
        maxLength={60}
        autoComplete="off"
        autoCapitalize={axis === 'size' ? 'characters' : undefined}
        enterKeyHint="done"
        aria-describedby={id(`${axis}-help`)}
        value={text[axis]}
        onChange={onChange(axis)}
        onKeyDown={onKeyDown(axis)}
      />
      <button type="button" className="c-btn c-btn--secondary" onClick={() => onAddClick(axis)}>
        {t('gen.add')}
        <span className="sr-only"> {t(axis === 'size' ? 'gen.sizes' : 'gen.colors')}</span>
      </button>
    </div>
  )

  return (
    <div className="gen">
      <h3>{t('gen.title')}</h3>
      <div className="c-field">
        <label className="c-label" htmlFor={id('size')}>
          {t('gen.sizes')}
        </label>
        {tagField('size')}
        <p className="c-help" id={id('size-help')}>
          {t('gen.sizes_help')}
        </p>
        <div className="presets" role="group" aria-labelledby={id('presets-label')}>
          <span className="c-help" id={id('presets-label')}>
            {t('gen.presets')}
          </span>
          {SIZE_PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              className="c-btn c-btn--secondary c-btn--sm preset"
              aria-pressed={sizes.includes(s)}
              onClick={() => togglePreset(s)}
            >
              {s}
            </button>
          ))}
        </div>
        {chips('size', sizes)}
      </div>

      <div className="c-field">
        <label className="c-label" htmlFor={id('color')}>
          {t('gen.colors')}
        </label>
        {tagField('color')}
        <p className="c-help" id={id('color-help')}>
          {t('gen.colors_help')}
        </p>
        {chips('color', colors)}
        <div role="status">
          {similar && (
            <div className="c-alert c-alert--warning c-alert--sm">
              <Icon name="info" />
              <span>{t('variant.similar_color', similar)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="c-field">
          <label className="c-label" htmlFor={id('prefix')}>
            {t('gen.prefix')} <span className="hint">{t('common.optional')}</span>
          </label>
          <input
            className="c-input"
            id={id('prefix')}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby={id('prefix-help')}
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            onBlur={() => setPrefix(cleanPrefix(prefix))}
            onKeyDown={noSubmit}
          />
          <p className="c-help" id={id('prefix-help')}>
            {t('gen.prefix_help')}
          </p>
        </div>
        <div className="c-field">
          <label className="c-label" htmlFor={id('min')}>
            {t('gen.min')}
          </label>
          <div className="c-input-group">
            <input
              className="c-input num"
              id={id('min')}
              inputMode="decimal"
              autoComplete="off"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              onKeyDown={noSubmit}
            />
            <span className="suffix" aria-hidden="true">
              {unitShort}
            </span>
          </div>
        </div>
      </div>

      <div className="gen-foot">
        <p className="gen-preview" role="status">
          {preview}
        </p>
        <button type="button" className="c-btn c-btn--secondary" disabled={fresh.length === 0} onClick={apply}>
          {t('gen.apply', { count: fresh.length })}
        </button>
      </div>
    </div>
  )
}

