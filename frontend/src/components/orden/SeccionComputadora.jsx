import { useTranslation } from 'react-i18next'

const inputCls = "w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand-500"

const TIPO_EQUIPO_VALUES = ['LAPTOP', 'PC_ESCRITORIO', 'ALL_IN_ONE', 'MACBOOK', 'MINI_PC', 'SERVIDOR', 'MONITOR', 'OTRO']
const ESTADO_FISICO_ITEMS = ['pantalla', 'carcasa', 'teclado', 'touchpad', 'bisagras', 'puertos', 'cargador']
const ESTADO_FISICO_VALORES = ['BUENO', 'REGULAR', 'MALO']
const ESTADO_FISICO_ICONOS = { BUENO: '✓', REGULAR: '!', MALO: '✗' }
const ESTADO_FISICO_COLOR = {
  BUENO: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  REGULAR: 'border-amber-400 bg-amber-50 text-amber-700',
  MALO: 'border-red-500 bg-red-50 text-red-700',
}
const TIPO_ALMACENAMIENTO_VALUES = ['HDD', 'SSD', 'NVME']
const TIPO_CONECTOR_VALUES = ['SATA', 'NVME']

// Componentes internos del equipo vs. periféricos/conectividad — siempre
// separados en dos bloques (no una sola lista mezclada).
const COMPONENTES_INTERNOS_ITEMS = ['bateria', 'cargador', 'adaptador', 'camara', 'microfono', 'audio', 'otros']
const PERIFERICOS_ITEMS = ['receptor_inalambrico', 'wifi', 'bluetooth', 'usb', 'hdmi', 'ethernet', 'lector_sd']
const ESTADO_COMPONENTE_VALORES = ['FUNCIONA', 'NO_FUNCIONA', 'NO_APLICA', 'NO_PROBADO']
const ESTADO_COMPONENTE_ICONOS = { FUNCIONA: '✓', NO_FUNCIONA: '✗', NO_APLICA: '—', NO_PROBADO: '?' }
const ESTADO_COMPONENTE_COLOR = {
  FUNCIONA: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  NO_FUNCIONA: 'border-red-500 bg-red-50 text-red-700',
  NO_APLICA: 'border-line bg-subtle text-muted',
  NO_PROBADO: 'border-amber-400 bg-amber-50 text-amber-700',
}

// Solo lo que NO se pregunta ya en Estado físico / Componentes y
// periféricos (antes se repetía cargador/batería/pantalla/teclado/... en
// las 3 secciones a la vez).
const CHECKLIST_ENTRADA_ITEMS = ['encendido', 'disco', 'ram', 'ventilador', 'temperatura']
const CHECKLIST_ENTRADA_VALORES = ['OK', 'FALLA', 'NO_APLICA', 'NO_PROBADO']
const CHECKLIST_ENTRADA_ICONOS = { OK: '✓', FALLA: '✗', NO_APLICA: '—', NO_PROBADO: '?' }
const CHECKLIST_ENTRADA_COLOR = {
  OK: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  FALLA: 'border-red-500 bg-red-50 text-red-700',
  NO_APLICA: 'border-line bg-subtle text-muted',
  NO_PROBADO: 'border-amber-400 bg-amber-50 text-amber-700',
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

// Fila de checklist compacta: nombre a la izquierda, marcas pequeñas
// (✓ / ✗ / …) a la derecha, todo en una sola línea — reemplaza los
// bloques altos de botones con texto completo ("Bueno"/"Regular"/"Malo")
// que ocupaban una tarjeta entera por ítem.
function FilaChecklist({ label, valor, opciones, colores, iconos, etiquetas, onChange }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex gap-1">
        {opciones.map((op) => (
          <button key={op} type="button" onClick={() => onChange(op)} title={etiquetas(op)}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs font-bold leading-none ${valor === op ? colores[op] : 'border-line text-muted hover:border-line hover:text-muted'}`}>
            {iconos[op]}
          </button>
        ))}
      </div>
    </div>
  )
}

function Leyenda({ items }) {
  return (
    <p className="mb-2 text-[11px] text-muted">
      {items.map(([icono, texto], i) => (
        <span key={icono}>{i > 0 && <span className="mx-1.5">·</span>}<strong className="text-muted">{icono}</strong> {texto}</span>
      ))}
    </p>
  )
}

function SeccionComputadora({ orden, set, detalle, setDetalle, esNuevo }) {
  const { t } = useTranslation(['ordenes', 'common'])

  const setEstadoFisico = (item, valor) => setDetalle({ estado_fisico: { ...(detalle.estado_fisico || {}), [item]: valor } })
  const setComponente = (item, valor) => setDetalle({ componentes: { ...(detalle.componentes || {}), [item]: valor } })
  const setSoftware = (patch) => setDetalle({ software: { ...(detalle.software || {}), ...patch } })
  const setChecklistEntrada = (item, valor) => setDetalle({ checklist_entrada: { ...(detalle.checklist_entrada || {}), [item]: valor } })

  const addAccesorio = () => setDetalle({ accesorios_detalle: [...(detalle.accesorios_detalle || []), { nombre: '', estado: '', serial: '' }] })
  const updAccesorio = (i, patch) => {
    const arr = [...(detalle.accesorios_detalle || [])]
    arr[i] = { ...arr[i], ...patch }
    setDetalle({ accesorios_detalle: arr })
  }
  const delAccesorio = (i) => setDetalle({ accesorios_detalle: (detalle.accesorios_detalle || []).filter((_, idx) => idx !== i) })

  // Siempre hay al menos una fila editable visible — antes, si el arreglo
  // llegaba vacío, solo se veía el texto "Sin accesorios agregados" sin
  // ningún campo para escribir, y el botón "+ Agregar fila" (chiquito,
  // arriba a la derecha) pasaba fácilmente desapercibido.
  const filasAccesorios = (detalle.accesorios_detalle && detalle.accesorios_detalle.length > 0) ? detalle.accesorios_detalle : [{ nombre: '', estado: '', serial: '' }]
  const asegurarFilaAccesorio = (i, patch) => {
    if (!detalle.accesorios_detalle || detalle.accesorios_detalle.length === 0) {
      setDetalle({ accesorios_detalle: [{ nombre: '', estado: '', serial: '', ...patch }] })
    } else {
      updAccesorio(i, patch)
    }
  }

  return (
    <div className="orden-tw">
      <h3 className="mb-3 text-xs font-semibold uppercase text-muted">{t('com.datosEquipoTitulo')}</h3>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t('com.tipoEquipo')}>
          <select className={inputCls} value={detalle.tipo_equipo || 'LAPTOP'} onChange={(e) => setDetalle({ tipo_equipo: e.target.value })}>
            {TIPO_EQUIPO_VALUES.map((v) => <option key={v} value={v}>{t(`com.tiposEquipo.${v}`)}</option>)}
          </select>
        </Field>
        <Field label={t('com.procesador')}>
          <input className={inputCls} placeholder={t('com.procesadorPlaceholder')} value={detalle.procesador_generacion || ''} onChange={(e) => setDetalle({ procesador_generacion: e.target.value })} />
        </Field>
      </div>

      <h3 className="mb-1 text-xs font-semibold uppercase text-muted">{t('com.estadoFisicoTitulo')}</h3>
      <Leyenda items={[['✓', t('estadoEquipo.BUENO')], ['!', t('estadoEquipo.REGULAR')], ['✗', t('estadoEquipo.MALO')]]} />
      <div className="mb-5 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {ESTADO_FISICO_ITEMS.map((item) => (
          <FilaChecklist key={item} label={t(`com.estadoFisicoItems.${item}`)}
            valor={(detalle.estado_fisico || {})[item]} opciones={ESTADO_FISICO_VALORES}
            colores={ESTADO_FISICO_COLOR} iconos={ESTADO_FISICO_ICONOS}
            etiquetas={(v) => t(`estadoEquipo.${v}`)} onChange={(v) => setEstadoFisico(item, v)} />
        ))}
      </div>

      <h3 className="mb-3 text-xs font-semibold uppercase text-muted">{t('com.especificacionesTitulo')}</h3>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t('com.ramTipo')}><input className={inputCls} value={detalle.ram_tipo || ''} onChange={(e) => setDetalle({ ram_tipo: e.target.value })} /></Field>
        <Field label={t('com.ramFrecuencia')}><input className={inputCls} value={detalle.ram_frecuencia || ''} onChange={(e) => setDetalle({ ram_frecuencia: e.target.value })} /></Field>
        <Field label={t('com.ramSlots')}><input className={inputCls} value={detalle.ram_slots || ''} onChange={(e) => setDetalle({ ram_slots: e.target.value })} /></Field>
        <Field label={t('com.discoCapacidad')}><input className={inputCls} value={detalle.disco_capacidad || ''} onChange={(e) => setDetalle({ disco_capacidad: e.target.value })} /></Field>
        <Field label={t('com.tipoAlmacenamiento')}>
          <select className={inputCls} value={detalle.tipo_almacenamiento || ''} onChange={(e) => setDetalle({ tipo_almacenamiento: e.target.value })}>
            <option value="">—</option>
            {TIPO_ALMACENAMIENTO_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
        <Field label={t('com.marcaDisco')}><input className={inputCls} value={detalle.marca_disco || ''} onChange={(e) => setDetalle({ marca_disco: e.target.value })} /></Field>
        <Field label={t('com.serialDisco')}><input className={inputCls} value={detalle.serial_disco || ''} onChange={(e) => setDetalle({ serial_disco: e.target.value })} /></Field>
        <Field label={t('com.tipoConector')}>
          <select className={inputCls} value={detalle.tipo_conector || ''} onChange={(e) => setDetalle({ tipo_conector: e.target.value })}>
            <option value="">—</option>
            {TIPO_CONECTOR_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
      </div>

      <h3 className="mb-1 text-xs font-semibold uppercase text-muted">{t('com.componentesTitulo')}</h3>
      <Leyenda items={[['✓', t('com.estadoComponente.FUNCIONA')], ['✗', t('com.estadoComponente.NO_FUNCIONA')], ['—', t('com.estadoComponente.NO_APLICA')], ['?', t('com.estadoComponente.NO_PROBADO')]]} />
      <div className="mb-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {COMPONENTES_INTERNOS_ITEMS.map((item) => (
          <FilaChecklist key={item} label={t(`com.componentesItems.${item}`)}
            valor={(detalle.componentes || {})[item]} opciones={ESTADO_COMPONENTE_VALORES}
            colores={ESTADO_COMPONENTE_COLOR} iconos={ESTADO_COMPONENTE_ICONOS}
            etiquetas={(v) => t(`com.estadoComponente.${v}`)} onChange={(v) => setComponente(item, v)} />
        ))}
      </div>
      <h4 className="mb-2 text-[11px] font-semibold uppercase text-muted">{t('com.perifericosTitulo')}</h4>
      <div className="mb-5 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {PERIFERICOS_ITEMS.map((item) => (
          <FilaChecklist key={item} label={t(`com.componentesItems.${item}`)}
            valor={(detalle.componentes || {})[item]} opciones={ESTADO_COMPONENTE_VALORES}
            colores={ESTADO_COMPONENTE_COLOR} iconos={ESTADO_COMPONENTE_ICONOS}
            etiquetas={(v) => t(`com.estadoComponente.${v}`)} onChange={(v) => setComponente(item, v)} />
        ))}
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase text-muted">{t('com.accesoriosDetalleTitulo')}</span>
          <button type="button" onClick={addAccesorio} className="rounded-md border border-line bg-tint px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-100">+ {t('botones.agregarFila')}</button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-subtle text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2 text-left">{t('com.accesorioNombre')}</th>
                <th className="px-3 py-2 text-left">{t('com.accesorioEstado')}</th>
                <th className="px-3 py-2 text-left">{t('com.accesorioSerial')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filasAccesorios.map((a, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-2"><input className={inputCls} placeholder={t('com.accesorioNombrePlaceholder')} value={a.nombre || ''} onChange={(e) => asegurarFilaAccesorio(i, { nombre: e.target.value })} /></td>
                  <td className="px-3 py-2"><input className={inputCls} placeholder={t('com.accesorioEstadoPlaceholder')} value={a.estado || ''} onChange={(e) => asegurarFilaAccesorio(i, { estado: e.target.value })} /></td>
                  <td className="px-3 py-2"><input className={inputCls} placeholder={t('com.accesorioSerialPlaceholder')} value={a.serial || ''} onChange={(e) => asegurarFilaAccesorio(i, { serial: e.target.value })} /></td>
                  <td className="px-3 py-2">{(detalle.accesorios_detalle || []).length > 0 && <button type="button" onClick={() => delAccesorio(i)} className="text-red-500 hover:underline">✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-line p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase text-muted">{t('com.datosRecepcionTitulo')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('com.empresaControlaSoftware')}>
            <div className="flex gap-2">
              {[[t('triEstado.si'), true], [t('triEstado.no'), false]].map(([txt, v]) => (
                <button key={txt} type="button" onClick={() => setDetalle({ empresa_controla_software: v })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${detalle.empresa_controla_software === v ? 'border-brand bg-tint text-brand font-semibold' : 'border-line text-muted'}`}>{txt}</button>
              ))}
            </div>
          </Field>
          <Field label={t('com.primeraVez')}>
            <div className="flex gap-2">
              {[[t('triEstado.si'), true], [t('triEstado.no'), false]].map(([txt, v]) => (
                <button key={txt} type="button" onClick={() => setDetalle({ primera_vez: v })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${detalle.primera_vez === v ? 'border-brand bg-tint text-brand font-semibold' : 'border-line text-muted'}`}>{txt}</button>
              ))}
            </div>
          </Field>
          <Field label={t('com.respaldoSolicitado')}>
            <div className="flex gap-2">
              {[[t('triEstado.si'), true], [t('triEstado.no'), false]].map(([txt, v]) => (
                <button key={txt} type="button" onClick={() => setDetalle({ respaldo_solicitado: v })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${detalle.respaldo_solicitado === v ? 'border-brand bg-tint text-brand font-semibold' : 'border-line text-muted'}`}>{txt}</button>
              ))}
            </div>
          </Field>
          <Field label={t('com.compradoNuevo')}>
            <div className="flex gap-2">
              {[[t('triEstado.si'), true], [t('triEstado.no'), false]].map(([txt, v]) => (
                <button key={txt} type="button" onClick={() => setDetalle({ comprado_nuevo: v })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${detalle.comprado_nuevo === v ? 'border-brand bg-tint text-brand font-semibold' : 'border-line text-muted'}`}>{txt}</button>
              ))}
            </div>
          </Field>
          <Field label={t('com.receptorMouse')}>
            <div className="flex gap-2">
              {[[t('triEstado.si'), true], [t('triEstado.no'), false]].map(([txt, v]) => (
                <button key={txt} type="button" onClick={() => setDetalle({ trae_receptor_mouse: v })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${detalle.trae_receptor_mouse === v ? 'border-brand bg-tint text-brand font-semibold' : 'border-line text-muted'}`}>{txt}</button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-line p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase text-muted">{t('com.bitlockerTitulo')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('com.bitlockerEstado')}>
            <div className="flex gap-2">
              {[[t('triEstado.si'), true], [t('triEstado.no'), false]].map(([txt, v]) => (
                <button key={txt} type="button" onClick={() => setDetalle({ bitlocker_activo: v })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${detalle.bitlocker_activo === v ? 'border-brand bg-tint text-brand font-semibold' : 'border-line text-muted'}`}>{txt}</button>
              ))}
            </div>
          </Field>
          <Field label={t('com.bitlockerClave')}>
            <input className={inputCls} value={detalle.bitlocker_clave || ''} onChange={(e) => setDetalle({ bitlocker_clave: e.target.value })}
              disabled={!detalle.bitlocker_activo} placeholder={detalle.bitlocker_activo ? '' : t('com.bitlockerClaveDeshabilitada')} />
          </Field>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-line p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase text-muted">{t('com.softwareTitulo')}</h3>
        <div className="mb-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('campos.sistemaOperativo')}><input className={inputCls} value={orden.sistema_operativo || ''} onChange={(e) => set({ sistema_operativo: e.target.value })} /></Field>
          <Field label={t('com.softwareVersion')}><input className={inputCls} value={detalle.software?.version || ''} onChange={(e) => setSoftware({ version: e.target.value })} /></Field>
          <Field label={t('com.softwareLicencia')}><input className={inputCls} value={detalle.software?.licencia || ''} onChange={(e) => setSoftware({ licencia: e.target.value })} /></Field>
          <Field label={t('com.softwareOffice')}><input className={inputCls} value={detalle.software?.office || ''} onChange={(e) => setSoftware({ office: e.target.value })} /></Field>
          <Field label={t('com.softwareAntivirus')}><input className={inputCls} value={detalle.software?.antivirus || ''} onChange={(e) => setSoftware({ antivirus: e.target.value })} /></Field>
          <Field label={t('com.softwareProgramas')}><input className={inputCls} value={detalle.software?.programas || ''} onChange={(e) => setSoftware({ programas: e.target.value })} /></Field>
        </div>
        <Field label={t('com.softwareObservaciones')}>
          <textarea rows={2} className={inputCls} value={detalle.software?.observaciones || ''} onChange={(e) => setSoftware({ observaciones: e.target.value })} />
        </Field>
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{t('com.sinGarantiaSoftware')}</p>
      </div>

      <div className="mb-2">
        <h3 className="mb-1 text-xs font-semibold uppercase text-muted">{t('com.checklistEntradaTitulo')}</h3>
        <Leyenda items={[['✓', t('com.estadoChecklist.OK')], ['✗', t('com.estadoChecklist.FALLA')], ['—', t('com.estadoChecklist.NO_APLICA')], ['?', t('com.estadoChecklist.NO_PROBADO')]]} />
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {CHECKLIST_ENTRADA_ITEMS.map((item) => (
            <FilaChecklist key={item} label={t(`com.checklistEntradaItems.${item}`)}
              valor={(detalle.checklist_entrada || {})[item]} opciones={CHECKLIST_ENTRADA_VALORES}
              colores={CHECKLIST_ENTRADA_COLOR} iconos={CHECKLIST_ENTRADA_ICONOS}
              etiquetas={(v) => t(`com.estadoChecklist.${v}`)} onChange={(v) => setChecklistEntrada(item, v)} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default SeccionComputadora
