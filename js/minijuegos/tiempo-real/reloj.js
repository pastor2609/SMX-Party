// =====================================================================
//  reloj.js — Un "metrónomo" que hace tic-tac aunque la pestaña esté
//  en segundo plano
// ---------------------------------------------------------------------
//  Problema: los navegadores ralentizan los temporizadores normales
//  (setInterval) de las pestañas que no se ven (como mucho 1 vez por
//  segundo). Si el host está en una pestaña escondida, la física iría
//  a saltos.
//  Solución: un "Web Worker" (un mini-programa que corre aparte) no se
//  ralentiza. Le pedimos que nos avise cada X milisegundos.
// =====================================================================

const CODIGO_WORKER = `
  let temporizador = null;
  onmessage = (e) => {
    clearInterval(temporizador);
    if (e.data > 0) temporizador = setInterval(() => postMessage(0), e.data);
  };
`;

/**
 * Llama a fn() cada "ms" milisegundos. Devuelve una función para pararlo.
 */
export function crearMetronomo(ms, fn) {
  try {
    const url = URL.createObjectURL(new Blob([CODIGO_WORKER], { type: 'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = () => fn();
    worker.postMessage(ms);
    return () => {
      worker.postMessage(0);
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  } catch (err) {
    // Si el navegador no deja crear el worker, usamos el método normal
    console.warn('[reloj] Sin Web Worker, uso setInterval:', err);
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }
}
