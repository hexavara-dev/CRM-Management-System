"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeRichText, sanitizeRichTextHtml } from "./rich-text";

const TOOLBAR_ITEMS = [
  { label: "Tebal", icon: Bold, command: "bold" },
  { label: "Miring", icon: Italic, command: "italic" },
  { label: "Garis bawah", icon: Underline, command: "underline" },
  { label: "Daftar bullet", icon: List, command: "insertUnorderedList" },
  { label: "Daftar bernomor", icon: ListOrdered, command: "insertOrderedList" },
  { label: "Hapus format", icon: RemoveFormatting, command: "removeFormat" },
] as const;

export function MiniRichTextEditor({
  name,
  initialValue = "",
  placeholder = "Tulis deskripsi proyek",
  className,
}: {
  name: string;
  initialValue?: string;
  placeholder?: string;
  className?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(() => normalizeRichText(initialValue));

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = normalizeRichText(initialValue);
  }, [initialValue]);

  const syncValue = () => {
    const nextValue = sanitizeRichTextHtml(editorRef.current?.innerHTML ?? "");
    setValue(nextValue);
    if (editorRef.current && editorRef.current.innerHTML !== nextValue) {
      editorRef.current.innerHTML = nextValue;
    }
  };

  const execute = (command: (typeof TOOLBAR_ITEMS)[number]["command"]) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    syncValue();
  };

  return (
    <div className={cn("flex min-h-72 flex-col overflow-hidden rounded-md border border-[#D9D9DE] focus-within:border-[#1980C0] focus-within:ring-2 focus-within:ring-[#1980C0]/20", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-[#E8E8EC] bg-[#FAFBFC] p-1.5">
        {TOOLBAR_ITEMS.map(({ label, icon: Icon, command }) => (
          <button
            key={command}
            type="button"
            title={label}
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => execute(command)}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded text-[#475467] transition hover:bg-[#E5F1FA] hover:text-[#1980C0]"
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={syncValue}
        onBlur={syncValue}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 text-xs leading-5 text-[#1f1f1f] outline-none empty:before:pointer-events-none empty:before:text-[#98A2B3] empty:before:content-[attr(data-placeholder)] [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
      />
      <input type="hidden" name={name} value={value} readOnly />
    </div>
  );
}
