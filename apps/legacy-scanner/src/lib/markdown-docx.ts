import { marked, type Token, type Tokens } from "marked";
import {
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";

/*
 * Turns the Markdown documents we generate (readiness report, privacy policy)
 * into a real .docx, so people can open and edit them in Word or Google Docs.
 * Covers what our templates use: headings, paragraphs, bold/italic/code,
 * links, lists, tables, block quotes and rules.
 */

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  code?: boolean;
  strike?: boolean;
}

function decode(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function run(text: string, style: RunStyle): TextRun {
  return new TextRun({
    text: decode(text),
    bold: style.bold,
    italics: style.italics,
    strike: style.strike,
    font: style.code ? "Consolas" : undefined,
  });
}

function inline(tokens: Token[] | undefined, style: RunStyle = {}): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const t of tokens ?? []) {
    switch (t.type) {
      case "strong":
        out.push(...inline((t as Tokens.Strong).tokens, { ...style, bold: true }));
        break;
      case "em":
        out.push(...inline((t as Tokens.Em).tokens, { ...style, italics: true }));
        break;
      case "del":
        out.push(...inline((t as Tokens.Del).tokens, { ...style, strike: true }));
        break;
      case "codespan":
        out.push(run((t as Tokens.Codespan).text, { ...style, code: true }));
        break;
      case "br":
        out.push(new TextRun({ text: "", break: 1 }));
        break;
      case "link": {
        const l = t as Tokens.Link;
        out.push(
          new ExternalHyperlink({
            link: l.href,
            children: [new TextRun({ text: decode(l.text), style: "Hyperlink", bold: style.bold })],
          })
        );
        break;
      }
      case "text": {
        const tx = t as Tokens.Text;
        if (tx.tokens?.length) out.push(...inline(tx.tokens, style));
        else out.push(run(tx.text, style));
        break;
      }
      default:
        if ("text" in t && typeof t.text === "string") out.push(run(t.text, style));
    }
  }
  return out;
}

function blocks(tokens: Token[], level = 0): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  for (const t of tokens) {
    switch (t.type) {
      case "heading": {
        const h = t as Tokens.Heading;
        out.push(new Paragraph({ heading: HEADINGS[Math.min(h.depth, 6) - 1], children: inline(h.tokens) }));
        break;
      }
      case "paragraph":
        out.push(new Paragraph({ children: inline((t as Tokens.Paragraph).tokens), spacing: { after: 120 } }));
        break;
      case "list": {
        const list = t as Tokens.List;
        list.items.forEach((item, i) => {
          const prefix = list.ordered ? `${(Number(list.start) || 1) + i}. ` : "";
          const box = item.task ? (item.checked ? "☑ " : "☐ ") : "";
          const [first, ...rest] = item.tokens;
          const firstRuns =
            first && (first.type === "text" || first.type === "paragraph")
              ? inline((first as Tokens.Text).tokens ?? [first])
              : [];
          out.push(
            new Paragraph({
              children: [new TextRun(prefix + box), ...firstRuns],
              ...(list.ordered ? { indent: { left: 360 * (level + 1) } } : { bullet: { level } }),
            })
          );
          const remaining = firstRuns.length ? rest : item.tokens;
          out.push(...blocks(remaining, level + 1));
        });
        break;
      }
      case "table": {
        const tb = t as Tokens.Table;
        const cell = (c: Tokens.TableCell, header: boolean) =>
          new TableCell({
            children: [new Paragraph({ children: inline(c.tokens, { bold: header }) })],
          });
        out.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ tableHeader: true, children: tb.header.map((c) => cell(c, true)) }),
              ...tb.rows.map((r) => new TableRow({ children: r.map((c) => cell(c, false)) })),
            ],
          }),
          new Paragraph({ text: "" })
        );
        break;
      }
      case "blockquote": {
        const inner = blocks((t as Tokens.Blockquote).tokens, level);
        for (const p of inner) {
          out.push(p);
        }
        break;
      }
      case "code":
        for (const line of (t as Tokens.Code).text.split("\n")) {
          out.push(new Paragraph({ children: [run(line || " ", { code: true })] }));
        }
        break;
      case "hr":
        out.push(
          new Paragraph({
            text: "",
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BBBBBB", space: 1 } },
          })
        );
        break;
      case "space":
        break;
      default:
        if ("text" in t && typeof t.text === "string" && t.text.trim()) {
          out.push(new Paragraph({ children: [run(t.text, {})] }));
        }
    }
  }
  return out;
}

export async function markdownToDocx(markdown: string, title: string): Promise<Blob> {
  const doc = new Document({
    title,
    creator: "NDPA Lens",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children: blocks(marked.lexer(markdown)) }],
  });
  return Packer.toBlob(doc);
}
