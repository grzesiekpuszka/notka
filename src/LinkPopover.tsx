import { useEffect, useRef, useState } from "react";
import { t } from "./i18n";
import { Button } from "./ui";

type Props = { initial: string; onSubmit(url: string): void; onClose(): void };

export default function LinkPopover({ initial, onSubmit, onClose }: Props) {
  const [url, setUrl] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.select(), []);

  return (
    <form
      className="absolute top-1 left-2 z-20 flex items-center gap-1.5 rounded-lg border border-line bg-surface p-1.5 shadow-lg"
      onSubmit={(e) => {
        e.preventDefault();
        if (url.trim()) onSubmit(url.trim());
      }}
    >
      <input
        ref={input}
        value={url}
        placeholder={t("Link address")}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        onBlur={(e) => !e.currentTarget.form?.contains(e.relatedTarget) && onClose()}
        className="h-7 w-72 rounded-md border border-line bg-surface px-2 outline-none focus:border-accent"
      />
      <Button type="submit" variant="primary" className="h-7">
        {t("Insert")}
      </Button>
    </form>
  );
}
