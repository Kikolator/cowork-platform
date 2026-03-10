"use client";

import { useState, useCallback } from "react";
import { createTenantAndSpace, checkSlugAvailable } from "./actions";

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
  capacity: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const labelClass =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

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
  const [deskCount, setDeskCount] = useState(10);

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
      deskCount,
      rooms: rooms.map((r) => ({
        type: r.type,
        name: r.name,
        capacity: r.capacity,
      })),
    });

    if (result.success && result.spaceSlug) {
      window.location.href = `${window.location.protocol}//${result.spaceSlug}.${PLATFORM_DOMAIN}/dashboard`;
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
      <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
        <span
          className={
            step === 1
              ? "font-medium text-zinc-900 dark:text-zinc-50"
              : "text-zinc-400"
          }
        >
          1. Business
        </span>
        <span>→</span>
        <span
          className={
            step === 2
              ? "font-medium text-zinc-900 dark:text-zinc-50"
              : "text-zinc-400"
          }
        >
          2. Configure
        </span>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
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
                className="block w-full rounded-l-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                placeholder="savage"
              />
              <span className="inline-flex items-center rounded-r-md border border-l-0 border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
                .{PLATFORM_DOMAIN.split(":")[0]}
              </span>
            </div>
            <p className="mt-1 text-xs">
              {slugStatus === "checking" && (
                <span className="text-zinc-500">Checking...</span>
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
                className="mt-1 block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
              />
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <input
                type="text"
                value={currency.toUpperCase()}
                readOnly
                className="mt-1 block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
              />
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!canProceed}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
              onChange={(e) => setDeskCount(parseInt(e.target.value) || 1)}
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
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                + Add room
              </button>
            </div>

            {rooms.length === 0 && (
              <p className="mt-2 text-sm text-zinc-400">
                No rooms added yet. Click &quot;+ Add room&quot; to add meeting
                rooms, podcast rooms, etc.
              </p>
            )}

            <div className="mt-2 space-y-3">
              {rooms.map((room) => (
                <div
                  key={room.clientId}
                  className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <div className="flex items-start gap-3">
                    {/* Type */}
                    <div className="flex-1">
                      <select
                        value={room.type}
                        onChange={(e) =>
                          handleRoomTypeChange(room.clientId, e.target.value)
                        }
                        className="block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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
                      className="mt-1 text-sm text-zinc-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {/* Name */}
                    <div>
                      <label className="text-xs text-zinc-500">Name</label>
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) =>
                          updateRoom(room.clientId, { name: e.target.value })
                        }
                        className="block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        placeholder="Room name"
                      />
                    </div>
                    {/* Capacity */}
                    <div>
                      <label className="text-xs text-zinc-500">Capacity</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={room.capacity}
                        onChange={(e) =>
                          updateRoom(room.clientId, {
                            capacity: parseInt(e.target.value) || 1,
                          })
                        }
                        className="block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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
                        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
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
                          className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                        <span className="text-sm text-zinc-400">–</span>
                        <input
                          type="time"
                          value={day.close}
                          onChange={(e) =>
                            updateDay(key, { close: e.target.value })
                          }
                          className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-400">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={pending}
              className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {pending ? "Creating..." : "Create space"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
