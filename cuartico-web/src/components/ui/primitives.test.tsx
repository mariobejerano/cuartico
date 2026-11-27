import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Info } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { Alert, AlertDescription, AlertTitle } from './alert'
import { Badge } from './badge'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Field, FieldDescription, FieldError } from './field'
import { Input } from './input'
import { Label } from './label'

// Los textos de estos tests son datos de prueba, no de la interfaz: la app siempre pasa t('…').

describe('Field + Label + Input', () => {
  it('el campo tiene nombre (la etiqueta), descripción (la ayuda) y se escribe en él', async () => {
    const ue = userEvent.setup()
    render(
      <Field>
        <Label htmlFor="sku">SKU</Label>
        <Input id="sku" aria-describedby="sku-help" />
        <FieldDescription id="sku-help">Código interno</FieldDescription>
      </Field>,
    )
    const input = screen.getByRole('textbox', { name: 'SKU' })
    expect(input).toHaveAccessibleDescription('Código interno')
    await ue.type(input, 'ARZ-1')
    expect(input).toHaveValue('ARZ-1')
  })

  it('con error: aria-invalid y el mensaje como descripción; sin mensaje no pinta nada', () => {
    const { rerender } = render(
      <Field>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" aria-invalid aria-describedby="name-error" />
        <FieldError id="name-error">Este campo es obligatorio.</FieldError>
      </Field>,
    )
    const input = screen.getByRole('textbox', { name: 'Nombre' })
    expect(input).toBeInvalid()
    expect(input).toHaveAccessibleDescription('Este campo es obligatorio.')

    rerender(<FieldError id="name-error" />)
    expect(document.getElementById('name-error')).toBeNull()
  })
})

describe('Badge', () => {
  it('el estado se lee como texto (el color es refuerzo); brand no lleva punto', () => {
    render(
      <>
        <Badge variant="success">Activo</Badge>
        <Badge variant="brand">3 variantes</Badge>
      </>,
    )
    expect(screen.getByText('Activo')).toHaveClass('bg-success-bg', 'before:content-[\'\']')
    expect(screen.getByText('3 variantes')).not.toHaveClass('before:content-[\'\']')
  })
})

describe('Alert', () => {
  it('danger se anuncia ya (role="alert"); el resto, sin interrumpir (role="status")', () => {
    render(
      <>
        <Alert variant="danger">
          <AlertTitle>No se pudo guardar</AlertTitle>
        </Alert>
        <Alert variant="info">
          <Info aria-hidden="true" />
          <AlertTitle>Despertando el servidor</AlertTitle>
          <AlertDescription>Puede tardar un minuto.</AlertDescription>
        </Alert>
      </>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar')
    expect(screen.getByRole('status')).toHaveTextContent('Despertando el servidorPuede tardar un minuto.')
  })
})

describe('Card', () => {
  it('título como encabezado de nivel 2 y contenido dentro', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Inventario</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline">Editar</Button>
        </CardContent>
      </Card>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Inventario' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
  })
})
