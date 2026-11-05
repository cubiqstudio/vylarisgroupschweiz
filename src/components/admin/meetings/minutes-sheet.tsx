import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDateCh } from "@/lib/verein/dates";
import { RESOLUTION_RESULT_LABEL, type ResolutionResult } from "@/lib/verein/constants";
import { formatMeetingWhen, kindLabel, voteSummary, MAJORITY_SHORT, type MajorityRule } from "@/lib/verein/meetings-lib";

const FONT = "Arial, Helvetica, sans-serif";
// Hinweis: keine Zeichen "<", ">", "&" und keine Anführungszeichen im CSS (React würde sie im style-Element maskieren).
const PRINT_CSS = `
@page { size: A4; margin: 0; }
.minutes-sheet { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print {
  html, body { background: #fff !important; }
  body *:not(:has(.minutes-sheet)):not(.minutes-sheet):not(.minutes-sheet *) { display: none !important; }
  .minutes-sheet { position: absolute !important; left: 0 !important; top: 0 !important; margin: 0 !important; box-shadow: none !important; }
  .minutes-sheet h2, .minutes-sheet h3 { break-after: avoid; }
  .minutes-sheet tr, .minutes-sheet li { break-inside: avoid; }
}
`;

export type SheetData = {
  title: string;
  kind: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string;
  leaderName: string | null;
  recorderName: string | null;
  minutes: string;
  approved: { on: Date; by: string; note: string } | null;
  resolutions: Array<{ number: number; text: string; votesYes: number | null; votesNo: number | null; abstentions: number | null; majority: string; result: string; recusal: string }>;
  sender: string;
};

/** Protokoll im A4-Format (Druckansicht). Der Text ist Markdown ohne rohes HTML; im Druckdialog «Als PDF speichern» wählen. */
export function MinutesSheet({ data }: { data: SheetData }) {
  const approved = data.approved;
  return (
    <>
      <style>{PRINT_CSS}</style>
      <article
        className="minutes-sheet mx-auto my-4 bg-white text-black shadow-2xl shadow-black/40"
        style={{ width: "210mm", minHeight: "297mm", boxSizing: "border-box", padding: "20mm 20mm 18mm", fontFamily: FONT, fontSize: "10.5pt", lineHeight: 1.5, maxWidth: "100%" }}
        aria-label={`Protokoll ${data.title}`}
      >
        <header className="border-b border-black pb-3">
          {data.sender && <p style={{ fontSize: "9pt", color: "#444" }}>{data.sender}</p>}
          <h1 style={{ fontSize: "18pt", fontWeight: 700, margin: "4pt 0 2pt" }}>Protokoll: {data.title}</h1>
          <p style={{ color: "#333" }}>
            {kindLabel(data.kind)} · {formatMeetingWhen(data.startsAt, data.endsAt)}
            {data.location && <> · {data.location}</>}
          </p>
          {(data.leaderName || data.recorderName) && (
            <p style={{ color: "#333", fontSize: "9.5pt" }}>
              {data.leaderName && <>Leitung: {data.leaderName}</>}
              {data.leaderName && data.recorderName && " · "}
              {data.recorderName && <>Protokoll: {data.recorderName}</>}
            </p>
          )}
        </header>

        <div style={{ marginTop: "10pt" }}>
          {data.minutes.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h2 style={{ fontSize: "14pt", fontWeight: 700, margin: "12pt 0 4pt" }}>{children}</h2>,
                h2: ({ children }) => <h2 style={{ fontSize: "13pt", fontWeight: 700, margin: "12pt 0 4pt" }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: "11.5pt", fontWeight: 700, margin: "10pt 0 3pt" }}>{children}</h3>,
                h4: ({ children }) => <h4 style={{ fontSize: "10.5pt", fontWeight: 700, margin: "8pt 0 2pt" }}>{children}</h4>,
                p: ({ children }) => <p style={{ margin: "0 0 6pt" }}>{children}</p>,
                ul: ({ children }) => <ul style={{ margin: "0 0 6pt", paddingLeft: "16pt", listStyle: "disc" }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ margin: "0 0 6pt", paddingLeft: "16pt", listStyle: "decimal" }}>{children}</ol>,
                blockquote: ({ children }) => <blockquote style={{ margin: "0 0 6pt", paddingLeft: "8pt", borderLeft: "2pt solid #999", color: "#333" }}>{children}</blockquote>,
                a: ({ children }) => <span style={{ textDecoration: "underline" }}>{children}</span>,
                hr: () => <hr style={{ margin: "8pt 0", borderColor: "#999" }} />,
                table: ({ children }) => <table style={{ borderCollapse: "collapse", margin: "0 0 6pt", width: "100%" }}>{children}</table>,
                th: ({ children }) => <th style={{ border: "0.5pt solid #666", padding: "2pt 4pt", textAlign: "left", background: "#eee" }}>{children}</th>,
                td: ({ children }) => <td style={{ border: "0.5pt solid #666", padding: "2pt 4pt" }}>{children}</td>,
                code: ({ children }) => <code style={{ fontFamily: "monospace" }}>{children}</code>,
                img: () => null,
              }}
            >
              {data.minutes}
            </ReactMarkdown>
          ) : (
            <p style={{ color: "#666" }}>Das Protokoll ist noch leer.</p>
          )}
        </div>

        {data.resolutions.length > 0 && (
          <section style={{ marginTop: "12pt" }}>
            <h2 style={{ fontSize: "13pt", fontWeight: 700, margin: "0 0 4pt" }}>Übersicht der Beschlüsse</h2>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "9.5pt" }}>
              <thead>
                <tr>
                  {["Nr.", "Beschluss", "Abstimmung", "Ergebnis"].map((h) => (
                    <th key={h} style={{ border: "0.5pt solid #666", padding: "2pt 4pt", textAlign: "left", background: "#eee" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.resolutions.map((r) => (
                  <tr key={r.number}>
                    <td style={{ border: "0.5pt solid #666", padding: "2pt 4pt", verticalAlign: "top" }}>{r.number}</td>
                    <td style={{ border: "0.5pt solid #666", padding: "2pt 4pt", verticalAlign: "top" }}>
                      {r.text}
                      {r.recusal.trim() && <div style={{ color: "#444" }}>Ausstand: {r.recusal}</div>}
                    </td>
                    <td style={{ border: "0.5pt solid #666", padding: "2pt 4pt", verticalAlign: "top" }}>
                      {voteSummary(r) || "ohne Auszählung"}
                      <div style={{ color: "#444" }}>{MAJORITY_SHORT[r.majority as MajorityRule] ?? r.majority}</div>
                    </td>
                    <td style={{ border: "0.5pt solid #666", padding: "2pt 4pt", verticalAlign: "top" }}>{RESOLUTION_RESULT_LABEL[r.result as ResolutionResult] ?? r.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer style={{ marginTop: "18pt" }}>
          {approved ? (
            <p style={{ fontSize: "9.5pt" }}>
              Genehmigt am {formatDateCh(approved.on)} durch {approved.by}.
              {approved.note && <span style={{ display: "block", whiteSpace: "pre-line", color: "#333" }}>{approved.note}</span>}
            </p>
          ) : (
            <p style={{ fontSize: "9.5pt", fontWeight: 700 }}>Entwurf: Dieses Protokoll ist noch nicht genehmigt.</p>
          )}
          <div style={{ display: "flex", gap: "20mm", marginTop: "22pt", fontSize: "9.5pt" }}>
            {[data.leaderName ? `Leitung: ${data.leaderName}` : "Leitung", data.recorderName ? `Protokoll: ${data.recorderName}` : "Protokoll"].map((label) => (
              <div key={label} style={{ flex: 1 }}>
                <div style={{ borderTop: "0.5pt solid #000", paddingTop: "2pt" }}>{label}</div>
              </div>
            ))}
          </div>
        </footer>
      </article>
    </>
  );
}
