import { Fragment, type ReactNode } from 'react';

function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}

/** Renders the small Markdown subset used by learning articles without injecting HTML. */
export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const key = `b${index}`;
    if (!line.trim()) { index += 1; continue; }
    if (line.startsWith('## ')) {
      blocks.push(<h2 key={key}>{inline(line.slice(3), key)}</h2>);
      index += 1;
    } else if (line.startsWith('> ')) {
      blocks.push(<blockquote key={key}>{inline(line.slice(2), key)}</blockquote>);
      index += 1;
    } else if (/^(- |\d+\. )/.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items: string[] = [];
      while (index < lines.length && (ordered ? /^\d+\. /.test(lines[index]) : lines[index].startsWith('- '))) {
        items.push(lines[index].replace(/^(- |\d+\. )/, ''));
        index += 1;
      }
      const children = items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, `${key}-${itemIndex}`)}</li>);
      blocks.push(ordered ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>);
    } else {
      const paragraph: string[] = [];
      while (index < lines.length && lines[index].trim() && !/^(## |> |- |\d+\. )/.test(lines[index])) {
        paragraph.push(lines[index]);
        index += 1;
      }
      blocks.push(<p key={key}>{inline(paragraph.join(' '), key)}</p>);
    }
  }
  return <div className="prose">{blocks}</div>;
}
