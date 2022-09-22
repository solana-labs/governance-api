import { map } from 'fp-ts/TaskEither';

interface Span {
  id: string;
  title?: string;
  duration: number;
}

const TIMERS = new Map<string, number>();
const SPANS = new Map<string, Span[]>();
let cur = 0;

function printSpan(span: Span, depth = 1) {
  const indent = Array.from({ length: depth }).map(() => '').join('  ');
  const formatter = new Intl.NumberFormat();
  const children = SPANS.get(span.id);

  console.log(`${indent}Timer ${span.id}`);

  if (span.title) {
    console.log(`${indent}  ${span.title}`);
  }

  console.log(`${indent}  Duration: ${formatter.format(span.duration)}ms`)

  if (children && children.length) {
    for (const child of children) {
      printSpan(child, depth + 1);
    }
  }
}

export function start(id?: string) {
  const key = id || (cur++).toString();
  TIMERS.set(key, Date.now())
  return key;
}

export function startTE<R>(id: string) {
  return map<R, R>(result => {
    start(id);
    return result;
  });
}

export function end(id: string, parentId?: string, title?: string) {
  const start = TIMERS.get(id);

  if (start) {
    TIMERS.delete(id);

    const span: Span = {
      id,
      title,
      duration: Date.now() - start,
    };

    if (parentId) {
      const curSpans = SPANS.get(parentId);
      SPANS.set(parentId, (curSpans || []).concat(span));
    } else {
      printSpan(span);
    }
  }
}

export function endTE<R>(id: string, parentId?: string, title?: string) {
  return map<R, R>(result => {
    end(id, parentId, title);
    return result;
  });
}
