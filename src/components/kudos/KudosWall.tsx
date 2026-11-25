"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Star, Loader2 } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { refreshGami } from "@/components/gamification/GamificationBar";
import { fireConfetti } from "@/lib/confetti";

const MSG_MAX = 50;
const CATS = ["Kerja sama", "Inisiatif", "Teliti", "Cepat tanggap", "Inspiratif"];
const TEMPLATES = [
  "Terima kasih sudah membantu!",
  "Kerja bagus minggu ini!",
  "Kolaborasinya menyenangkan",
  "Selalu cepat tanggap",
];

// --- helpers ---

function kudosTimeAgo(iso: string): string {
  const d = new Date(iso);
  const TZ = "Asia/Jakarta";
  const toDateStr = (dt: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(dt);
  const now = new Date();
  if (toDateStr(d) === toDateStr(now)) return "Hari ini";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (toDateStr(d) === toDateStr(yesterday)) return "Kemarin";
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(d);
}

function nameHue(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- types ---

type Person = { id: string; name: string; jobTitle: string | null; departmentName: string | null; photoDataUrl: string | null };
type Comment = { id: string; message: string; createdAt: string; name: string; photoDataUrl: string | null };
type KudosItem = {
  id: string; message: string; category: string | null; createdAt: string;
  sender: { id: string; name: string; photoDataUrl: string | null; departmentName: string | null };
  recipient: { id: string; name: string; photoDataUrl: string | null; departmentName: string | null };
  likeCount: number; commentCount: number; likedByMe: boolean; comments: Comment[];
};
type Meta = { quota: number; used: number; remaining: number; myPoints: number };
type Stats = { receivedCount: number; sentCount: number; topRecipients: { id: string; name: string; count: number; photoDataUrl: string | null }[] };

// --- Avatar component ---

function Avatar({ name, photo, size = "md" }: { name: string; photo: string | null; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-7 w-7 text-[11px]" : "h-10 w-10 text-sm";
  const hue = nameHue(name);
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} className={`${cls} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center rounded-full font-bold`}
      style={{ background: `hsl(${hue} 65% 88%)`, color: `hsl(${hue} 50% 32%)` }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

// --- main component ---

export function KudosWall({ meName, meId }: { meName: string; meId: string }) {
  // Data
  const [items, setItems] = useState<KudosItem[] | null>(null);
  const [meta, setMeta] = useState<Meta>({ quota: 5, used: 0, remaining: 5, myPoints: 0 });
  const [stats, setStats] = useState<Stats | null>(null);
  const [people, setPeople] = useState<Person[]>([]);

  // UI
  const [tab, setTab] = useState<"all" | "me" | "mine">("all");
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);

  // Composer fields
  const [recipientId, setRecipientId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientDept, setRecipientDept] = useState("");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ recipient?: string; message?: string }>({});

  // Recipient picker
  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHi, setSearchHi] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Comments
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [commentSending, setCommentSending] = useState<Record<string, boolean>>({});

  // Load functions
  const loadFeed = useCallback(async () => {
    try {
      const r = await fetch("/api/kudos");
      if (!r.ok) { setItems([]); return; }
      const d = await r.json();
      setItems(Array.isArray(d) ? d : (d.items ?? []));
      if (d.meta) setMeta(d.meta);
    } catch { setItems([]); }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch("/api/kudos/stats");
      if (r.ok) setStats(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    loadFeed();
    loadStats();
    fetch("/api/employees/coworkers")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPeople)
      .catch(() => {});
  }, [loadFeed, loadStats]);

  // Close picker on outside click
  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, []);

  // Send kudos
  async function send() {
    const errors: { recipient?: string; message?: string } = {};
    if (!recipientId) errors.recipient = "Pilih rekan kerja yang ingin diapresiasi.";
    if (message.trim().length < 3) errors.message = "Tulis pesan apresiasi (minimal 3 karakter).";
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setSending(true);
    try {
      const res = await fetch("/api/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, message: message.trim(), category: category || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Gagal kirim kudos");
      toast(`Kudos terkirim ke ${titleCase(recipientName.split(" ")[0])}! +25 poin untukmu dan penerima.`, "success");
      resetComposer();
      refreshGami();
      fireConfetti();
      loadFeed();
      loadStats();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  }

  function resetComposer() {
    setComposing(false);
    setRecipientId(""); setRecipientName(""); setRecipientDept("");
    setCategory(""); setMessage(""); setFieldErrors({});
    setSearchQ(""); setSearchOpen(false);
  }

  // Like (optimistic)
  async function like(id: string) {
    setItems((prev) => prev?.map((k) => k.id === id ? { ...k, likedByMe: !k.likedByMe, likeCount: k.likeCount + (k.likedByMe ? -1 : 1) } : k) ?? null);
    try { await fetch(`/api/kudos/${id}/like`, { method: "POST" }); }
    catch { loadFeed(); }
  }

  // Comment
  async function addComment(id: string) {
    const text = (commentTexts[id] ?? "").trim();
    if (!text) return;
    setCommentSending((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/kudos/${id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error();
      setCommentTexts((p) => ({ ...p, [id]: "" }));
      loadFeed();
    } catch {
      toast("Gagal mengirim komentar", "error");
    } finally {
      setCommentSending((p) => ({ ...p, [id]: false }));
    }
  }

  // Recipient picker
  const filteredPeople = people.filter((p) =>
    (p.name + " " + (p.departmentName ?? "") + " " + (p.jobTitle ?? "")).toLowerCase().includes(searchQ.toLowerCase())
  );

  function pickRecipient(p: Person) {
    setRecipientId(p.id); setRecipientName(p.name); setRecipientDept(p.departmentName ?? p.jobTitle ?? "");
    setSearchOpen(false); setSearchQ(""); setFieldErrors((e) => ({ ...e, recipient: undefined }));
  }

  function clearRecipient() {
    setRecipientId(""); setRecipientName(""); setRecipientDept("");
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  // Filtered feed
  const filteredItems = (items ?? []).filter((k) =>
    tab === "all" ? true : tab === "me" ? k.recipient.id === meId : k.sender.id === meId
  );
  const counts = {
    all: items?.length ?? 0,
    me: items?.filter((k) => k.recipient.id === meId).length ?? 0,
    mine: items?.filter((k) => k.sender.id === meId).length ?? 0,
  };
  const canCompose = meta.remaining > 0;

  return (
    <div>
      {/* Page header with chips */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Kudos Wall</h1>
          <p className="mt-0.5 text-sm text-slate-500">Beri apresiasi ke rekan kerja. Tiap kirim kudos: +25 poin untukmu dan penerima.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            {meta.myPoints} poin
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-700" title="Jatah kudos yang tersisa hari ini">
            <Heart className="h-3.5 w-3.5" />
            {meta.remaining}/{meta.quota} kudos
          </div>
        </div>
      </div>

      {/* 2-col layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div>
          {/* Composer */}
          <div className="mb-5 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
            {!composing ? (
              <button
                disabled={!canCompose}
                onClick={() => { setComposing(true); setTimeout(() => searchInputRef.current?.focus(), 60); }}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
                  canCompose ? "hover:bg-slate-50/70 cursor-pointer" : "cursor-not-allowed opacity-70"
                )}
              >
                <Avatar name={meName} photo={null} size="sm" />
                <span className="flex-1 text-sm text-slate-400">
                  {canCompose ? "Tulis apresiasi untuk rekan kerja…" : "Jatah kudos hari ini habis. Reset besok."}
                </span>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", canCompose ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500")}>
                  Sisa {meta.remaining} kudos
                </span>
              </button>
            ) : (
              <div className="space-y-4 p-5">
                {/* Recipient */}
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-800">Untuk siapa?</label>
                  {recipientId ? (
                    <div className="flex items-center gap-2 rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <Avatar name={recipientName} photo={null} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate">{titleCase(recipientName)}</div>
                        {recipientDept && <div className="text-xs text-slate-400">{recipientDept}</div>}
                      </div>
                      <button onClick={clearRecipient} className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label="Ganti penerima">×</button>
                    </div>
                  ) : (
                    <div ref={pickerRef} className="relative">
                      <input
                        ref={searchInputRef}
                        value={searchQ}
                        onChange={(e) => { setSearchQ(e.target.value); setSearchOpen(true); setSearchHi(0); setFieldErrors((p) => ({ ...p, recipient: undefined })); }}
                        onFocus={() => setSearchOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown") { e.preventDefault(); setSearchHi((h) => Math.min(h + 1, filteredPeople.length - 1)); }
                          else if (e.key === "ArrowUp") { e.preventDefault(); setSearchHi((h) => Math.max(h - 1, 0)); }
                          else if (e.key === "Enter" && filteredPeople[searchHi]) { e.preventDefault(); pickRecipient(filteredPeople[searchHi]); }
                          else if (e.key === "Escape") setSearchOpen(false);
                        }}
                        placeholder="Cari nama atau divisi"
                        autoComplete="off"
                        role="combobox"
                        aria-expanded={searchOpen}
                        aria-controls="recipient-listbox"
                        className={cn(
                          "w-full rounded-[12px] border px-3 py-2.5 text-sm transition-colors focus:outline-none",
                          fieldErrors.recipient ? "border-red-400 focus:border-red-400" : "border-slate-200 focus:border-brand-400"
                        )}
                      />
                      {searchOpen && filteredPeople.length > 0 && (
                        <ul
                          id="recipient-listbox"
                          role="listbox"
                          className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-56 overflow-y-auto rounded-[14px] border border-slate-200 bg-white py-1.5 shadow-xl"
                        >
                          {filteredPeople.map((p, i) => (
                            <li
                              key={p.id}
                              role="option"
                              aria-selected={i === searchHi}
                              onMouseDown={(e) => { e.preventDefault(); pickRecipient(p); }}
                              className={cn("flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm", i === searchHi ? "bg-slate-50" : "hover:bg-slate-50")}
                            >
                              <Avatar name={p.name} photo={p.photoDataUrl} size="sm" />
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-800 truncate">{titleCase(p.name)}</div>
                                {(p.departmentName ?? p.jobTitle) && (
                                  <div className="text-xs text-slate-400">{p.departmentName ?? p.jobTitle}</div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {fieldErrors.recipient && <p className="mt-1 text-xs font-semibold text-red-500">{fieldErrors.recipient}</p>}
                </div>

                {/* Category chips */}
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-800">
                    Apa yang membuatnya berkesan?{" "}
                    <span className="font-normal text-slate-400">(opsional)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory((prev) => (prev === c ? "" : c))}
                        aria-pressed={category === c}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-bold transition-all",
                          category === c ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-400"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-800">Pesan apresiasi</label>
                  <textarea
                    value={message}
                    onChange={(e) => { setMessage(e.target.value.slice(0, MSG_MAX)); setFieldErrors((p) => ({ ...p, message: undefined })); }}
                    placeholder="Tulis pesan singkat dan tulus"
                    rows={2}
                    maxLength={MSG_MAX}
                    className={cn(
                      "w-full resize-none rounded-[12px] border px-3 py-2.5 text-sm transition-colors focus:outline-none",
                      fieldErrors.message ? "border-red-400 focus:border-red-400" : "border-slate-200 focus:border-brand-400"
                    )}
                  />
                  <div className="mt-1 flex items-start gap-2">
                    <div className="flex flex-wrap gap-1 flex-1">
                      {TEMPLATES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => { setMessage(t); setFieldErrors((p) => ({ ...p, message: undefined })); }}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold transition-colors",
                            message === t ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500 hover:border-brand-300"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <span className={cn("shrink-0 text-xs tabular-nums", message.length >= MSG_MAX ? "text-red-500" : "text-slate-400")}>
                      {message.length}/{MSG_MAX}
                    </span>
                  </div>
                  {fieldErrors.message && <p className="mt-1 text-xs font-semibold text-red-500">{fieldErrors.message}</p>}
                </div>

                {/* Footer actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">+25 poin untuk Anda dan penerima</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetComposer}
                      className="rounded-[10px] border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={send}
                      disabled={sending}
                      className="flex h-9 items-center gap-1.5 rounded-[10px] bg-[#D6194B] px-4 text-sm font-bold text-white hover:bg-[#B01239] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim kudos"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tab filter */}
          <div className="mb-4 flex w-max max-w-full gap-1 overflow-x-auto rounded-[13px] bg-slate-100 p-1" role="tablist">
            {(["all", "me", "mine"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 py-1.5 text-sm font-bold transition-all",
                  tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t === "all" ? "Semua" : t === "me" ? "Untuk saya" : "Dari saya"}
                <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                  {counts[t]}
                </span>
              </button>
            ))}
          </div>

          {/* Feed */}
          {items === null ? (
            <div className="flex justify-center py-16 text-slate-300">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-[18px] border border-slate-100 bg-white px-6 py-16 text-center">
              <div className="mb-2 text-3xl">🤍</div>
              <div className="font-semibold text-slate-800">
                {tab === "me" ? "Belum ada kudos untuk Anda" : "Belum ada kudos"}
              </div>
              <div className="mt-1 text-sm text-slate-400">
                {tab === "me"
                  ? "Kudos yang diberikan rekan untuk Anda akan muncul di sini."
                  : "Jadilah yang pertama memberi apresiasi."}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((k) => {
                const commentsOpen = openComments.has(k.id);
                return (
                  <article key={k.id} className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
                    {/* Sender → Recipient row */}
                    <div className="flex items-center gap-2.5 px-4 pt-4">
                      <Avatar name={k.sender.name} photo={k.sender.photoDataUrl} />
                      <span className="font-extrabold text-brand-600 text-lg leading-none" aria-label="untuk">→</span>
                      <Avatar name={k.recipient.name} photo={k.recipient.photoDataUrl} />
                      <div className="ml-0.5 min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-slate-900">
                          {titleCase(k.sender.name)}{" "}
                          <span className="font-extrabold text-brand-600">→</span>{" "}
                          {titleCase(k.recipient.name)}
                        </div>
                        <div className="text-xs text-slate-400">
                          {k.sender.departmentName}
                          {k.recipient.departmentName ? ` → ${k.recipient.departmentName}` : ""}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap">{kudosTimeAgo(k.createdAt)}</span>
                    </div>

                    {/* Message */}
                    <div className="relative mx-4 my-3 rounded-[14px] bg-gradient-to-br from-[#FDE8EE] to-white px-4 pb-3 pt-3">
                      <span className="pointer-events-none absolute left-2 top-[-6px] select-none text-4xl leading-none text-brand-200">&ldquo;</span>
                      <p className="pl-3 text-[16px] font-semibold leading-relaxed text-slate-800">
                        {k.category && (
                          <span className="mr-1.5 inline-block rounded-full border border-brand-100 bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                            {k.category}
                          </span>
                        )}
                        {k.message}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 border-t border-slate-100 px-3 py-2">
                      <button
                        onClick={() => like(k.id)}
                        aria-pressed={k.likedByMe}
                        className={cn(
                          "flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-sm font-bold transition-colors",
                          k.likedByMe ? "bg-rose-50 text-rose-600" : "text-slate-500 hover:bg-slate-50 hover:text-rose-500"
                        )}
                      >
                        <Heart className={cn("h-4 w-4", k.likedByMe ? "fill-rose-500" : "")} />
                        {k.likeCount} Suka
                      </button>
                      <button
                        onClick={() => {
                          const wasOpen = openComments.has(k.id);
                          setOpenComments((prev) => {
                            const next = new Set(prev);
                            if (wasOpen) next.delete(k.id); else next.add(k.id);
                            return next;
                          });
                          if (!wasOpen) setTimeout(() => document.getElementById(`ci-${k.id}`)?.focus(), 60);
                        }}
                        aria-expanded={commentsOpen}
                        className="flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50"
                      >
                        <MessageCircle className="h-4 w-4" />
                        {k.commentCount} Komentar
                      </button>
                    </div>

                    {/* Comments section */}
                    {commentsOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/40 px-4 pb-3 pt-3">
                        {k.comments.map((c) => (
                          <div key={c.id} className="mb-2 flex items-start gap-2">
                            <Avatar name={c.name} photo={c.photoDataUrl} size="sm" />
                            <div className="flex-1 rounded-[10px] bg-white px-3 py-2 text-sm shadow-sm">
                              <span className="font-bold text-slate-800">{titleCase(c.name)}</span>
                              <span className="ml-2 text-xs text-slate-400">{kudosTimeAgo(c.createdAt)}</span>
                              <p className="mt-0.5 text-slate-700">{c.message}</p>
                            </div>
                          </div>
                        ))}
                        <div className="mt-1 flex gap-2">
                          <input
                            id={`ci-${k.id}`}
                            value={commentTexts[k.id] ?? ""}
                            onChange={(e) => setCommentTexts((p) => ({ ...p, [k.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") addComment(k.id); }}
                            placeholder="Tulis komentar…"
                            maxLength={120}
                            className="flex-1 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                            aria-label="Komentar"
                          />
                          <button
                            onClick={() => addComment(k.id)}
                            disabled={commentSending[k.id]}
                            className="rounded-[10px] bg-[#D6194B] px-3 py-2 text-sm font-bold text-white hover:bg-[#B01239] disabled:opacity-50"
                          >
                            {commentSending[k.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim"}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="order-first flex flex-col gap-4 lg:order-last">
          {/* Kudos saya */}
          <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-extrabold text-slate-900">Kudos saya</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-[12px] bg-slate-50 p-3 text-center">
                <div className="text-2xl font-extrabold tracking-tight text-slate-900">{stats?.receivedCount ?? "—"}</div>
                <div className="text-xs text-slate-400">Diterima</div>
              </div>
              <div className="rounded-[12px] bg-slate-50 p-3 text-center">
                <div className="text-2xl font-extrabold tracking-tight text-slate-900">{stats?.sentCount ?? "—"}</div>
                <div className="text-xs text-slate-400">Dikirim</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1.5 text-xs font-bold text-slate-600">Jatah kudos hari ini</div>
              <div className="flex gap-1.5">
                {Array.from({ length: meta.quota }).map((_, i) => (
                  <div key={i} className={cn("h-2 flex-1 rounded-full transition-colors", i < meta.remaining ? "bg-brand-500" : "bg-slate-200")} />
                ))}
              </div>
              <div className="mt-1 text-xs text-slate-400">Reset setiap hari.</div>
            </div>
          </div>

          {/* Top penerima */}
          <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-extrabold text-slate-900">Sering diapresiasi bulan ini</h2>
            {!stats || stats.topRecipients.length === 0 ? (
              <div className="text-sm text-slate-400">Belum ada kudos bulan ini.</div>
            ) : (
              stats.topRecipients.map((r, i) => (
                <div key={r.id} className={cn("flex items-center gap-2.5 py-2", i > 0 ? "border-t border-slate-100" : "")}>
                  <Avatar name={r.name} photo={r.photoDataUrl} size="sm" />
                  <span className="flex-1 min-w-0 truncate text-sm font-semibold text-slate-800">{titleCase(r.name)}</span>
                  <span className="shrink-0 text-xs font-bold text-slate-400">{r.count}×</span>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
