import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// Botones laterales (volumen a la izquierda, encendido a la derecha) —
// se dibujan igual en Frente y Atrás: es el mismo equipo, y así se puede
// marcar un rayón de botón desde cualquiera de las dos vistas.
function BotonesLateralesCelular() {
  return (
    <>
      <rect x="138" y="64" width="4" height="28" rx="1.5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      <rect x="18" y="54" width="4" height="16" rx="1.5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      <rect x="18" y="76" width="4" height="16" rx="1.5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
    </>
  )
}

function CelularFrenteSilueta() {
  return (
    <>
      <rect x="20" y="10" width="120" height="220" rx="18" fill="#fff" stroke="#94a3b8" strokeWidth="2" />
      <BotonesLateralesCelular />
      <rect x="30" y="26" width="100" height="194" rx="8" fill="#f1f5f9" stroke="#cbd5e1" />
      <rect x="64" y="17" width="32" height="4" rx="2" fill="#cbd5e1" />
      <circle cx="100" cy="19" r="2.2" fill="none" stroke="#94a3b8" strokeWidth="1.3" />
      <rect x="64" y="215" width="32" height="3" rx="1.5" fill="#cbd5e1" />
    </>
  )
}

// Reverso del celular: carcasa lisa + módulo de cámaras en la esquina
// (3 lentes con núcleo oscuro + flash) + logo tenue en el centro.
function CelularAtrasSilueta() {
  return (
    <>
      <rect x="20" y="10" width="120" height="220" rx="18" fill="#fff" stroke="#94a3b8" strokeWidth="2" />
      <BotonesLateralesCelular />
      <rect x="32" y="24" width="96" height="192" rx="10" fill="#f8fafc" stroke="#e2e8f0" />
      <rect x="36" y="30" width="40" height="40" rx="12" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="48" cy="42" r="6.5" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="48" cy="42" r="3" fill="#94a3b8" />
      <circle cx="65" cy="42" r="6.5" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="65" cy="42" r="3" fill="#94a3b8" />
      <circle cx="48" cy="59" r="6.5" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="48" cy="59" r="3" fill="#94a3b8" />
      <circle cx="65" cy="59" r="3.2" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />
      <circle cx="80" cy="150" r="11" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
    </>
  )
}

// Laptop abierta (pantalla + teclado con teclas dibujadas), vista de frente.
function LaptopFrenteSilueta() {
  const filas = [0, 1, 2, 3]
  const cols = Array.from({ length: 10 })
  return (
    <>
      <rect x="15" y="10" width="130" height="112" rx="10" fill="#fff" stroke="#94a3b8" strokeWidth="2" />
      <rect x="25" y="20" width="110" height="92" rx="4" fill="#f1f5f9" stroke="#cbd5e1" />
      <rect x="58" y="118" width="44" height="10" rx="2" fill="#cbd5e1" stroke="#94a3b8" />
      <rect x="10" y="128" width="140" height="92" rx="10" fill="#fff" stroke="#94a3b8" strokeWidth="2" />
      {filas.map((fila) => (
        <g key={fila}>
          {cols.map((_, col) => (
            <rect key={col} x={19 + col * 12} y={136 + fila * 10} width="9.5" height="7" rx="1.5" fill="#f1f5f9" stroke="#e2e8f0" />
          ))}
        </g>
      ))}
      <rect x="62" y="198" width="36" height="16" rx="3" fill="#f1f5f9" stroke="#cbd5e1" />
    </>
  )
}

// Laptop abierta vista desde atrás: reverso de la pantalla (con logo) +
// bisagra + reverso de la base (rejillas de ventilación y patas de goma) —
// mismas proporciones que LaptopFrenteSilueta para que las pestañas
// Frente/Atrás se sientan como el mismo equipo visto desde otro ángulo.
function LaptopAtrasSilueta() {
  const rejillas = Array.from({ length: 6 })
  return (
    <>
      <rect x="15" y="10" width="130" height="112" rx="10" fill="#fff" stroke="#94a3b8" strokeWidth="2" />
      <circle cx="80" cy="66" r="15" fill="none" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="58" y="118" width="44" height="10" rx="2" fill="#cbd5e1" stroke="#94a3b8" />
      <rect x="10" y="128" width="140" height="92" rx="10" fill="#fff" stroke="#94a3b8" strokeWidth="2" />
      {rejillas.map((_, col) => (
        <g key={col}>
          <rect x={28 + col * 17} y="148" width="11" height="3" rx="1.5" fill="#e2e8f0" />
          <rect x={28 + col * 17} y="156" width="11" height="3" rx="1.5" fill="#e2e8f0" />
        </g>
      ))}
      <ellipse cx="22" cy="138" rx="6" ry="4" fill="#e2e8f0" />
      <ellipse cx="138" cy="138" rx="6" ry="4" fill="#e2e8f0" />
      <ellipse cx="22" cy="210" rx="6" ry="4" fill="#e2e8f0" />
      <ellipse cx="138" cy="210" rx="6" ry="4" fill="#e2e8f0" />
    </>
  )
}

// Perfil lateral (cerrada, vista desde el costado) con puertos; se espeja para el lado derecho.
function LaptopLateralSilueta({ espejo = false }) {
  return (
    <g transform={espejo ? 'scale(-1,1) translate(-160,0)' : undefined}>
      <rect x="10" y="108" width="140" height="24" rx="4" fill="#fff" stroke="#94a3b8" strokeWidth="2" />
      <rect x="22" y="114" width="10" height="12" rx="1.5" fill="#f1f5f9" stroke="#cbd5e1" />
      <rect x="40" y="116" width="16" height="8" rx="1.5" fill="#f1f5f9" stroke="#cbd5e1" />
      <rect x="66" y="116" width="10" height="8" rx="1.5" fill="#f1f5f9" stroke="#cbd5e1" />
      <rect x="112" y="114" width="14" height="12" rx="1.5" fill="#f1f5f9" stroke="#cbd5e1" />
      <rect x="130" y="116" width="10" height="8" rx="1.5" fill="#f1f5f9" stroke="#cbd5e1" />
    </g>
  )
}

export const VISTAS_POR_TIPO = {
  CCA: ['FRENTE', 'ATRAS'],
  COM: ['FRENTE', 'ATRAS', 'LATERAL_IZQ', 'LATERAL_DER'],
}

// Silueta suelta (sin tabs ni interacción) para pequeños múltiplos —
// usada en la vista impresa, que muestra todas las vistas a la vez en
// vez de una sola con pestañas para cambiar.
export function siluetaPara(tipo, vista) {
  if (tipo === 'COM') {
    if (vista === 'ATRAS') return <LaptopAtrasSilueta />
    if (vista === 'LATERAL_IZQ') return <LaptopLateralSilueta />
    if (vista === 'LATERAL_DER') return <LaptopLateralSilueta espejo />
    return <LaptopFrenteSilueta />
  }
  return vista === 'ATRAS' ? <CelularAtrasSilueta /> : <CelularFrenteSilueta />
}

function DanosVisibles({ value = [], onChange, readOnly = false, tipo = 'CCA' }) {
  const { t } = useTranslation('ordenes')
  const vistasDisponibles = VISTAS_POR_TIPO[tipo] || VISTAS_POR_TIPO.CCA
  const [vista, setVista] = useState(vistasDisponibles[0])
  const puntosRef = useRef(value || [])
  const [, forceRender] = useState(0)

  useEffect(() => {
    puntosRef.current = value || []
    forceRender((n) => n + 1)
  }, [value])

  // Si cambia el tipo de orden (CCA/COM) y la vista actual ya no existe
  // (p. ej. venía de "Lateral" y pasó a celular), vuelve a la primera vista.
  useEffect(() => {
    if (!vistasDisponibles.includes(vista)) setVista(vistasDisponibles[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo])

  const puntos = puntosRef.current

  const etiquetaVista = (v) => ({
    FRENTE: t('widgets.danos.frente'),
    ATRAS: t('widgets.danos.atras'),
    LATERAL_IZQ: t('widgets.danos.lateralIzq'),
    LATERAL_DER: t('widgets.danos.lateralDer'),
  }[v] || v)

  const handleClick = (e) => {
    if (readOnly) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 160)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 240)
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    puntosRef.current = [...puntosRef.current, { id, x, y, vista, nota: '' }]
    forceRender((n) => n + 1)
    onChange(puntosRef.current)
  }

  const quitarUltimo = () => {
    const idx = puntosRef.current.map((p) => p.vista).lastIndexOf(vista)
    if (idx === -1) return
    puntosRef.current = puntosRef.current.filter((_, i) => i !== idx)
    forceRender((n) => n + 1)
    onChange(puntosRef.current)
  }

  const limpiar = () => {
    puntosRef.current = puntosRef.current.filter((p) => p.vista !== vista)
    forceRender((n) => n + 1)
    onChange(puntosRef.current)
  }

  const actualizarNota = (id, nota) => {
    puntosRef.current = puntosRef.current.map((p) => (p.id === id ? { ...p, nota } : p))
    forceRender((n) => n + 1)
    onChange(puntosRef.current)
  }

  const puntosVista = puntos.filter((p) => p.vista === vista)

  const renderSilueta = () => {
    if (tipo === 'COM') {
      if (vista === 'ATRAS') return <LaptopAtrasSilueta />
      if (vista === 'LATERAL_IZQ') return <LaptopLateralSilueta />
      if (vista === 'LATERAL_DER') return <LaptopLateralSilueta espejo />
      return <LaptopFrenteSilueta />
    }
    return vista === 'ATRAS' ? <CelularAtrasSilueta /> : <CelularFrenteSilueta />
  }

  return (
    <div className="orden-tw">
      <div className="mb-2 flex flex-wrap gap-2">
        {vistasDisponibles.map((v) => (
          <button
            key={v} type="button" onClick={() => setVista(v)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${vista === v ? 'bg-brand-500 text-white' : 'bg-subtle text-muted'}`}
          >
            {etiquetaVista(v)}
          </button>
        ))}
      </div>
      <svg
        width="160" height="240" viewBox="0 0 160 240"
        className={`rounded-lg border border-line bg-surface ${readOnly ? '' : 'cursor-crosshair'}`}
        onClick={handleClick}
      >
        {renderSilueta()}
        {puntosVista.map((p, i) => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r="9" fill="#dc2626" opacity="0.12" />
            <line x1={p.x - 5} y1={p.y - 5} x2={p.x + 5} y2={p.y + 5} stroke="#dc2626" strokeWidth="2.5" />
            <line x1={p.x - 5} y1={p.y + 5} x2={p.x + 5} y2={p.y - 5} stroke="#dc2626" strokeWidth="2.5" />
            <circle cx={p.x + 9} cy={p.y - 9} r="7" fill="#dc2626" />
            <text x={p.x + 9} y={p.y - 6} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fff">{i + 1}</text>
          </g>
        ))}
      </svg>
      {!readOnly && (
        <div className="mt-2 flex gap-3 text-xs">
          <button type="button" onClick={quitarUltimo} className="text-muted underline">{t('widgets.danos.quitarUltimo')}</button>
          <button type="button" onClick={limpiar} className="text-muted underline">{t('widgets.danos.limpiarTodo')}</button>
        </div>
      )}
      {puntosVista.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {puntosVista.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">{i + 1}</span>
              {readOnly ? (
                <span className="text-xs text-muted">{p.nota || t('widgets.danos.sinNota')}</span>
              ) : (
                <input
                  className="flex-1 rounded-lg border border-line px-2 py-1 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder={t('widgets.danos.notaPlaceholder')}
                  value={p.nota || ''}
                  onChange={(e) => actualizarNota(p.id, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DanosVisibles
