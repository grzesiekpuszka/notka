/** SemVer precedence: 1.0.1-beta.5 < 1.0.1 < 1.0.2-alpha; build metadata (+…) is ignored. */
export function newerVersion(a: string, b: string) {
  const parse = (v: string) => {
    const [main, pre] = v.split("+")[0].split(/-(.*)/s);
    return { nums: main.split(".").map(Number), pre: pre ? pre.split(".") : [] };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if ((x.nums[i] ?? 0) !== (y.nums[i] ?? 0)) return (x.nums[i] ?? 0) > (y.nums[i] ?? 0);
  if (!x.pre.length || !y.pre.length) return !x.pre.length && !!y.pre.length;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const [p, q] = [x.pre[i], y.pre[i]];
    if (p === undefined || q === undefined) return q === undefined;
    if (p === q) continue;
    const [pn, qn] = [/^\d+$/.test(p), /^\d+$/.test(q)];
    if (pn && qn) return Number(p) > Number(q);
    if (pn !== qn) return qn; // numeric identifiers sort before alphanumeric ones
    return p > q;
  }
  return false;
}
