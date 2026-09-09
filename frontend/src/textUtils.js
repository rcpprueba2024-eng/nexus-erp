// Capitaliza cada palabra ("juan perez" -> "Juan Perez") para nombres,
// marcas, modelos, direcciones, etc. Deliberadamente NO se usa en campos
// donde mayúscula automática dañaría el dato: email, contraseñas,
// IMEI/n.º de serie, y textareas largos de diagnóstico/notas (ahí el
// usuario puede querer minúsculas, siglas o texto libre tal cual lo tipeó).
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'a'])

export function capitalizarTexto(texto) {
  if (!texto) return texto
  return texto
    .split(' ')
    .map((palabra, i) => {
      if (!palabra) return palabra
      const baja = palabra.toLowerCase()
      if (i > 0 && MINUSCULAS.has(baja)) return baja
      return baja.charAt(0).toUpperCase() + baja.slice(1)
    })
    .join(' ')
}

// Handler listo para usar en onBlur de un <input>: capitaliza el valor al
// perder el foco (no en cada tecla, para no pelear con el cursor mientras
// el usuario escribe).
export function onBlurCapitalizar(valorActual, campo, setForm) {
  return (e) => {
    const capitalizado = capitalizarTexto(e.target.value)
    if (capitalizado !== valorActual) setForm((prev) => ({ ...prev, [campo]: capitalizado }))
  }
}
