"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart, MessageCircle, Send, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Textarea, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { initials, timeAgo } from "@/lib/utils";
import { refreshGami } from "@/components/gamification/GamificationBar";

const MSG_MAX = 50;

type Person = { id: string; name: string; photoDataUrl: string | null; departmentName: string | null };
type Comment = {
  id: string;
  message: string;
  createdAt: string;
  name: string;
  photoDataUrl: string | null;
};
type Kudos = {
  id: string;
  message: string;
  createdAt: string;
  sender: Person;
  recipient: Person;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  comments: Comment[];
};

function Avatar({ name, photo, small }: { name: string; photo: string | null; small?: boolean }) {
  const cls = small ? "h-7 w-7" : "h-9 w-9";
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt={name} className={`${cls} rounded-full object-cover`} />
  ) : (
    <div
      className={`${cls} flex items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700`}
    >
      {initials(name)}
    </div>
  );
}

export function KudosWall({ meName }: { meName: string }) {
  const [list, setList] = useState<Kudos[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [composing, setComposing] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kudos");
      setList(res.ok ? await res.json() : []);
    } catch {
      setList([]);
    }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/employees/substitutes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPeople)
      .catch(() => setPeople([]));
  }, [load]);

  async function send() {
    if (!recipientId) return toast("Pilih penerima", "error");
    if (!message.trim()) return toast("Tulis pesan apresiasi", "error");
    setSending(true);
    try {
      const res = await fetch("/api/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, message: message.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) throw new Error(d.error ?? "Gagal kirim kudos");
      toast("Kudos terkirim! (+25 poin) 🎉", "success");
      setMessage("");
      setRecipientId("");
      setComposing(false);
      refreshGami();
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  }

  async function like(id: string) {
    // optimistic
    setList(
      (prev) =>
        prev?.map((k) =>
          k.id === id
            ? {
                ...k,
                likedByMe: !k.likedByMe,
                likeCount: k.likeCount + (k.likedByMe ? -1 : 1),
              }
            : k
        ) ?? prev
    );
    try {
      await fetch(`/api/kudos/${id}/like`, { method: "POST" });
    } catch {
      load();
    }
  }

  async function comment(id: string) {
    if (!commentText.trim()) return;
    try {
      const res = await fetch(`/api/kudos/${id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: commentText.trim() }),
      });
      if (!res.ok) throw new Error();
      setCommentText("");
      setCommentFor(null);
      load();
    } catch {
      toast("Gagal mengirim komentar", "error");
    }
  }

  return (
    <div className="space-y-4">
      {/* Composer CTA */}
      <Card className="p-4">
        {!composing ? (
          <button
            onClick={() => setComposing(true)}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-left text-sm text-slate-400 hover:border-brand-300 hover:bg-brand-50/30"
          >
            <Sparkles className="h-4 w-4 text-brand-500" />
            Siapa yang membuat harimu luar biasa hari ini, {meName}? Kirimkan apresiasi!
          </button>
        ) : (
          <div className="space-y-3">
            <Select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
            >
              <option value="">- Pilih rekan kerja -</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.departmentName ? ` (${p.departmentName})` : ""}
                </option>
              ))}
            </Select>
            <div>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MSG_MAX))}
                placeholder="Pesan singkat apresiasi (maks 50 karakter)"
                maxLength={MSG_MAX}
              />
              <div className="mt-1 text-right text-xs text-slate-400">
                {message.length}/{MSG_MAX}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setComposing(false)}>
                Batal
              </Button>
              <Button onClick={send} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Kirim Kudos
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Wall */}
      {list === null ? (
        <div className="flex justify-center py-12 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-400">
          Belum ada kudos. Jadilah yang pertama memberi apresiasi! 🤍
        </Card>
      ) : (
        list.map((k) => (
          <Card key={k.id} className="p-4">
            <div className="flex items-center gap-2">
              <Avatar name={k.sender.name} photo={k.sender.photoDataUrl} />
              <div className="text-sm">
                <span className="font-semibold text-slate-800">{k.sender.name}</span>
                <span className="text-slate-400"> → </span>
                <span className="font-semibold text-slate-800">{k.recipient.name}</span>
                <div className="text-xs text-slate-400">{timeAgo(k.createdAt)}</div>
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-brand-50/60 px-3 py-2 text-sm text-slate-700">
              “{k.message}”
            </p>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <button
                onClick={() => like(k.id)}
                className={`inline-flex items-center gap-1 ${
                  k.likedByMe ? "text-rose-600" : "text-slate-500 hover:text-rose-600"
                }`}
              >
                <Heart className={`h-4 w-4 ${k.likedByMe ? "fill-rose-500 text-rose-500" : ""}`} />
                {k.likeCount} Suka
              </button>
              <button
                onClick={() => setCommentFor(commentFor === k.id ? null : k.id)}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-brand-700"
              >
                <MessageCircle className="h-4 w-4" />
                {k.commentCount} Komentar
              </button>
            </div>

            {(k.comments.length > 0 || commentFor === k.id) && (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {k.comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <Avatar name={c.name} photo={c.photoDataUrl} small />
                    <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                      <span className="font-medium text-slate-800">{c.name}</span>{" "}
                      <span className="text-slate-600">{c.message}</span>
                      <div className="text-[11px] text-slate-400">{timeAgo(c.createdAt)}</div>
                    </div>
                  </div>
                ))}
                {commentFor === k.id && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Tulis komentar…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") comment(k.id);
                      }}
                    />
                    <Button size="sm" onClick={() => comment(k.id)}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
