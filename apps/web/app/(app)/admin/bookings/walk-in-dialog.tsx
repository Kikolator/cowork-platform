"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { adminCreateWalkIn, getWalkInFormData } from "./actions";

// 30-min intervals from 07:00 to 22:00
const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 22; h++) {
  for (const m of [0, 30]) {
    if (h === 22 && m === 30) continue;
    TIME_OPTIONS.push(
      `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
    );
  }
}

interface WalkInDialogProps {
  date: string;
  onCreated: () => void;
}

export function WalkInDialog({ date, onCreated }: WalkInDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState<Awaited<
    ReturnType<typeof getWalkInFormData>
  > | null>(null);
  const [memberId, setMemberId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [error, setError] = useState<string | null>(null);

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && !formData) {
      startTransition(async () => {
        const data = await getWalkInFormData();
        setFormData(data);
      });
    }
    if (!isOpen) {
      setError(null);
    }
  }

  function handleSubmit() {
    if (!memberId || !resourceId) return;
    if (startTime >= endTime) {
      setError("End time must be after start time");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await adminCreateWalkIn(
        memberId,
        resourceId,
        date,
        startTime,
        endTime,
      );
      if (!result.success) {
        setError(result.error);
      } else {
        setOpen(false);
        setMemberId("");
        setResourceId("");
        setStartTime("09:00");
        setEndTime("10:00");
        onCreated();
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Walk-in Booking
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Walk-in Booking</DialogTitle>
            <DialogDescription>
              Create a booking without credit deduction.
            </DialogDescription>
          </DialogHeader>

          {!formData ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Member</Label>
                <Select value={memberId} onValueChange={(v) => v && setMemberId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Resource</Label>
                <Select value={resourceId} onValueChange={(v) => v && setResourceId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select resource" />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.resources.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Start time</Label>
                  <Select value={startTime} onValueChange={(v) => v && setStartTime(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>End time</Label>
                  <Select value={endTime} onValueChange={(v) => v && setEndTime(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !memberId || !resourceId}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
