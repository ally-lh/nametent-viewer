// Lazy loader for jsPDF: fetched on first use so it never delays page load;
// the pinned build is integrity-checked like the three.js import map.
const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.1/jspdf.umd.min.js';
const JSPDF_SRI = 'sha384-ytX5osgYad9GPnagB0k+CxKTir/bsE7AfpzvCnQ7owfeWuDd+2l2y0PSIqRK+z/2';
let loading = null;

/** Resolves to the jsPDF constructor (one download, shared by every call). */
export function loadJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = JSPDF_URL; s.integrity = JSPDF_SRI; s.crossOrigin = 'anonymous';
      s.onload = () => (window.jspdf && window.jspdf.jsPDF)
        ? resolve(window.jspdf.jsPDF)
        : reject(new Error('PDF library did not initialise'));
      s.onerror = () => { loading = null; reject(new Error('could not download the PDF library — check your connection')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}
