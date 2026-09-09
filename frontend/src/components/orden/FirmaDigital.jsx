import { useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

function FirmaDigital({ value, onChange, label }) {
  const { t } = useTranslation('ordenes')
  const canvasRef = useRef(null)
  const dibujandoRef = useRef(false)
  const [vacio, setVacio] = useState(!value)
  const etiqueta = label || t('widgets.firma.default')

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1e293b'
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0)
      img.src = value
    }
  }, [])

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const start = (e) => {
    e.preventDefault()
    dibujandoRef.current = true
    setVacio(false)
    const { x, y } = getPos(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e) => {
    if (!dibujandoRef.current) return
    e.preventDefault()
    const { x, y } = getPos(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const end = () => {
    if (!dibujandoRef.current) return
    dibujandoRef.current = false
    onChange(canvasRef.current.toDataURL('image/png'))
  }

  const limpiar = () => {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setVacio(true)
    onChange('')
  }

  return (
    <div className="orden-tw">
      <div className="mb-1 text-xs font-medium text-muted">{etiqueta}</div>
      <canvas
        ref={canvasRef}
        width={300} height={120}
        className="touch-none rounded-lg border border-line bg-surface"
        onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={end}
      />
      <div className="mt-1 flex items-center gap-3">
        <button type="button" onClick={limpiar} className="text-xs text-muted underline">{t('widgets.firma.limpiar')}</button>
        {!vacio && <span className="text-xs text-emerald-600">✓ {t('widgets.firma.firmado')}</span>}
      </div>
    </div>
  )
}

export default FirmaDigital
