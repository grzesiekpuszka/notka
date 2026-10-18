import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui";

type Pending = { title: string; body: string; buttons: string[]; resolve(i: number): void };

let show: (d: Pending) => void = () => {};

/** Index of the pressed button; Escape picks the last one. The first button is the primary one. */
export const confirm = (title: string, body: string, buttons: string[]) =>
  new Promise<number>((resolve) => show({ title, body, buttons, resolve }));

export function DialogHost() {
  const [d, setD] = useState<Pending | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  show = setD;

  useEffect(() => {
    const root = document.getElementById("root")!;
    root.inert = !!d;
    first.current?.focus();
  }, [d]);

  if (!d) return null;
  const done = (i: number) => {
    setD(null);
    d.resolve(i);
  };
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30" onKeyDown={(e) => e.key === "Escape" && done(d.buttons.length - 1)}>
      <div role="dialog" aria-modal className="w-[400px] rounded-xl border border-line bg-surface p-5 text-fg shadow-2xl">
        <h2 className="mb-2 truncate text-base font-semibold">{d.title}</h2>
        <p className="mb-5 text-muted">{d.body}</p>
        <div className="flex justify-end gap-2">
          {d.buttons.map((b, i) => (
            <Button key={b} ref={i ? undefined : first} variant={i ? "default" : "primary"} onClick={() => done(i)}>
              {b}
            </Button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
