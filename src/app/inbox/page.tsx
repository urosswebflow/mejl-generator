"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Hand, Inbox, Save, Send, Trash2 } from "lucide-react";
import { authFetch } from "@/lib/client-auth";
import { buildReplyBody } from "@/lib/email-html";
import type { MessageThreadSummary } from "@/lib/message-threads";
import type { MessageFolder, MessageRow } from "@/lib/messages";
import { supabase } from "@/lib/supabase";

type SenderEmail = {
  id: string;
  email: string;
  created_at: string;
};

const FOLDERS: {
  id: MessageFolder;
  label: string;
  icon: typeof Inbox;
}[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
  { id: "saved", label: "Sačuvano", icon: Save },
  { id: "trash", label: "Trash", icon: Trash2 },
];

const THREAD_FOLDERS = new Set<MessageFolder>(["inbox", "sent"]);
const SELECTED_MAILBOX_KEY = "inboxSelectedSenderEmailId";

function formatDate(value: string) {
  return new Date(value).toLocaleString("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCounterparty(message: MessageRow) {
  return message.direction === "inbound"
    ? message.from_address
    : message.to_address;
}

function formatThreadTitle(thread: MessageThreadSummary) {
  const subject = thread.subject || "(bez subject-a)";
  return thread.messageCount > 1
    ? `${subject} (${thread.messageCount})`
    : subject;
}

export default function InboxPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [senderEmails, setSenderEmails] = useState<SenderEmail[]>([]);
  const [selectedSenderEmailId, setSelectedSenderEmailId] = useState("");
  const [activeFolder, setActiveFolder] = useState<MessageFolder>("inbox");
  const [threads, setThreads] = useState<MessageThreadSummary[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null
  );
  const [threadMessages, setThreadMessages] = useState<MessageRow[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [messagesRefreshToken, setMessagesRefreshToken] = useState(0);

  const isThreadFolder = THREAD_FOLDERS.has(activeFolder);

  const selectedMessage = useMemo(() => {
    if (isThreadFolder) {
      return (
        threadMessages.find((item) => item.id === selectedMessageId) ||
        threadMessages[threadMessages.length - 1] ||
        null
      );
    }

    return messages.find((item) => item.id === selectedMessageId) || null;
  }, [isThreadFolder, messages, selectedMessageId, threadMessages]);

  const selectedThread = useMemo(
    () => threads.find((item) => item.id === selectedThreadId) || null,
    [selectedThreadId, threads]
  );

  const loadSenderEmails = useCallback(async () => {
    const response = await authFetch("/api/sender-emails");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Greška pri učitavanju mejlova.");
    }

    const loaded = (data.emails || []) as SenderEmail[];
    setSenderEmails(loaded);

    const savedId = localStorage.getItem(SELECTED_MAILBOX_KEY);
    const savedExists = savedId
      ? loaded.some((item) => item.id === savedId)
      : false;

    if (savedExists && savedId) {
      setSelectedSenderEmailId(savedId);
    } else if (loaded.length > 0) {
      setSelectedSenderEmailId(loaded[0].id);
      localStorage.setItem(SELECTED_MAILBOX_KEY, loaded[0].id);
    } else {
      setSelectedSenderEmailId("");
      localStorage.removeItem(SELECTED_MAILBOX_KEY);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        setIsAuthenticated(false);
        setAuthLoading(false);
        return;
      }

      setIsAuthenticated(true);

      try {
        await loadSenderEmails();
      } catch (error) {
        setFeedback(
          error instanceof Error ? error.message : "Greška pri učitavanju mejlova."
        );
      } finally {
        setAuthLoading(false);
      }
    }

    void init();
  }, [loadSenderEmails]);

  useEffect(() => {
    if (!isAuthenticated || !selectedSenderEmailId) {
      return;
    }

    let cancelled = false;

    async function fetchList() {
      setListLoading(true);
      setFeedback("");

      try {
        const params = new URLSearchParams({
          senderEmailId: selectedSenderEmailId,
          folder: activeFolder,
        });

        const response = await authFetch(`/api/messages?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Greška pri učitavanju poruka.");
        }

        if (cancelled) {
          return;
        }

        if (isThreadFolder) {
          const rows = (data.threads || []) as MessageThreadSummary[];
          setThreads(rows);
          setMessages([]);
          setSelectedThreadId((currentId) =>
            currentId && !rows.some((item) => item.id === currentId)
              ? null
              : currentId
          );
        } else {
          const rows = (data.messages || []) as MessageRow[];
          setMessages(rows);
          setThreads([]);
          setSelectedMessageId((currentId) =>
            currentId && !rows.some((item) => item.id === currentId)
              ? null
              : currentId
          );
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback(
            error instanceof Error
              ? error.message
              : "Greška pri učitavanju poruka."
          );
          setThreads([]);
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          setListLoading(false);
        }
      }
    }

    void fetchList();

    return () => {
      cancelled = true;
    };
  }, [
    activeFolder,
    isAuthenticated,
    isThreadFolder,
    messagesRefreshToken,
    selectedSenderEmailId,
  ]);

  useEffect(() => {
    if (!selectedThreadId || !isThreadFolder) {
      setThreadMessages([]);
      setSelectedMessageId(null);
      return;
    }

    let cancelled = false;

    async function fetchThread() {
      setThreadLoading(true);

      try {
        const response = await authFetch(`/api/messages/thread/${selectedThreadId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Greška pri učitavanju thread-a.");
        }

        if (cancelled) {
          return;
        }

        const rows = (data.messages || []) as MessageRow[];
        setThreadMessages(rows);
        setSelectedMessageId(rows[rows.length - 1]?.id || null);
      } catch (error) {
        if (!cancelled) {
          setFeedback(
            error instanceof Error
              ? error.message
              : "Greška pri učitavanju thread-a."
          );
          setThreadMessages([]);
          setSelectedMessageId(null);
        }
      } finally {
        if (!cancelled) {
          setThreadLoading(false);
        }
      }
    }

    void fetchThread();

    return () => {
      cancelled = true;
    };
  }, [isThreadFolder, messagesRefreshToken, selectedThreadId]);

  function handleMailboxChange(senderId: string) {
    setSelectedSenderEmailId(senderId);
    localStorage.setItem(SELECTED_MAILBOX_KEY, senderId);
    setSelectedThreadId(null);
    setSelectedMessageId(null);
    setThreadMessages([]);
    setReplyText("");
  }

  function openThread(thread: MessageThreadSummary) {
    setSelectedThreadId(thread.id);
    setReplyText("");
    setFeedback("");
  }

  function openMessage(message: MessageRow) {
    setSelectedMessageId(message.id);
    setReplyText("");
    setFeedback("");
  }

  async function updateFolder(messageId: string, folder: MessageFolder) {
    setActionLoading(true);
    setFeedback("");

    try {
      const response = await authFetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({ folder }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Akcija nije uspela.");
      }

      setMessagesRefreshToken((value) => value + 1);

      if (isThreadFolder) {
        if (selectedThreadId && folder !== activeFolder) {
          setSelectedThreadId(null);
          setThreadMessages([]);
        }
      } else if (selectedMessageId === messageId && folder !== activeFolder) {
        setSelectedMessageId(null);
      }

      setReplyText("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Akcija nije uspela.");
    } finally {
      setActionLoading(false);
    }
  }

  async function updateThreadFolder(folder: MessageFolder) {
    if (!threadMessages.length) {
      return;
    }

    setActionLoading(true);
    setFeedback("");

    try {
      for (const message of threadMessages) {
        const response = await authFetch(`/api/messages/${message.id}`, {
          method: "PATCH",
          body: JSON.stringify({ folder }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Akcija nije uspela.");
        }
      }

      setMessagesRefreshToken((value) => value + 1);
      setSelectedThreadId(null);
      setThreadMessages([]);
      setReplyText("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Akcija nije uspela.");
    } finally {
      setActionLoading(false);
    }
  }

  async function sendReply() {
    if (!selectedMessage || !replyText.trim()) {
      return;
    }

    setReplyLoading(true);
    setFeedback("");

    try {
      const response = await authFetch("/api/messages/reply", {
        method: "POST",
        body: JSON.stringify({
          messageId: selectedMessage.id,
          text: replyText.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Reply nije poslat.");
      }

      setReplyText("");
      setFeedback("Odgovor je poslat.");
      setActiveFolder("sent");
      setMessagesRefreshToken((value) => value + 1);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Reply nije poslat.");
    } finally {
      setReplyLoading(false);
    }
  }

  function prepareReplyTemplate() {
    if (!selectedMessage) {
      return;
    }

    setReplyText(buildReplyBody(selectedMessage));
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p>Učitavanje...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Inbox</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Primljene i poslate poruke sa izabranog mejla.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold transition hover:bg-zinc-700"
          >
            Nazad
          </Link>
        </div>

        {!isAuthenticated ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <p className="text-zinc-300">Morate biti prijavljeni.</p>
            <Link
              href="/"
              className="mt-4 inline-flex rounded-xl bg-white px-4 py-3 font-semibold text-black"
            >
              Idi na prijavu
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
              <label className="block">
                <span className="mb-2 block text-sm text-zinc-400">
                  Mejl sanduče
                </span>
                {senderEmails.length === 0 ? (
                  <p className="text-sm text-amber-400">
                    Nema dodatih mejlova.{" "}
                    <Link href="/settings" className="underline">
                      Dodaj u settings
                    </Link>
                  </p>
                ) : (
                  <select
                    value={selectedSenderEmailId}
                    onChange={(e) => handleMailboxChange(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
                  >
                    {senderEmails.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.email}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>

            <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                <nav className="space-y-1">
                  {FOLDERS.map(({ id, label, icon: Icon }) => {
                    const active = activeFolder === id;

                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setActiveFolder(id);
                          setSelectedThreadId(null);
                          setSelectedMessageId(null);
                          setThreadMessages([]);
                          setReplyText("");
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                          active
                            ? "bg-green-700 text-white"
                            : "text-zinc-300 hover:bg-zinc-800"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </button>
                    );
                  })}
                </nav>
              </aside>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
                  <div className="border-b border-zinc-800 px-4 py-3 sm:px-5">
                    <h2 className="font-semibold capitalize">{activeFolder}</h2>
                  </div>

                  {listLoading ? (
                    <p className="px-5 py-8 text-sm text-zinc-400">Učitavanje...</p>
                  ) : isThreadFolder ? (
                    threads.length === 0 ? (
                      <p className="px-5 py-8 text-sm text-zinc-400">
                        Nema poruka u ovom folderu.
                      </p>
                    ) : (
                      <ul className="divide-y divide-zinc-800">
                        {threads.map((thread) => {
                          const active = selectedThreadId === thread.id;

                          return (
                            <li key={thread.id}>
                              <button
                                type="button"
                                onClick={() => openThread(thread)}
                                className={`flex w-full items-start gap-3 px-4 py-4 text-left transition sm:px-5 ${
                                  active
                                    ? "bg-zinc-800/80"
                                    : "hover:bg-zinc-800/50"
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate font-semibold">
                                      {thread.counterparty}
                                    </p>
                                    <div className="ml-auto flex shrink-0 items-center gap-2">
                                      {thread.hasOpened && (
                                        <span
                                          title="Otvoreno"
                                          className="inline-flex text-green-500"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </span>
                                      )}
                                      {thread.hasClicked && (
                                        <span
                                          title="Kliknut link"
                                          className="inline-flex text-amber-400"
                                        >
                                          <Hand className="h-4 w-4" />
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <p className="mt-1 truncate text-sm text-zinc-300">
                                    {formatThreadTitle(thread)}
                                  </p>
                                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                                    {thread.preview}
                                  </p>
                                  <p className="mt-2 text-xs text-zinc-500">
                                    {formatDate(thread.latestMessageAt)}
                                  </p>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )
                  ) : messages.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-zinc-400">
                      Nema poruka u ovom folderu.
                    </p>
                  ) : (
                    <ul className="divide-y divide-zinc-800">
                      {messages.map((message) => {
                        const active = selectedMessageId === message.id;

                        return (
                          <li key={message.id}>
                            <button
                              type="button"
                              onClick={() => openMessage(message)}
                              className={`flex w-full items-start gap-3 px-4 py-4 text-left transition sm:px-5 ${
                                active ? "bg-zinc-800/80" : "hover:bg-zinc-800/50"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate font-semibold">
                                    {getCounterparty(message)}
                                  </p>
                                  <div className="ml-auto flex shrink-0 items-center gap-2">
                                    {message.opened_at && (
                                      <span
                                        title="Otvoreno"
                                        className="inline-flex text-green-500"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </span>
                                    )}
                                    {message.clicked_at && (
                                      <span
                                        title="Kliknut link"
                                        className="inline-flex text-amber-400"
                                      >
                                        <Hand className="h-4 w-4" />
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <p className="mt-1 truncate text-sm text-zinc-300">
                                  {message.subject || "(bez subject-a)"}
                                </p>
                                <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                                  {message.body_text || ""}
                                </p>
                                <p className="mt-2 text-xs text-zinc-500">
                                  {formatDate(message.created_at)}
                                </p>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
                  {isThreadFolder ? (
                    !selectedThread ? (
                      <div className="flex h-full min-h-[320px] items-center justify-center px-6 py-10 text-sm text-zinc-400">
                        Izaberi konverzaciju za pregled.
                      </div>
                    ) : (
                      <div className="flex h-full flex-col">
                        <div className="border-b border-zinc-800 px-4 py-4 sm:px-5">
                          <div className="flex flex-wrap items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-lg font-semibold">
                                {formatThreadTitle(selectedThread)}
                              </h3>
                              <p className="mt-2 text-sm text-zinc-400">
                                Sa: {selectedThread.counterparty}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {activeFolder !== "saved" && (
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => updateThreadFolder("saved")}
                                  className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold transition hover:bg-zinc-700 disabled:opacity-50"
                                >
                                  Sačuvaj
                                </button>
                              )}

                              {activeFolder !== "trash" && (
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => updateThreadFolder("trash")}
                                  className="rounded-lg bg-red-950 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-900 disabled:opacity-50"
                                >
                                  Trash
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                          {threadLoading ? (
                            <p className="text-sm text-zinc-400">Učitavanje...</p>
                          ) : (
                            <div className="space-y-4">
                              {threadMessages.map((message) => (
                                <article
                                  key={message.id}
                                  className={`rounded-xl border px-4 py-4 ${
                                    message.direction === "outbound"
                                      ? "border-green-900/60 bg-green-950/20"
                                      : "border-zinc-800 bg-zinc-950/40"
                                  }`}
                                >
                                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                    <span className="font-semibold text-zinc-300">
                                      {message.direction === "outbound"
                                        ? "Poslato"
                                        : "Primljeno"}
                                    </span>
                                    <span>{formatDate(message.created_at)}</span>
                                  </div>
                                  <p className="text-sm text-zinc-400">
                                    Od: {message.from_address}
                                  </p>
                                  <p className="text-sm text-zinc-400">
                                    Za: {message.to_address}
                                  </p>
                                  <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-zinc-200">
                                    {message.body_text || ""}
                                  </pre>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>

                        {activeFolder !== "trash" && (
                          <div className="border-t border-zinc-800 px-4 py-4 sm:px-5">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h4 className="font-semibold">Reply</h4>
                              <button
                                type="button"
                                onClick={prepareReplyTemplate}
                                className="text-xs font-semibold text-zinc-400 transition hover:text-zinc-200"
                              >
                                Ubaci quoted original
                              </button>
                            </div>

                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              rows={8}
                              placeholder="Napiši odgovor..."
                              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
                            />

                            <button
                              type="button"
                              onClick={sendReply}
                              disabled={replyLoading || !replyText.trim()}
                              className="mt-3 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {replyLoading ? "Slanje..." : "Pošalji reply"}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  ) : !selectedMessage ? (
                    <div className="flex h-full min-h-[320px] items-center justify-center px-6 py-10 text-sm text-zinc-400">
                      Izaberi poruku za pregled.
                    </div>
                  ) : (
                    <div className="flex h-full flex-col">
                      <div className="border-b border-zinc-800 px-4 py-4 sm:px-5">
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-semibold">
                              {selectedMessage.subject || "(bez subject-a)"}
                            </h3>
                            <p className="mt-2 text-sm text-zinc-400">
                              Od: {selectedMessage.from_address}
                            </p>
                            <p className="text-sm text-zinc-400">
                              Za: {selectedMessage.to_address}
                            </p>
                            <p className="mt-2 text-xs text-zinc-500">
                              {formatDate(selectedMessage.created_at)}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {selectedMessage.folder !== "saved" && (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() =>
                                  updateFolder(selectedMessage.id, "saved")
                                }
                                className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold transition hover:bg-zinc-700 disabled:opacity-50"
                              >
                                Sačuvaj
                              </button>
                            )}

                            {selectedMessage.folder !== "trash" && (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() =>
                                  updateFolder(selectedMessage.id, "trash")
                                }
                                className="rounded-lg bg-red-950 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-900 disabled:opacity-50"
                              >
                                Trash
                              </button>
                            )}

                            {(selectedMessage.folder === "saved" ||
                              selectedMessage.folder === "trash") && (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() =>
                                  updateFolder(
                                    selectedMessage.id,
                                    selectedMessage.direction === "outbound"
                                      ? "sent"
                                      : "inbox"
                                  )
                                }
                                className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold transition hover:bg-zinc-700 disabled:opacity-50"
                              >
                                Vrati
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-zinc-200">
                          {selectedMessage.body_text || ""}
                        </pre>
                      </div>

                      {activeFolder !== "trash" && (
                        <div className="border-t border-zinc-800 px-4 py-4 sm:px-5">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <h4 className="font-semibold">Reply</h4>
                            <button
                              type="button"
                              onClick={prepareReplyTemplate}
                              className="text-xs font-semibold text-zinc-400 transition hover:text-zinc-200"
                            >
                              Ubaci quoted original
                            </button>
                          </div>

                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={8}
                            placeholder="Napiši odgovor..."
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
                          />

                          <button
                            type="button"
                            onClick={sendReply}
                            disabled={replyLoading || !replyText.trim()}
                            className="mt-3 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {replyLoading ? "Slanje..." : "Pošalji reply"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {feedback && (
              <p className="mt-4 text-center text-sm text-zinc-300">{feedback}</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
