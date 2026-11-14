import { Fragment } from 'react';
import type { ReactNode } from 'react';

/**
 * Translated text with markup in it: each {key} left in the text becomes the matching element.
 *   rich(tn(n, 'You have {h} hint.', 'You have {h} hints.'), { h: <strong>{n}</strong> })
 */
export function rich(text: string, parts: Record<string, ReactNode>): ReactNode {
  return text.split(/(\{\w+\})/).map((piece, i) => {
    const key = /^\{(\w+)\}$/.exec(piece)?.[1];
    return <Fragment key={i}>{key && key in parts ? parts[key] : piece}</Fragment>;
  });
}
