/** Setzt data-theme vor dem ersten Rendern (kein Aufblitzen). Läuft inline im <head>. Wahl: localStorage "vge-theme" = light | dark | system. */
const SCRIPT = `(function(){try{var t=localStorage.getItem("vge-theme");var d=t==="dark"||((t===null||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
