"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addMemberNote } from "./actions";

const NOTE_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "billing", label: "Billing" },
  { value: "access", label: "Access" },
  { value: "incident", label: "Incident" },
  { value: "support", label: "Support" },
] as const;

interface MemberNoteFormProps {
  memberId: string;
}

export function MemberNoteForm({ memberId }: MemberNoteFormProps) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string | null>("general");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!content.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addMemberNote({
        memberId,
        content: content.trim(),
        category: category ?? "general",
      });
      if (!result.success) {
        setError(result.error);
      } else {
        setContent("");
        setCategory("general");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Add a note..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        className="resize-none"
      />
      <div className="flex items-center gap-2">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NOTE_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isPending || !content.trim()}
        >
          {isPending ? "Adding..." : "Add note"}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
