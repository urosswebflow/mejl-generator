"use client";

import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { Share2 } from "lucide-react";
import {
  resolveGoogleMapsUrl,
  resolvePlaceId,
} from "@/lib/google-maps-url";
import {
  getRememberMePreference,
  setRememberMePreference,
  supabase,
} from "@/lib/supabase";
import { isValidLeadLimitInput } from "@/lib/limits";
import { PROPOSAL_UPLOAD_ACCEPT } from "@/lib/proposal-upload-constants";
import {
  parseWebsiteFilter,
  type WebsiteFilter,
} from "@/lib/search-filters";
import type { User } from "@supabase/supabase-js";

type SentEmails = {
  first: string | null;
  second: string | null;
  third: string | null;
};

type Lead = {
  placeId?: string;
  name: string;
  address: string;
  googleMapsUrl: string;
  email: string;
  owner: string;
  reviews?: number;
  rating?: number | null;
  sentEmails?: SentEmails;
};

type SearchHistory = {
  id: string;
  user_id: string;
  title: string;
  profession: string;
  city: string;
  created_at: string;
  leads: Lead[];
  website_filter?: string;
  reviews_min?: number | null;
  reviews_max?: number | null;
  proposal_example_text?: string | null;
  proposal_example_filename?: string | null;
};

type SharedSearchRow = {
  id: string;
  search_id: string;
  sender_id: string;
  receiver_id: string;
  receiver_email: string;
  created_at: string;
  opened_at: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  avatar_url: string | null;
};

type SharedNotification = {
  id: string;
  search_id: string;
  sender_id: string;
  sender_email: string;
  sender_avatar_url: string | null;
  title: string;
  profession: string;
  city: string;
  leads: Lead[];
  created_at: string;
  opened_at: string | null;
  website_filter?: string;
  reviews_min?: number | null;
  reviews_max?: number | null;
  proposal_example_text?: string | null;
  proposal_example_filename?: string | null;
};

function escapeHtml(text: string) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatOnlyDate(date: string) {
  return new Date(date).toLocaleDateString("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function withTimeout<T>(promise: PromiseLike<T>, ms = 10000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), ms)
    ),
  ]);
}

function requestErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "Request timeout") {
    return "Zahtev je istekao. Pokušajte ponovo.";
  }

  if (error instanceof Error) return error.message;

  return "Došlo je do greške.";
}

function formatShortDate(date: string | null) {
  if (!date) return "";

  return new Date(date).toLocaleDateString("sr-RS", {
    day: "2-digit",
    month: "2-digit",
  });
}

function makeTitle(profession: string, city: string) {
  const cleanProfession = profession.trim();
  const cleanCity = city.trim();

  if (!cleanProfession && !cleanCity) return "Nova pretraga";
  if (!cleanCity) return cleanProfession;
  if (!cleanProfession) return cleanCity;

  return `${cleanProfession} - ${cleanCity}`;
}

function normalizeLead(lead: Lead): Lead {
  const placeId = resolvePlaceId(lead.placeId, lead.googleMapsUrl);
  const googleMapsUrl = resolveGoogleMapsUrl(
    lead.googleMapsUrl,
    placeId,
    lead.name,
    lead.address
  );

  return {
    ...lead,
    placeId,
    googleMapsUrl,
    owner: lead.owner || "",
    email: lead.email || "",
    sentEmails: {
      first: lead.sentEmails?.first || null,
      second: lead.sentEmails?.second || null,
      third: lead.sentEmails?.third || null,
    },
  };
}

function leadKey(lead: Lead, index: number) {
  return lead.placeId || lead.googleMapsUrl || `${lead.name}-${index}`;
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error("Niste prijavljeni.");
  }

  return data.session.access_token;
}

async function authFetch(url: string, init?: RequestInit) {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers);

  headers.set("Authorization", `Bearer ${token}`);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...init, headers });
}

async function authUploadFile(url: string, file: File) {
  const token = await getAccessToken();
  const formData = new FormData();

  formData.append("file", file);

  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
}

async function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

async function getCroppedImage(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas context nije dostupan.");
  }

  canvas.width = 500;
  canvas.height = 500;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    500,
    500
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Nije moguće napraviti crop sliku."));
        return;
      }

      resolve(blob);
    }, "image/jpeg");
  });
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [isLogin, setIsLogin] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authButtonLoading, setAuthButtonLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);

  const [profession, setProfession] = useState("");
  const [city, setCity] = useState("");
  const [limit, setLimit] = useState("");
  const [searchError, setSearchError] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilter>("any");
  const [reviewsMin, setReviewsMin] = useState("");
  const [reviewsMax, setReviewsMax] = useState("");
  const [proposalExampleText, setProposalExampleText] = useState("");
  const [proposalExampleFilename, setProposalExampleFilename] = useState("");
  const [proposalUploadLoading, setProposalUploadLoading] = useState(false);
  const [proposalUploadError, setProposalUploadError] = useState("");

  const [activeProfession, setActiveProfession] = useState("");
  const [activeCity, setActiveCity] = useState("");
  const [activeProposalExampleText, setActiveProposalExampleText] =
    useState("");

  const [view, setView] = useState<"results" | "history">("results");
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<SearchHistory | null>(
    null
  );
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<SearchHistory | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  const [sharedNotifications, setSharedNotifications] = useState<
    SharedNotification[]
  >([]);
  const [bellOpen, setBellOpen] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPasswordOne, setNewPasswordOne] = useState("");
  const [newPasswordTwo, setNewPasswordTwo] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedAvatarImage, setSelectedAvatarImage] = useState<string | null>(
    null
  );
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const profileRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLDivElement | null>(null);
  const saveLeadsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const avatarObjectUrlRef = useRef<string | null>(null);

  const avatarUrl = user?.user_metadata?.avatar_url || "";
  const firstLetter = (user?.email?.[0] || "U").toUpperCase();

  const canSearch =
    profession.trim().length > 0 &&
    city.trim().length > 0 &&
    isValidLeadLimitInput(limit);

  function revokeAvatarObjectUrl() {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = null;
    }
  }

  const unreadCount = sharedNotifications.filter(
    (item) => !item.opened_at
  ).length;

  useEffect(() => {
    setRememberMe(getRememberMePreference());
  }, []);

  useEffect(() => {
    async function refreshSession() {
      try {
        const { data } = await withTimeout(supabase.auth.getSession());

        if (data.session?.user) {
          setUser(data.session.user);

          if (bellOpen) {
            void loadSharedNotifications(data.session.user.id);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.warn(
          "Greška pri osvežavanju sesije:",
          requestErrorMessage(error)
        );
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          void loadSharedNotifications(session.user.id);
        } else {
          setSharedNotifications([]);
        }
      }
    );

    void refreshSession();

    function onVisible() {
      if (document.visibilityState === "visible") {
        void refreshSession();
      }
    }

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);

      if (saveLeadsTimeoutRef.current) {
        clearTimeout(saveLeadsTimeoutRef.current);
      }

      revokeAvatarObjectUrl();
    };
  }, [bellOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (
        profileOpen &&
        profileRef.current &&
        !profileRef.current.contains(target)
      ) {
        setProfileOpen(false);
      }

      if (bellOpen && bellRef.current && !bellRef.current.contains(target)) {
        setBellOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileOpen, bellOpen]);

  async function handleAuth() {
    try {
      setAuthButtonLoading(true);
      setAuthMessage("");

      if (isLogin) {
        setRememberMePreference(rememberMe);

        const { error } = await withTimeout(
          supabase.auth.signInWithPassword({
            email: authEmail,
            password: authPassword,
          })
        );

        if (error) {
          setAuthMessage(error.message);
          return;
        }
      } else {
        const { error } = await withTimeout(
          supabase.auth.signUp({
            email: authEmail,
            password: authPassword,
          })
        );

        if (error) {
          setAuthMessage(error.message);
          return;
        }

        setAuthMessage(
          "Proverite email i kliknite na verify link za potvrdu naloga."
        );
      }
    } catch (error) {
      setAuthMessage(requestErrorMessage(error));
    } finally {
      setAuthButtonLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!authEmail.trim()) {
      setAuthMessage("Unesite email adresu.");
      return;
    }

    try {
      setAuthButtonLoading(true);
      setAuthMessage("");

      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(authEmail.trim(), {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        })
      );

      if (error) {
        setAuthMessage(error.message);
        return;
      }

      setAuthMessage(
        "Link za promenu lozinke je poslat na vaš email. Proverite inbox i spam folder."
      );
    } catch (error) {
      setAuthMessage(requestErrorMessage(error));
    } finally {
      setAuthButtonLoading(false);
    }
  }

  async function logout() {
    if (saveLeadsTimeoutRef.current) {
      clearTimeout(saveLeadsTimeoutRef.current);
    }

    try {
      await withTimeout(supabase.auth.signOut());
    } catch (error) {
      console.error("Greška pri odjavi:", requestErrorMessage(error));
    } finally {
      setUser(null);
      setLeads([]);
      setHistory([]);
      setSharedNotifications([]);
      setView("results");
      setActiveHistoryId(null);
      setProfession("");
      setCity("");
      setLimit("");
      setSearchError("");
    }
  }

  async function saveCurrentLeads(updatedLeads: Lead[]) {
    if (!activeHistoryId) return;

    try {
      const { error } = await withTimeout(
        supabase
          .from("search_history")
          .update({ leads: updatedLeads })
          .eq("id", activeHistoryId)
      );

      if (error) {
        console.error("Greška pri čuvanju izmena:", error.message);
      }
    } catch (error) {
      console.error("Greška pri čuvanju izmena:", requestErrorMessage(error));
    }
  }

  async function saveSearchHistory(
    foundLeads: Lead[],
    context: {
      profession: string;
      city: string;
      websiteFilter: WebsiteFilter;
      reviewsMin: string;
      reviewsMax: string;
      proposalExampleText: string;
      proposalExampleFilename: string;
    }
  ) {
    if (!user) return null;

    const title = makeTitle(context.profession, context.city);
    const normalizedLeads = foundLeads.map(normalizeLead);
    const parsedReviewsMin = context.reviewsMin.trim()
      ? Number.parseInt(context.reviewsMin.trim(), 10)
      : null;
    const parsedReviewsMax = context.reviewsMax.trim()
      ? Number.parseInt(context.reviewsMax.trim(), 10)
      : null;

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("search_history")
          .insert({
            user_id: user.id,
            title,
            profession: context.profession,
            city: context.city,
            leads: normalizedLeads,
            website_filter: context.websiteFilter,
            reviews_min: Number.isFinite(parsedReviewsMin)
              ? parsedReviewsMin
              : null,
            reviews_max: Number.isFinite(parsedReviewsMax)
              ? parsedReviewsMax
              : null,
            proposal_example_text: context.proposalExampleText || null,
            proposal_example_filename: context.proposalExampleFilename || null,
          })
          .select("id")
          .single()
      );

      if (error) {
        console.error("Greška pri čuvanju istorije:", error.message);
        return null;
      }

      return data.id as string;
    } catch (error) {
      console.error("Greška pri čuvanju istorije:", requestErrorMessage(error));
      return null;
    }
  }

  function applySearchContextFromHistory(item: SearchHistory) {
    setActiveProfession(item.profession);
    setActiveCity(item.city);
    setActiveProposalExampleText(item.proposal_example_text || "");
    setWebsiteFilter(parseWebsiteFilter(item.website_filter));
    setReviewsMin(
      item.reviews_min !== null && item.reviews_min !== undefined
        ? String(item.reviews_min)
        : ""
    );
    setReviewsMax(
      item.reviews_max !== null && item.reviews_max !== undefined
        ? String(item.reviews_max)
        : ""
    );
    setProposalExampleText(item.proposal_example_text || "");
    setProposalExampleFilename(item.proposal_example_filename || "");
    setProposalUploadError("");
  }

  async function handleProposalFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setProposalUploadLoading(true);
    setProposalUploadError("");

    try {
      const response = await authUploadFile("/api/parse-proposal-file", file);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Greška pri učitavanju fajla.");
      }

      setProposalExampleText(data.text || "");
      setProposalExampleFilename(data.filename || file.name);
    } catch (error) {
      setProposalExampleText("");
      setProposalExampleFilename("");
      setProposalUploadError(requestErrorMessage(error));
    } finally {
      setProposalUploadLoading(false);
      event.target.value = "";
    }
  }

  function clearProposalUpload() {
    setProposalExampleText("");
    setProposalExampleFilename("");
    setProposalUploadError("");
  }

  async function generateLeads() {
    if (!canSearch) return;

    setLoading(true);
    setView("results");
    setSearchError("");

    const searchProfession = profession.trim();
    const searchCity = city.trim();
    const searchContext = {
      profession: searchProfession,
      city: searchCity,
      websiteFilter,
      reviewsMin,
      reviewsMax,
      proposalExampleText,
      proposalExampleFilename,
    };

    try {
      const params = new URLSearchParams({
        profession: searchProfession,
        city: searchCity,
        limit: limit.trim(),
        websiteFilter,
      });

      if (reviewsMin.trim()) {
        params.set("reviewsMin", reviewsMin.trim());
      }

      if (reviewsMax.trim()) {
        params.set("reviewsMax", reviewsMax.trim());
      }

      const response = await authFetch(`/api/places?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setSearchError(data.error || "Greška pri pretrazi.");
        setLeads([]);
        setActiveHistoryId(null);
        return;
      }

      const foundLeads = (data.leads || []).map(normalizeLead);

      setLeads(foundLeads);
      setActiveProfession(searchProfession);
      setActiveCity(searchCity);
      setActiveProposalExampleText(proposalExampleText);

      const newHistoryId = await saveSearchHistory(foundLeads, searchContext);
      setActiveHistoryId(newHistoryId);
      setProfession("");
      setCity("");
      setLimit("");
    } catch (error) {
      const message = requestErrorMessage(error);
      setSearchError(message);
      setLeads([]);
      setActiveHistoryId(null);
      console.error("Greška pri pretrazi:", message);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    if (view === "history") {
      setView("results");
      return;
    }

    setHistoryLoading(true);
    setView("history");

    try {
      const { data: userData, error: userError } = await withTimeout(
        supabase.auth.getUser()
      );

      if (userError || !userData.user) {
        setHistory([]);
        return;
      }

      const { data, error } = await withTimeout(
        supabase
          .from("search_history")
          .select("*")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false })
      );

      if (error) {
        console.error("Greška pri učitavanju istorije:", error.message);
        setHistory([]);
      } else {
        setHistory((data || []) as SearchHistory[]);
      }
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function toggleHistory() {
    loadHistory();
  }

  async function loadSharedNotifications(userId: string) {
    try {
      const { data: sharedRows, error: sharedError } = await withTimeout(
        supabase
          .from("shared_searches")
          .select("*")
          .eq("receiver_id", userId)
          .order("created_at", { ascending: false })
      );

      if (sharedError || !sharedRows?.length) {
        setSharedNotifications([]);
        return;
      }

      const rows = sharedRows as SharedSearchRow[];

      const searchIds = rows.map((row) => row.search_id);
      const senderIds = rows.map((row) => row.sender_id);

      const { data: searches } = await withTimeout(
        supabase.from("search_history").select("*").in("id", searchIds)
      );

      const { data: profiles } = await withTimeout(
        supabase
          .from("profiles")
          .select("id,email,avatar_url")
          .in("id", senderIds)
      );

      const searchMap = new Map(
        ((searches || []) as SearchHistory[]).map((item) => [item.id, item])
      );

      const profileMap = new Map(
        ((profiles || []) as ProfileRow[]).map((item) => [item.id, item])
      );

      const notifications = rows
        .map((row) => {
          const search = searchMap.get(row.search_id);

          if (!search) return null;

          return {
            id: row.id,
            search_id: row.search_id,
            sender_id: row.sender_id,
            sender_email:
              profileMap.get(row.sender_id)?.email || "Nepoznat korisnik",
            sender_avatar_url:
              profileMap.get(row.sender_id)?.avatar_url || null,
            title: search.title,
            profession: search.profession,
            city: search.city,
            leads: (search.leads || []).map(normalizeLead),
            created_at: row.created_at,
            opened_at: row.opened_at,
            website_filter: search.website_filter,
            reviews_min: search.reviews_min,
            reviews_max: search.reviews_max,
            proposal_example_text: search.proposal_example_text,
            proposal_example_filename: search.proposal_example_filename,
          };
        })
        .filter(Boolean) as SharedNotification[];

      setSharedNotifications(notifications);
    } catch (error) {
      console.warn(
        "Greška pri učitavanju obaveštenja:",
        requestErrorMessage(error)
      );
      setSharedNotifications([]);
    }
  }

  function openHistoryItem(item: SearchHistory) {
    const normalizedLeads = (item.leads || []).map(normalizeLead);

    setLeads(normalizedLeads);
    setActiveHistoryId(item.id);
    applySearchContextFromHistory(item);
    setFiltersOpen(true);
    setView("results");
  }

  async function openSharedItem(item: SharedNotification) {
    setLeads((item.leads || []).map(normalizeLead));
    setActiveHistoryId(item.search_id);
    setActiveProfession(item.profession);
    setActiveCity(item.city);
    setActiveProposalExampleText(item.proposal_example_text || "");
    setWebsiteFilter(parseWebsiteFilter(item.website_filter));
    setReviewsMin(
      item.reviews_min !== null && item.reviews_min !== undefined
        ? String(item.reviews_min)
        : ""
    );
    setReviewsMax(
      item.reviews_max !== null && item.reviews_max !== undefined
        ? String(item.reviews_max)
        : ""
    );
    setProposalExampleText(item.proposal_example_text || "");
    setProposalExampleFilename(item.proposal_example_filename || "");
    setProposalUploadError("");
    setFiltersOpen(true);
    setView("results");
    setBellOpen(false);

    if (!item.opened_at) {
      const now = new Date().toISOString();

      try {
        await withTimeout(
          supabase
            .from("shared_searches")
            .update({ opened_at: now })
            .eq("id", item.id)
        );

        setSharedNotifications((prev) =>
          prev.map((notification) =>
            notification.id === item.id
              ? { ...notification, opened_at: now }
              : notification
          )
        );
      } catch {
        // Marking notification as opened failed silently.
      }
    }
  }

  function askDeleteHistory(item: SearchHistory) {
    setSelectedHistory(item);
    setDeleteModalOpen(true);
  }

  async function confirmDeleteHistory() {
    if (!selectedHistory) return;

    setDeleteLoading(true);

    try {
      const { error } = await withTimeout(
        supabase
          .from("search_history")
          .delete()
          .eq("id", selectedHistory.id)
      );

      if (!error) {
        setHistory((prev) =>
          prev.filter((item) => item.id !== selectedHistory.id)
        );

        if (activeHistoryId === selectedHistory.id) {
          setActiveHistoryId(null);
          setLeads([]);
        }
      }
    } catch (error) {
      console.error("Greška pri brisanju:", requestErrorMessage(error));
    } finally {
      setDeleteLoading(false);
      setDeleteModalOpen(false);
      setSelectedHistory(null);
    }
  }

  function openShareModal(item: SearchHistory) {
    setShareTarget(item);
    setShareEmail("");
    setShareMessage("");
    setShareModalOpen(true);
  }

  async function confirmShare() {
    if (!user || !shareTarget) return;

    const receiverEmail = shareEmail.trim().toLowerCase();

    if (!receiverEmail) {
      setShareMessage("Unesite email korisnika.");
      return;
    }

    setShareLoading(true);
    setShareMessage("");

    try {
      const response = await authFetch("/api/share-search", {
        method: "POST",
        body: JSON.stringify({
          searchId: shareTarget.id,
          receiverEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setShareMessage(data.error || "Greška pri deljenju.");
        return;
      }

      setShareModalOpen(false);
      setShareTarget(null);
      setShareEmail("");
      setShareMessage("");
    } catch (error) {
      setShareMessage(requestErrorMessage(error));
    } finally {
      setShareLoading(false);
    }
  }

  function queueSaveLeads(updatedLeads: Lead[]) {
    if (saveLeadsTimeoutRef.current) {
      clearTimeout(saveLeadsTimeoutRef.current);
    }

    saveLeadsTimeoutRef.current = setTimeout(() => {
      void saveCurrentLeads(updatedLeads);
    }, 450);
  }

  async function updateLead(
    index: number,
    field: "owner" | "email",
    value: string
  ) {
    const updated = leads.map((lead, i) =>
      i === index ? { ...lead, [field]: value } : lead
    );

    setLeads(updated);
    queueSaveLeads(updated);
  }

  async function toggleSentEmail(
    index: number,
    field: "first" | "second" | "third"
  ) {
    const updated = leads.map((lead, i) => {
      if (i !== index) return lead;

      const currentSent = lead.sentEmails || {
        first: null,
        second: null,
        third: null,
      };

      return {
        ...lead,
        sentEmails: {
          ...currentSent,
          [field]: currentSent[field] ? null : new Date().toISOString(),
        },
      };
    });

    setLeads(updated);
    queueSaveLeads(updated);
  }

  function handleAvatarFile(file: File) {
    setProfileMessage("");
    revokeAvatarObjectUrl();

    const imageUrl = URL.createObjectURL(file);
    avatarObjectUrlRef.current = imageUrl;
    setSelectedAvatarImage(imageUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropModalOpen(true);
  }

  async function saveCroppedAvatar() {
    if (!user || !selectedAvatarImage || !croppedAreaPixels) return;

    setProfileLoading(true);
    setProfileMessage("");

    try {
      const croppedBlob = await getCroppedImage(
        selectedAvatarImage,
        croppedAreaPixels
      );

      const filePath = `${user.id}/avatar-${Date.now()}.jpg`;

      const { error: uploadError } = await withTimeout(
        supabase.storage.from("avatars").upload(filePath, croppedBlob, {
          contentType: "image/jpeg",
          upsert: true,
        })
      );

      if (uploadError) {
        setProfileMessage(uploadError.message);
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: profileError } = await withTimeout(
        supabase
          .from("profiles")
          .update({ avatar_url: data.publicUrl })
          .eq("id", user.id)
      );

      if (profileError) {
        setProfileMessage(profileError.message);
        return;
      }

      const { data: updatedUser, error: updateError } = await withTimeout(
        supabase.auth.updateUser({
          data: {
            avatar_url: data.publicUrl,
          },
        })
      );

      if (updateError) {
        setProfileMessage(updateError.message);
        return;
      }

      if (updatedUser.user) {
        setUser(updatedUser.user);
      }

      setProfileMessage("Slika je uspešno promenjena.");
      setCropModalOpen(false);
      revokeAvatarObjectUrl();
      setSelectedAvatarImage(null);
    } catch (error) {
      setProfileMessage(requestErrorMessage(error));
    } finally {
      setProfileLoading(false);
    }
  }

  async function changePassword() {
    if (!user?.email) return;

    if (!oldPassword || !newPasswordOne || !newPasswordTwo) {
      setProfileMessage("Popunite sva polja za promenu lozinke.");
      return;
    }

    if (newPasswordOne !== newPasswordTwo) {
      setProfileMessage("Nove lozinke se ne poklapaju.");
      return;
    }

    setProfileLoading(true);
    setProfileMessage("");

    try {
      const { error: loginError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: user.email,
          password: oldPassword,
        })
      );

      if (loginError) {
        setProfileMessage("Stara lozinka nije tačna.");
        return;
      }

      const { error } = await withTimeout(
        supabase.auth.updateUser({
          password: newPasswordOne,
        })
      );

      if (error) {
        setProfileMessage(error.message);
      } else {
        setProfileMessage("Lozinka je uspešno promenjena.");
        setOldPassword("");
        setNewPasswordOne("");
        setNewPasswordTwo("");
      }
    } catch (error) {
      setProfileMessage(requestErrorMessage(error));
    } finally {
      setProfileLoading(false);
    }
  }

  async function openProposalPdf(lead: Lead) {
    const win = window.open("", "_blank");

    if (!win) return;

    const loadingHtml = `
      <html>
        <head>
          <title>Generisanje proposal-a...</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 40px;
              color: #111;
            }
          </style>
        </head>
        <body>
          <h2>Generišem proposal...</h2>
        </body>
      </html>
    `;

    win.document.write(loadingHtml);

    try {
      const response = await authFetch("/api/generate-proposal", {
        method: "POST",
        body: JSON.stringify({
          companyName: lead.name,
          profession: activeProfession,
          city: activeCity,
          address: lead.address,
          owner: lead.owner,
          email: lead.email,
          proposalExampleText: activeProposalExampleText,
        }),
      });

      const data = await response.json();

      const proposal = response.ok
        ? data.proposal
        : data.error || "Greška prilikom generisanja proposal-a.";

      if (!proposal) {
        throw new Error("Proposal nije generisan.");
      }

      win.document.open();
      win.document.write(`
        <html>
          <head>
            <title>Proposal - ${escapeHtml(lead.name)}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                max-width: 900px;
                margin: 40px auto;
                padding: 40px;
                color: #111;
              }
              h1 {
                margin-bottom: 24px;
              }
              pre {
                white-space: pre-wrap;
                font-family: Arial, sans-serif;
                font-size: 15px;
              }
              button {
                padding: 12px 18px;
                margin-bottom: 24px;
                cursor: pointer;
              }
              @media print {
                button {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <button onclick="window.print()">Sačuvaj kao PDF</button>
            <h1>Proposal za ${escapeHtml(lead.name)}</h1>
            <pre>${escapeHtml(proposal)}</pre>
          </body>
        </html>
      `);
      win.document.close();
    } catch (error) {
      const message = escapeHtml(requestErrorMessage(error));

      win.document.open();
      win.document.write(`
        <html>
          <head><title>Greška</title></head>
          <body style="font-family: Arial, sans-serif; padding: 40px;">
            <h2>Greška</h2>
            <p>${message}</p>
          </body>
        </html>
      `);
      win.document.close();
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p>Učitavanje...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#0f1115] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#1a1d24] border border-[#2a2f3a] rounded-2xl p-8">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">
            Mejl Generator
          </h1>

          <p className="text-gray-400 text-center mb-8">
            {showForgotPassword
              ? "Promena zaboravljene lozinke"
              : isLogin
              ? "Prijava na nalog"
              : "Kreiranje naloga"}
          </p>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              className="w-full bg-[#11141a] border border-[#2a2f3a] rounded-xl px-4 py-3 text-white outline-none"
            />

            {!showForgotPassword && (
              <input
                type="password"
                placeholder="Lozinka"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-[#11141a] border border-[#2a2f3a] rounded-xl px-4 py-3 text-white outline-none"
              />
            )}

            {isLogin && !showForgotPassword && (
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-[#2a2f3a] bg-[#11141a] accent-green-600"
                  />
                  Zapamti me
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setAuthMessage("");
                  }}
                  className="text-sm text-gray-400 hover:text-white transition"
                >
                  Zaboravili ste lozinku?
                </button>
              </div>
            )}

            <button
              onClick={showForgotPassword ? handleForgotPassword : handleAuth}
              disabled={authButtonLoading}
              className="w-full bg-green-600 hover:bg-green-700 transition rounded-xl py-3 text-white font-semibold"
            >
              {authButtonLoading
                ? "Molimo sačekajte..."
                : showForgotPassword
                ? "Pošalji link za promenu"
                : isLogin
                ? "Login"
                : "Register"}
            </button>
          </div>

          {authMessage && (
            <div className="mt-4 text-sm text-center text-gray-300">
              {authMessage}
            </div>
          )}

          {showForgotPassword ? (
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setAuthMessage("");
              }}
              className="mt-6 w-full text-sm text-gray-400 hover:text-white transition"
            >
              Nazad na prijavu
            </button>
          ) : (
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setAuthMessage("");
              }}
              className="mt-6 w-full text-sm text-gray-400 hover:text-white transition"
            >
              {isLogin
                ? "Nemate nalog? Registrujte se"
                : "Već imate nalog? Login"}
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold sm:text-5xl">Mejl Generator</h1>

            <p className="mt-2 text-sm text-zinc-400 sm:mt-3 sm:text-base">
              Unesi delatnost, grad i broj rezultata.
            </p>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 sm:gap-4">
            <div ref={bellRef} className="relative">
              <button
                onClick={() => {
                  setBellOpen(!bellOpen);

                  if (user) {
                    void loadSharedNotifications(user.id);
                  }
                }}
                className="relative flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-xl transition hover:bg-zinc-700"
              >
                🔔

                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 top-14 z-40 w-[min(100vw-2rem,420px)] rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
                  <h3 className="mb-3 text-lg font-bold">Podeljeno sa mnom</h3>

                  {sharedNotifications.length === 0 ? (
                    <p className="text-sm text-zinc-400">
                      Nema podeljenih pretraga.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {sharedNotifications.map((item) => {
                        const senderLetter = (
                          item.sender_email?.[0] || "?"
                        ).toUpperCase();

                        return (
                          <button
                            key={item.id}
                            onClick={() => openSharedItem(item)}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:bg-zinc-800"
                          >
                            <div className="flex gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-700 font-bold text-white">
                                {item.sender_avatar_url ? (
                                  <img
                                    src={item.sender_avatar_url}
                                    alt={item.sender_email}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  senderLetter
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-zinc-400">
                                  {item.sender_email}
                                </div>

                                <div className="mt-1 font-semibold text-white">
                                  {item.title}
                                </div>

                                <div className="mt-1 text-xs text-zinc-500">
                                  Poslato: {formatOnlyDate(item.created_at)}
                                </div>
                              </div>

                              {!item.opened_at && (
                                <div className="mt-1 h-2 w-2 rounded-full bg-red-500" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-green-700 text-xl font-bold text-white transition hover:bg-green-600"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  firstLetter
                )}
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-14 z-40 w-[min(100vw-2rem,24rem)] rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl sm:w-96 sm:p-6">
                  <div className="flex flex-col items-center">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-green-700 text-4xl font-bold text-white">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        firstLetter
                      )}
                    </div>

                    <p className="mt-4 text-sm text-zinc-300">{user.email}</p>

                    <label className="mt-4 cursor-pointer rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-700">
                      Promeni sliku
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleAvatarFile(file);
                        }}
                      />
                    </label>
                  </div>

                  <div className="mt-6 border-t border-zinc-800 pt-5">
                    <h3 className="mb-3 font-semibold">Promena lozinke</h3>

                    <div className="space-y-3">
                      <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Stara lozinka"
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none"
                      />

                      <input
                        type="password"
                        value={newPasswordOne}
                        onChange={(e) => setNewPasswordOne(e.target.value)}
                        placeholder="Nova lozinka"
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none"
                      />

                      <input
                        type="password"
                        value={newPasswordTwo}
                        onChange={(e) => setNewPasswordTwo(e.target.value)}
                        placeholder="Ponovi novu lozinku"
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none"
                      />

                      <button
                        onClick={changePassword}
                        disabled={profileLoading}
                        className="w-full rounded-xl bg-green-700 px-4 py-3 font-semibold transition hover:bg-green-600"
                      >
                        {profileLoading ? "Sačekajte..." : "Promeni lozinku"}
                      </button>
                    </div>
                  </div>

                  {profileMessage && (
                    <p className="mt-4 text-center text-sm text-zinc-300">
                      {profileMessage}
                    </p>
                  )}

                  <button
                    onClick={logout}
                    className="mt-5 w-full rounded-xl bg-zinc-800 px-4 py-3 font-semibold transition hover:bg-zinc-700"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <input
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              autoComplete="off"
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              placeholder="Delatnost"
            />

            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="off"
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              placeholder="Grad"
            />

            <div className="flex gap-2">
            <input
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              placeholder="Broj firmi"
              type="number"
              min={1}
            />

            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className={`shrink-0 rounded-xl border px-4 py-3 font-semibold transition ${
                filtersOpen
                  ? "border-white bg-white text-black"
                  : "border-zinc-700 bg-zinc-950 text-white hover:bg-zinc-800"
              }`}
            >
              Filteri
            </button>
            </div>
          </div>

          {filtersOpen && (
            <div className="mt-3 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm text-zinc-400">Web sajt</span>
                <select
                  value={websiteFilter}
                  onChange={(e) =>
                    setWebsiteFilter(parseWebsiteFilter(e.target.value))
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3"
                >
                  <option value="any">Svejedno</option>
                  <option value="required">Mora imati sajt</option>
                  <option value="forbidden">Ne sme imati sajt</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-zinc-400">
                  Min. broj recenzija
                </span>
                <input
                  value={reviewsMin}
                  onChange={(e) => setReviewsMin(e.target.value)}
                  autoComplete="off"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3"
                  placeholder="npr. 20"
                  type="number"
                  min={0}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-zinc-400">
                  Max. broj recenzija
                </span>
                <input
                  value={reviewsMax}
                  onChange={(e) => setReviewsMax(e.target.value)}
                  autoComplete="off"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3"
                  placeholder="npr. 300"
                  type="number"
                  min={0}
                />
              </label>

              <div className="sm:col-span-2 lg:col-span-3">
                <span className="mb-1 block text-sm text-zinc-400">
                  Primer propozala (PDF ili DOCX)
                </span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="file"
                    accept={PROPOSAL_UPLOAD_ACCEPT}
                    onChange={handleProposalFileChange}
                    disabled={proposalUploadLoading}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-1 file:text-sm file:text-white"
                  />
                  {proposalExampleFilename && (
                    <button
                      type="button"
                      onClick={clearProposalUpload}
                      className="shrink-0 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold transition hover:bg-zinc-700"
                    >
                      Ukloni
                    </button>
                  )}
                </div>
                {proposalUploadLoading && (
                  <p className="mt-2 text-sm text-zinc-400">Učitavam fajl...</p>
                )}
                {proposalExampleFilename && !proposalUploadLoading && (
                  <p className="mt-2 text-sm text-emerald-400">
                    Učitan fajl: {proposalExampleFilename}
                  </p>
                )}
                {proposalUploadError && (
                  <p className="mt-2 text-sm text-red-400">{proposalUploadError}</p>
                )}
                <p className="mt-2 text-xs text-zinc-500">
                  Ako ne uploaduješ fajl, propozal se generiše automatski kao do sada.
                </p>
              </div>
            </div>
          )}

          {searchError && (
            <p className="mt-4 text-sm text-red-400">{searchError}</p>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:mt-5 sm:flex-row">
            <button
              onClick={generateLeads}
              disabled={!canSearch || loading}
              className={`rounded-xl px-6 py-3 font-semibold transition sm:flex-1 lg:flex-none ${
                canSearch
                  ? "bg-white text-black hover:opacity-90"
                  : "cursor-not-allowed bg-zinc-700 text-zinc-400"
              }`}
            >
              {loading ? "Učitavanje..." : "Pretraži"}
            </button>

            <button
              onClick={toggleHistory}
              className="rounded-xl bg-zinc-800 px-6 py-3 font-semibold text-white transition hover:bg-zinc-700 sm:flex-1 lg:flex-none"
            >
              Istorija
            </button>
          </div>
        </div>

        {view === "history" ? (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-4 text-2xl font-bold">Istorija pretraga</h2>

            {historyLoading ? (
              <p className="text-zinc-400">Učitavanje istorije...</p>
            ) : history.length === 0 ? (
              <p className="text-zinc-400">Još nema sačuvanih pretraga.</p>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => openHistoryItem(item)}
                    className="flex cursor-pointer flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4 transition hover:bg-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
                  >
                    <div className="min-w-0 font-semibold">{item.title}</div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
                      <div className="text-sm text-zinc-400">
                        {formatOnlyDate(item.created_at)}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openShareModal(item);
                        }}
                        className="flex items-center justify-center rounded-lg bg-zinc-800 px-3 py-2 transition hover:bg-zinc-700"
                        title="Podeli"
                      >
                        <Share2 size={18} color="white" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          askDeleteHistory(item);
                        }}
                        className="rounded-lg bg-red-950 px-3 py-2 text-red-300 transition hover:bg-red-900"
                        title="Obriši"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-4 lg:hidden">
              {leads.length === 0 ? (
                <p className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-400">
                  Nema rezultata. Pokrenite pretragu.
                </p>
              ) : (
                leads.map((lead, index) => (
                  <article
                    key={leadKey(lead, index)}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-zinc-500">
                          #{index + 1}
                        </div>
                        <h3 className="mt-1 font-semibold leading-snug">
                          {lead.name}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-400">
                          {lead.address}
                        </p>
                        {(lead.reviews ?? 0) > 0 && (
                          <p className="mt-1 text-xs text-zinc-500">
                            {lead.reviews} recenzija
                            {lead.rating != null ? ` · ${lead.rating}` : ""}
                          </p>
                        )}
                      </div>

                      <a
                        href={lead.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-blue-400"
                      >
                        Maps
                      </a>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">
                          Vlasnik
                        </label>
                        <input
                          value={lead.owner}
                          onChange={(e) =>
                            updateLead(index, "owner", e.target.value)
                          }
                          placeholder="Ime vlasnika"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-zinc-500">
                          Email
                        </label>
                        <input
                          value={lead.email}
                          onChange={(e) =>
                            updateLead(index, "email", e.target.value)
                          }
                          placeholder="Email"
                          type="email"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => openProposalPdf(lead)}
                        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium transition hover:bg-zinc-700"
                      >
                        Proposal PDF
                      </button>

                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-xs text-zinc-500">Mejlovi:</span>
                        {(["first", "second", "third"] as const).map(
                          (field, mailIndex) => (
                            <label
                              key={field}
                              className="flex flex-col items-center gap-1"
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(lead.sentEmails?.[field])}
                                onChange={() =>
                                  toggleSentEmail(index, field)
                                }
                                className="h-5 w-5 cursor-pointer accent-green-500"
                              />
                              <span className="text-[10px] text-zinc-500">
                                {mailIndex + 1}
                                {formatShortDate(
                                  lead.sentEmails?.[field] || null
                                )
                                  ? ` · ${formatShortDate(lead.sentEmails?.[field] || null)}`
                                  : ""}
                              </span>
                            </label>
                          )
                        )}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-zinc-800 lg:block">
              <table className="w-full min-w-[1100px] text-left">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="px-4 py-4 text-center">RB</th>
                    <th className="px-4 py-4">Firma</th>
                    <th className="px-4 py-4">Vlasnik</th>
                    <th className="px-4 py-4">Email</th>
                    <th className="px-4 py-4 text-center">Google Maps</th>
                    <th className="px-4 py-4 text-center">Proposal</th>
                    <th className="px-4 py-4 text-center" colSpan={3}>
                      poslati mejlovi
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {leads.map((lead, index) => (
                    <tr
                      key={leadKey(lead, index)}
                      className="border-t border-zinc-800 transition hover:bg-zinc-900/50"
                    >
                      <td className="px-4 py-4 text-center font-semibold text-zinc-400">
                        {index + 1}
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium">{lead.name}</div>

                        <div className="mt-1 text-sm text-zinc-400">
                          {lead.address}
                        </div>

                        {(lead.reviews ?? 0) > 0 && (
                          <div className="mt-1 text-xs text-zinc-500">
                            {lead.reviews} recenzija
                            {lead.rating != null ? ` · ${lead.rating}` : ""}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <input
                          value={lead.owner}
                          onChange={(e) =>
                            updateLead(index, "owner", e.target.value)
                          }
                          placeholder="Ime vlasnika"
                          className="w-full min-w-[140px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                        />
                      </td>

                      <td className="px-4 py-4">
                        <input
                          value={lead.email}
                          onChange={(e) =>
                            updateLead(index, "email", e.target.value)
                          }
                          placeholder="Email"
                          className="w-full min-w-[190px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                        />
                      </td>

                      <td className="px-4 py-4 text-center">
                        <a
                          href={lead.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 underline"
                        >
                          Otvori
                        </a>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => openProposalPdf(lead)}
                          className="rounded-lg bg-zinc-800 px-4 py-2 transition hover:bg-zinc-700"
                        >
                          PDF
                        </button>
                      </td>

                      {(["first", "second", "third"] as const).map((field) => (
                        <td
                          key={field}
                          className="border-l border-zinc-800 px-4 py-4 text-center"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(lead.sentEmails?.[field])}
                            onChange={() => toggleSentEmail(index, field)}
                            className="h-5 w-5 cursor-pointer accent-green-500"
                          />

                          <div className="mt-1 min-h-[20px] text-sm text-zinc-300">
                            {formatShortDate(lead.sentEmails?.[field] || null)}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {shareModalOpen && shareTarget && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center sm:p-6">
            <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl sm:p-6">
              <h3 className="text-xl font-bold">Podeli pretragu</h3>

              <p className="mt-3 text-zinc-300">
                Unesite email korisnika kome želite da podelite ovu pretragu.
              </p>

              <p className="mt-2 font-semibold text-white">
                {shareTarget.title}
              </p>

              <input
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="email korisnika"
                className="mt-5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none"
              />

              {shareMessage && (
                <p className="mt-3 text-sm text-zinc-300">{shareMessage}</p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShareModalOpen(false);
                    setShareTarget(null);
                    setShareEmail("");
                    setShareMessage("");
                  }}
                  className="rounded-xl bg-zinc-800 px-5 py-3 font-semibold transition hover:bg-zinc-700"
                >
                  Otkaži
                </button>

                <button
                  onClick={confirmShare}
                  disabled={shareLoading}
                  className="rounded-xl bg-green-700 px-5 py-3 font-semibold transition hover:bg-green-600"
                >
                  {shareLoading ? "Slanje..." : "Pošalji"}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteModalOpen && selectedHistory && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center sm:p-6">
            <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl sm:p-6">
              <h3 className="text-xl font-bold">Brisanje pretrage</h3>

              <p className="mt-3 text-zinc-300">
                Da li ste sigurni da želite trajno obrisati ovu pretragu?
              </p>

              <p className="mt-2 font-semibold text-white">
                {selectedHistory.title}
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setSelectedHistory(null);
                  }}
                  className="rounded-xl bg-zinc-800 px-5 py-3 font-semibold transition hover:bg-zinc-700"
                >
                  Otkaži
                </button>

                <button
                  onClick={confirmDeleteHistory}
                  disabled={deleteLoading}
                  className="rounded-xl bg-red-700 px-5 py-3 font-semibold transition hover:bg-red-800"
                >
                  {deleteLoading ? "Brisanje..." : "Obriši"}
                </button>
              </div>
            </div>
          </div>
        )}

        {cropModalOpen && selectedAvatarImage && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center sm:p-6">
            <div className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl sm:p-6">
              <h3 className="text-xl font-bold">Podesi sliku</h3>

              <p className="mt-2 text-sm text-zinc-400">
                Pomeraj sliku gore, dole, levo ili desno i podesi zoom.
              </p>

              <div className="relative mt-5 h-80 w-full overflow-hidden rounded-2xl bg-zinc-950">
                <Cropper
                  image={selectedAvatarImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, croppedPixels) =>
                    setCroppedAreaPixels(croppedPixels)
                  }
                />
              </div>

              <div className="mt-5">
                <label className="text-sm text-zinc-400">Zoom</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setCropModalOpen(false);
                    revokeAvatarObjectUrl();
                    setSelectedAvatarImage(null);
                  }}
                  className="rounded-xl bg-zinc-800 px-5 py-3 font-semibold transition hover:bg-zinc-700"
                >
                  Otkaži
                </button>

                <button
                  onClick={saveCroppedAvatar}
                  disabled={profileLoading}
                  className="rounded-xl bg-green-700 px-5 py-3 font-semibold transition hover:bg-green-600"
                >
                  {profileLoading ? "Čuvanje..." : "Sačuvaj sliku"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}