// Finds every English string the code passes to t(), tn() or msg(), for the translation check
// (src/i18n/i18n.test.ts). Only tests import this: it reads the source with the TypeScript compiler.

import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface Found {
  text: string;
  file: string;
  /** A plural form: one of the two texts of a tn() call. */
  plural?: boolean;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !p.includes(`${join('src', 'i18n')}`) ? [p] : [];
  });
}

const literal = (n: ts.Node | undefined) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null);

/** Every translatable string under `root` (the src folder), with the file it's in. */
export function collectKeys(root: string): Found[] {
  const out: Found[] = [];
  for (const file of files(root)) {
    const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        if (name === 't' || name === 'tr' || name === 'msg') {
          const text = literal(node.arguments[0]);
          if (text !== null) out.push({ text, file });
        } else if (name === 'tn') {
          for (const a of [node.arguments[1], node.arguments[2]]) {
            const text = literal(a);
            if (text !== null) out.push({ text, file, plural: true });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(src);
  }
  return out;
}

/** The {placeholders} in a text, sorted, so a translation can be checked against its English. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}
