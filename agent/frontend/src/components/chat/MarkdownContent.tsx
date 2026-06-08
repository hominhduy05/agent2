"use client";

import { Fragment, ReactNode } from "react";

interface Props {
  content: string;
}

function isTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isTableStart(lines: string[], index: number) {
  return lines[index]?.includes("|") && isTableSeparator(lines[index + 1] || "");
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseInline(text: string): ReactNode[] {
  const normalized = text.replace(/<br\s*\/?>/gi, "\n");
  const parts = normalized.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return parts.flatMap((part, index) => {
    if (!part) return [];

    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return part.split("\n").flatMap((line, lineIndex, arr) => [
      <Fragment key={`${index}-${lineIndex}`}>{line}</Fragment>,
      lineIndex < arr.length - 1 ? <br key={`${index}-${lineIndex}-br`} /> : null,
    ]).filter(Boolean);
  });
}

function renderParagraph(lines: string[], key: string) {
  return <p key={key}>{parseInline(lines.join("\n"))}</p>;
}

export function MarkdownContent({ content }: Props) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${i}`} />);
      i += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = Math.min(heading[1].length, 4);
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      blocks.push(<Tag key={`h-${i}`}>{parseInline(heading[2])}</Tag>);
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(<blockquote key={`q-${i}`}>{renderParagraph(quoteLines, `qp-${i}`)}</blockquote>);
      continue;
    }

    if (isTableStart(lines, i)) {
      const headers = splitTableRow(lines[i]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div className="md-table-wrap" key={`table-${i}`}>
          <table>
            <thead>
              <tr>
                {headers.map((cell, cellIndex) => (
                  <th key={cellIndex}>{parseInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map((_, cellIndex) => (
                    <td key={cellIndex}>{parseInline(row[cellIndex] || "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{parseInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{parseInline(item)}</li>)}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length
      && lines[i].trim()
      && !/^(#{1,4})\s+/.test(lines[i].trim())
      && !/^---+$/.test(lines[i].trim())
      && !lines[i].trim().startsWith(">")
      && !isTableStart(lines, i)
      && !/^[-*]\s+/.test(lines[i].trim())
      && !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i]);
      i += 1;
    }
    blocks.push(renderParagraph(paragraphLines, `p-${i}`));
  }

  return <div className="md-content">{blocks}</div>;
}
