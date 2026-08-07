// UI helpers: toast manager + small DOM utilities
export class ToastManager{
  constructor(){ this.container = document.getElementById('toastContainer'); }
  show(msg, type='info'){
    if (!this.container) return;
    const t = document.createElement('div'); t.className='toast'; t.textContent = msg;
    this.container.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),220); }, 3500);
  }
}
export const toast = new ToastManager();
