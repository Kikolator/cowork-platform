"use client";

import { useState, useCallback } from "react";
import { createTenantAndSpace, checkSlugAvailable } from "./actions";
import { buildSpaceUrlClient } from "@/lib/url";

const PLATFORM_DOMAIN =
  process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "localhost:3000";

const COUNTRIES = [
  { code: "ES", name: "Spain", timezone: "Europe/Madrid", currency: "eur" },
  { code: "PT", name: "Portugal", timezone: "Europe/Lisbon", currency: "eur" },
  { code: "FR", name: "France", timezone: "Europe/Paris", currency: "eur" },
  { code: "DE", name: "Germany", timezone: "Europe/Berlin", currency: "eur" },
  { code: "IT", name: "Italy", timezone: "Europe/Rome", currency: "eur" },
  { code: "NL", name: "Netherlands", timezone: "Europe/Amsterdam", currency: "eur" },
  { code: "GB", name: "United Kingdom", timezone: "Europe/London", currency: "gbp" },
  { code: "US", name: "United States", timezone: "America/New_York", currency: "usd" },
] as const;

const ROOM_TYPES = [
  { value: "meeting_room", label: "Meeting Room", defaultCapacity: 7 },
  { value: "podcast_room", label: "Podcast Room", defaultCapacity: 3 },
  { value: "private_office", label: "Private Office", defaultCapacity: 4 },
  { value: "event_space", label: "Event Space", defaultCapacity: 30 },
  { value: "phone_booth", label: "Phone Booth", defaultCapacity: 1 },
] as const;

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];

interface DayHours {
  enabled: boolean;
  open: string;
  close: string;
}

interface Room {
  clientId: string;
  type: string;
  name: string;
  capacity: number | string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

const inputClass =
  "mt-1 block w-full rounded-xl border border-[var(--glass-border)] bg-white/50 px-3 py-2.5 text-sm shadow-sm backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-white/5";
const labelClass =
  "block text-sm font-medium text-foreground/80";
const smallInputClass =
  "block w-full rounded-xl border border-[var(--glass-border)] bg-white/50 px-2 py-1.5 text-sm backdrop-blur-sm transition-all duration-200 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-white/5";

export function OnboardForm() {
  const [step, setStep] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");

  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [countryCode, setCountryCode] = useState("ES");
  const [timezone, setTimezone] = useState("Europe/Madrid");
  const [currency, setCurrency] = useState("eur");
  const [deskCount, setDeskCount] = useState<number | string>(10);

  const [rooms, setRooms] = useState<Room[]>([]);

  const [businessHours, setBusinessHours] = useState<Record<DayKey, DayHours>>(
    {
      mon: { enabled: true, open: "09:00", close: "18:00" },
      tue: { enabled: true, open: "09:00", close: "18:00" },
      wed: { enabled: true, open: "09:00", close: "18:00" },
      thu: { enabled: true, open: "09:00", close: "18:00" },
      fri: { enabled: true, open: "09:00", close: "18:00" },
      sat: { enabled: false, open: "09:00", close: "18:00" },
      sun: { enabled: false, open: "09:00", close: "18:00" },
    }
  );

  function handleNameChange(name: string) {
    setBusinessName(name);
    const newSlug = slugify(name);
    setSlug(newSlug);
    if (newSlug.length >= 2) {
      doCheckSlug(newSlug);
    } else {
      setSlugStatus("idle");
    }
  }

  function handleSlugChange(value: string) {
    const cleaned = slugify(value);
    setSlug(cleaned);
    if (cleaned.length >= 2) {
      doCheckSlug(cleaned);
    } else {
      setSlugStatus("idle");
    }
  }

  async function doCheckSlug(s: string) {
    setSlugStatus("checking");
    const available = await checkSlugAvailable(s);
    setSlugStatus(available ? "available" : "taken");
  }

  function handleCountryChange(code: string) {
    const country = COUNTRIES.find((c) => c.code === code);
    if (country) {
      setCountryCode(country.code);
      setTimezone(country.timezone);
      setCurrency(country.currency);
    }
  }

  // Room management
  function addRoom() {
    const defaultType = ROOM_TYPES[0];
    setRooms((prev) => [
      ...prev,
      {
        clientId: crypto.randomUUID(),
        type: defaultType.value,
        name: defaultType.label,
        capacity: defaultType.defaultCapacity,
      },
    ]);
  }

  function updateRoom(clientId: string, updates: Partial<Room>) {
    setRooms((prev) =>
      prev.map((r) => (r.clientId === clientId ? { ...r, ...updates } : r))
    );
  }

  function removeRoom(clientId: string) {
    setRooms((prev) => prev.filter((r) => r.clientId !== clientId));
  }

  function handleRoomTypeChange(clientId: string, type: string) {
    const preset = ROOM_TYPES.find((rt) => rt.value === type);
    updateRoom(clientId, {
      type,
      name: preset?.label ?? type,
      capacity: preset?.defaultCapacity ?? 4,
    });
  }

  // Business hours
  function updateDay(day: DayKey, updates: Partial<DayHours>) {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...updates },
    }));
  }

  async function handleSubmit() {
    setPending(true);
    setError(null);

    const hoursPayload = Object.fromEntries(
      DAYS.map(({ key }) => {
        const day = businessHours[key];
        return [key, day.enabled ? { open: day.open, close: day.close } : null];
      })
    );

    const result = await createTenantAndSpace({
      businessName,
      slug,
      countryCode,
      timezone,
      currency,
      businessHours: hoursPayload as Record<
        DayKey,
        { open: string; close: string } | null
      >,
      deskCount: Number(deskCount) || 1,
      rooms: rooms.map((r) => ({
        type: r.type,
        name: r.name,
        capacity: Number(r.capacity) || 1,
      })),
    });

    if (result.success && result.spaceSlug) {
      window.location.href = buildSpaceUrlClient(result.spaceSlug, "/dashboard");
    } else {
      setError(result.error ?? "Something went wrong");
      setPending(false);
    }
  }

  const canProceed =
    businessName.length >= 2 && slug.length >= 2 && slugStatus === "available";

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span
          className={
            step === 1
              ? "font-medium text-foreground"
              : "text-muted-foreground/50"
          }
        >
          1. Business
        </span>
        <span className="text-muted-foreground/40">→</span>
        <span
          className={
            step === 2
              ? "font-medium text-foreground"
              : "text-muted-foreground/50"
          }
        >
          2. Configure
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-700 backdrop-blur-sm dark:text-red-300">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Business name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => handleNameChange(e.target.value)}
              className={inputClass}
              placeholder="Savage Coworking"
            />
          </div>

          <div>
            <label className={labelClass}>URL slug</label>
            <div className="mt-1 flex items-center">
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                className="block w-full rounded-l-xl border border-[var(--glass-border)] bg-white/50 px-3 py-2.5 text-sm shadow-sm backdrop-blur-sm transition-all duration-200 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-white/5"
                placeholder="savage"
              />
              <span className="inline-flex items-center rounded-r-xl border border-l-0 border-[var(--glass-border)] bg-white/30 px-3 py-2.5 text-sm text-muted-foreground dark:bg-white/5">
                .{PLATFORM_DOMAIN.split(":")[0]}
              </span>
            </div>
            <p className="mt-1 text-xs">
              {slugStatus === "checking" && (
                <span className="text-muted-foreground">Checking...</span>
              )}
              {slugStatus === "available" && (
                <span className="text-green-600">Available</span>
              )}
              {slugStatus === "taken" && (
                <span className="text-red-600">Already taken</span>
              )}
            </p>
          </div>

          <div>
            <label className={labelClass}>Country</label>
            <select
              value={countryCode}
              onChange={(e) => handleCountryChange(e.target.value)}
              className={inputClass}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Timezone</label>
              <input
                type="text"
                value={timezone}
                readOnly
                className="mt-1 block w-full rounded-xl border border-[var(--glass-border)] bg-white/30 px-3 py-2.5 text-sm text-muted-foreground dark:bg-white/5"
              />
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <input
                type="text"
                value={currency.toUpperCase()}
                readOnly
                className="mt-1 block w-full rounded-xl border border-[var(--glass-border)] bg-white/30 px-3 py-2.5 text-sm text-muted-foreground dark:bg-white/5"
              />
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!canProceed}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {/* Desks */}
          <div>
            <label className={labelClass}>Number of desks</label>
            <input
              type="number"
              min={1}
              max={200}
              value={deskCount}
              onChange={(e) =>
                setDeskCount(e.target.value === "" ? "" : parseInt(e.target.value) || 1)
              }
              onBlur={() => {
                if (deskCount === "" || Number(deskCount) < 1) setDeskCount(1);
              }}
              className={inputClass}
            />
          </div>

          {/* Dynamic rooms */}
          <div>
            <div className="flex items-center justify-between">
              <label className={labelClass}>Rooms</label>
              <button
                type="button"
                onClick={addRoom}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                + Add room
              </button>
            </div>

            {rooms.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground/60">
                No rooms added yet. Click &quot;+ Add room&quot; to add meeting
                rooms, podcast rooms, etc.
              </p>
            )}

            <div className="mt-2 space-y-3">
              {rooms.map((room) => (
                <div
                  key={room.clientId}
                  className="rounded-xl border border-[var(--glass-border)] bg-white/40 p-3 backdrop-blur-sm dark:bg-white/5"
                >
                  <div className="flex items-start gap-3">
                    {/* Type */}
                    <div className="flex-1">
                      <select
                        value={room.type}
                        onChange={(e) =>
                          handleRoomTypeChange(room.clientId, e.target.value)
                        }
                        className={smallInputClass}
                      >
                        {ROOM_TYPES.map((rt) => (
                          <option key={rt.value} value={rt.value}>
                            {rt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeRoom(room.clientId)}
                      className="mt-1 text-sm text-muted-foreground/60 transition-colors hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {/* Name */}
                    <div>
                      <label className="text-xs text-muted-foreground">Name</label>
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) =>
                          updateRoom(room.clientId, { name: e.target.value })
                        }
                        className={smallInputClass}
                        placeholder="Room name"
                      />
                    </div>
                    {/* Capacity */}
                    <div>
                      <label className="text-xs text-muted-foreground">Capacity</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={room.capacity}
                        onChange={(e) =>
                          updateRoom(room.clientId, {
                            capacity: e.target.value === "" ? "" : parseInt(e.target.value) || 1,
                          })
                        }
                        onBlur={() => {
                          if (room.capacity === "" || Number(room.capacity) < 1)
                            updateRoom(room.clientId, { capacity: 1 });
                        }}
                        className={smallInputClass}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Business hours */}
          <div>
            <label className={labelClass}>Business hours</label>
            <div className="mt-2 space-y-2">
              {DAYS.map(({ key, label }) => {
                const day = businessHours[key];
                return (
                  <div key={key} className="flex items-center gap-3">
                    <label className="flex w-24 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(e) =>
                          updateDay(key, { enabled: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-[var(--glass-border)]"
                      />
                      <span className="text-sm text-foreground/80">
                        {label.slice(0, 3)}
                      </span>
                    </label>
                    {day.enabled ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={day.open}
                          onChange={(e) =>
                            updateDay(key, { open: e.target.value })
                          }
                          className="rounded-xl border border-[var(--glass-border)] bg-white/50 px-2 py-1 text-sm backdrop-blur-sm transition-all duration-200 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-white/5"
                        />
                        <span className="text-sm text-muted-foreground/50">–</span>
                        <input
                          type="time"
                          value={day.close}
                          onChange={(e) =>
                            updateDay(key, { close: e.target.value })
                          }
                          className="rounded-xl border border-[var(--glass-border)] bg-white/50 px-2 py-1 text-sm backdrop-blur-sm transition-all duration-200 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-white/5"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground/50">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl border border-[var(--glass-border)] bg-white/40 px-4 py-2.5 text-sm font-medium text-foreground/80 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white/60 dark:bg-white/5 dark:hover:bg-white/10"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={pending}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
            >
              {pending ? "Creating..." : "Create space"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
