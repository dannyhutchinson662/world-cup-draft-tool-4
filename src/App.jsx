import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Download,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Search,
  Trophy,
  Undo2,
  Users,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { STARTER_PLAYERS } from "./data/players.js";
import { getBoardPickNumber, getPickTeamIndex, normalisePosition, positionBadge, ratingLabel } from "./lib/draftLogic.js";

const DEFAULT_MANAGERS = Array.from({ length: 20 }, (_, index) => `Manager ${index + 1}`);

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

const FIREBASE_ENABLED = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
const FIRESTORE_DB = FIREBASE_ENABLED ? getFirestore(initializeApp(FIREBASE_CONFIG)) : null;
const positions = ["All", "Goalkeeper", "Defender", "Midfielder", "Attacker", "Forward"];
const countries = ["All", ...Array.from(new Set(STARTER_PLAYERS.map((player) => player.country))).sort()];

function getInitialRoomId() {
  if (typeof window === "undefined") return "draft-night";
  const params = new URLSearchParams(window.location.search);
  const existingRoom = params.get("room");
  if (existingRoom) return existingRoom;
  const generatedRoom = `draft-${Math.random().toString(36).slice(2, 8)}`;
  params.set("room", generatedRoom);
  window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  return generatedRoom;
}

function getInitialViewerMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("view") === "1";
}

function buildDraftUrl(roomId, viewer = false) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  if (viewer) url.searchParams.set("view", "1");
  else url.searchParams.delete("view");
  return url.toString();
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border ${className}`}>{children}</div>;
}

function Button({ children, className = "", variant = "primary", ...props }) {
  const style =
    variant === "secondary"
      ? "bg-white/10 text-slate-100 hover:bg-white/15 disabled:hover:bg-white/10"
      : "bg-slate-100 text-slate-950 hover:bg-white disabled:hover:bg-slate-100";
  return (
    <button
      className={`${style} inline-flex items-center justify-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function positionColour(position) {
  const colours = {
    Attacker: "bg-green-500/20 text-green-200 border-green-400/40",
    Defender: "bg-red-500/20 text-red-200 border-red-400/40",
    Midfielder: "bg-orange-500/20 text-orange-200 border-orange-400/40",
    Goalkeeper: "bg-purple-500/20 text-purple-200 border-purple-400/40",
  };
  return colours[normalisePosition(position)] || "bg-white/10 text-slate-200 border-white/20";
}

function positionCardColour(position) {
  const colours = {
    Attacker: "border-green-400/30 bg-green-500/10 hover:bg-green-500/15",
    Defender: "border-red-400/30 bg-red-500/10 hover:bg-red-500/15",
    Midfielder: "border-orange-400/30 bg-orange-500/10 hover:bg-orange-500/15",
    Goalkeeper: "border-purple-400/30 bg-purple-500/10 hover:bg-purple-500/15",
  };
  return colours[normalisePosition(position)] || "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]";
}

export default function App() {
  const [managersText, setManagersText] = useState(DEFAULT_MANAGERS.join("\n"));
  const [rounds, setRounds] = useState(5);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("All");
  const [country, setCountry] = useState("All");
  const [drafted, setDrafted] = useState([]);
  const [customName, setCustomName] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [customPosition, setCustomPosition] = useState("Attacker");
  const [players, setPlayers] = useState(STARTER_PLAYERS);
  const [fullscreenSection, setFullscreenSection] = useState(null);
  const [roomId, setRoomId] = useState(getInitialRoomId);
  const [viewerMode] = useState(getInitialViewerMode);
  const [syncStatus, setSyncStatus] = useState(FIREBASE_ENABLED ? "Connecting" : "Local only");
  const applyingRemoteUpdate = useRef(false);
  const hasLoadedRemoteRoom = useRef(false);

  useEffect(() => {
    if (!FIRESTORE_DB || !roomId) {
      setSyncStatus("Local only");
      return undefined;
    }
    const roomRef = doc(FIRESTORE_DB, "worldCupFantasyDraftRooms", roomId);
    setSyncStatus("Connecting");
    return onSnapshot(
      roomRef,
      (snapshot) => {
        hasLoadedRemoteRoom.current = true;
        if (!snapshot.exists()) {
          setSyncStatus("Live room ready");
          return;
        }
        const data = snapshot.data();
        applyingRemoteUpdate.current = true;
        if (typeof data.managersText === "string") setManagersText(data.managersText);
        if (typeof data.rounds === "number") setRounds(data.rounds);
        if (Array.isArray(data.drafted)) setDrafted(data.drafted);
        if (Array.isArray(data.players) && data.players.length) setPlayers(data.players);
        window.setTimeout(() => {
          applyingRemoteUpdate.current = false;
        }, 0);
        setSyncStatus("Live");
      },
      (error) => {
        console.error("Realtime draft sync failed", error);
        setSyncStatus("Sync error");
      }
    );
  }, [roomId]);

  useEffect(() => {
    if (!FIRESTORE_DB || !roomId || viewerMode || !hasLoadedRemoteRoom.current || applyingRemoteUpdate.current) return undefined;
    const timeoutId = window.setTimeout(() => {
      setDoc(
        doc(FIRESTORE_DB, "worldCupFantasyDraftRooms", roomId),
        { roomId, managersText, rounds: Number(rounds || 0), drafted, players, updatedAt: serverTimestamp() },
        { merge: true }
      ).catch((error) => {
        console.error("Could not save draft room", error);
        setSyncStatus("Sync error");
      });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [roomId, managersText, rounds, drafted, players, viewerMode]);

  const managers = useMemo(() => managersText.split("\n").map((name) => name.trim()).filter(Boolean), [managersText]);
  const totalPicks = managers.length * Number(rounds || 0);
  const currentPick = drafted.length + 1;
  const currentTeam = managers.length ? managers[getPickTeamIndex(currentPick, managers.length, true)] : "Add teams";
  const draftedIds = useMemo(() => new Set(drafted.map((pick) => pick.player.id)), [drafted]);

  const filteredPlayers = useMemo(() => {
    return players
      .filter((player) => !draftedIds.has(player.id))
      .filter((player) => position === "All" || player.position === position || normalisePosition(player.position) === position)
      .filter((player) => country === "All" || player.country === country)
      .filter((player) => `${player.name} ${player.country} ${player.position} ${player.rank} ${ratingLabel(player.rating)}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.rank - b.rank);
  }, [players, draftedIds, position, country, query]);

  const board = useMemo(() => {
    return Array.from({ length: Number(rounds || 0) }, (_, roundIndex) => {
      const round = roundIndex + 1;
      return managers.map((manager, managerIndex) => {
        const displayPickNumber = getBoardPickNumber(round, managerIndex, managers.length, true);
        return { round, manager, displayPickNumber, pick: drafted.find((item) => item.pickNumber === displayPickNumber) };
      });
    });
  }, [drafted, managers, rounds]);

  const copyLink = async (viewer) => {
    try {
      await navigator.clipboard.writeText(buildDraftUrl(roomId, viewer));
    } catch (error) {
      console.error("Could not copy link", error);
    }
  };

  const changeRoomId = (value) => {
    const cleaned = value.trim().replace(/[^a-zA-Z0-9-_]/g, "-");
    setRoomId(cleaned);
    if (typeof window !== "undefined" && cleaned) {
      const url = new URL(window.location.href);
      url.searchParams.set("room", cleaned);
      if (viewerMode) url.searchParams.set("view", "1");
      window.history.replaceState({}, "", url.toString());
    }
  };

  const draftPlayer = (player) => {
    if (viewerMode || drafted.length >= totalPicks || draftedIds.has(player.id)) return;
    setDrafted((previous) => [...previous, { pickNumber: previous.length + 1, team: currentTeam, player }]);
  };

  const addCustomPlayer = () => {
    if (viewerMode || !customName.trim()) return;
    setPlayers((previous) => [
      ...previous,
      { id: Date.now(), name: customName.trim(), country: customCountry.trim() || "Unknown", position: customPosition, rank: previous.length + 1, rating: "Below Average" },
    ]);
    setCustomName("");
    setCustomCountry("");
  };

  const copyDraftSummary = async () => {
    const summary = drafted.map((pick) => `${pick.pickNumber}. ${pick.team}: ${pick.player.name} (${pick.player.country}, ${pick.player.position}, Rank ${pick.player.rank}, ${ratingLabel(pick.player.rating)})`).join("\n");
    try {
      await navigator.clipboard.writeText(summary || "No picks yet.");
    } catch (error) {
      console.error("Could not copy draft summary", error);
    }
  };

  const exportCsv = () => {
    const header = "Pick,Team,Player,Country,Position,Rank,Rating";
    const rows = drafted.map((pick) => [pick.pickNumber, pick.team, pick.player.name, pick.player.country, pick.player.position, pick.player.rank, ratingLabel(pick.player.rating)].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "world-cup-fantasy-draft.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const FullscreenButton = ({ section }) => (
    <Button onClick={() => setFullscreenSection(fullscreenSection === section ? null : section)} variant="secondary" className="h-7 rounded-xl px-2 text-[10px]">
      {fullscreenSection === section ? <Minimize2 className="mr-1 h-3 w-3" /> : <Maximize2 className="mr-1 h-3 w-3" />}
      {fullscreenSection === section ? "Exit" : "Fullscreen"}
    </Button>
  );

  const sectionShell = (section, children) => <div className={fullscreenSection === section ? "fixed inset-0 z-50 overflow-auto bg-slate-950 p-3" : ""}>{children}</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-2 text-slate-100 md:p-3">
      <div className="mx-auto max-w-[1800px] space-y-3">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-3 shadow-xl ring-1 ring-white/10">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400"><Trophy className="h-3 w-3" /> World Cup Fantasy Draft</div>
              <h1 className="text-xl font-bold tracking-tight md:text-2xl">Live Snake Draft Board</h1>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white/5 px-3 py-2"><div className="text-[10px] uppercase tracking-widest text-slate-400">On clock</div><div className="font-bold">{drafted.length >= totalPicks && totalPicks > 0 ? "Complete" : currentTeam}</div></div>
              <div className="rounded-xl bg-white/5 px-3 py-2"><div className="text-[10px] uppercase tracking-widest text-slate-400">Pick</div><div className="font-bold">{Math.min(currentPick, totalPicks || 1)} / {totalPicks || 0}</div></div>
              <div className="rounded-xl bg-white/5 px-3 py-2"><div className="text-[10px] uppercase tracking-widest text-slate-400">Status</div><div className="font-bold">{viewerMode ? "Viewer" : syncStatus}</div></div>
            </div>
          </div>
        </div>

        {sectionShell("board", <Card className="border-white/10 bg-slate-900 text-slate-100 shadow-xl"><div className="p-2">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div><h2 className="text-sm font-bold">Draft board</h2><p className="text-xs text-slate-400">{drafted.length} of {totalPicks || 0} picks made. Round 2 reverses the order, then alternates each round.</p></div>
            <div className="flex items-center gap-2"><FullscreenButton section="board" /></div>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1600px] border-separate border-spacing-1"><thead><tr><th className="w-12 text-left text-[9px] uppercase tracking-widest text-slate-500">Rnd</th>{managers.map((manager) => <th key={manager} className="rounded-lg bg-slate-950 p-1.5 text-left text-[10px] font-semibold text-slate-300">{manager}</th>)}</tr></thead><tbody>{board.map((roundRow, roundIndex) => <tr key={roundIndex}><td className="rounded-lg bg-slate-950 p-1.5 text-xs font-semibold">{roundIndex + 1}</td>{roundRow.map((slot) => <td key={slot.displayPickNumber} className={`h-16 w-20 rounded-lg border p-1.5 align-top ${slot.pick ? positionCardColour(slot.pick.player.position) : "border-white/10 bg-white/[0.03]"}`}><div className="mb-1 text-[9px] text-slate-500">#{slot.displayPickNumber}</div>{slot.pick ? <div><div className="truncate text-[11px] font-semibold leading-tight" title={slot.pick.player.name}>{slot.pick.player.name}</div><div className="mt-0.5 flex items-center gap-1"><span className={`rounded-full border px-1 py-0.5 text-[8px] font-bold ${positionColour(slot.pick.player.position)}`}>{positionBadge(slot.pick.player.position)}</span><span className="truncate text-[9px] text-slate-300">{slot.pick.player.country}</span></div></div> : <div className="text-[10px] text-slate-600">Empty</div>}</td>)}</tr>)}</tbody></table></div>
        </div></Card>)}

        <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
          <div className="space-y-3">
            <Card className="border-white/10 bg-slate-900 text-slate-100 shadow-xl"><div className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2"><div className="text-sm font-semibold">Live room</div><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-300">{FIREBASE_ENABLED ? syncStatus : "Setup needed"}</span></div>
              <label className="block text-xs font-medium text-slate-300">Room ID</label><input value={roomId} onChange={(event) => changeRoomId(event.target.value)} disabled={viewerMode} className="w-full rounded-xl border border-white/10 bg-slate-950 p-2 text-xs outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60" />
              <div className="grid grid-cols-2 gap-2"><Button onClick={() => copyLink(true)} className="h-8 rounded-xl text-xs">Copy viewer link</Button><Button onClick={() => copyLink(false)} variant="secondary" className="h-8 rounded-xl text-xs">Copy admin link</Button></div>
              {!FIREBASE_ENABLED && <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-2 text-[11px] leading-4 text-amber-100">Realtime phone viewing needs Firebase environment variables added in Netlify. Until then, this runs locally only.</p>}
            </div></Card>

            <Card className="border-white/10 bg-slate-900 text-slate-100 shadow-xl"><div className="space-y-2 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /> Draft setup</div>
              <label className="block text-xs font-medium text-slate-300">Teams / managers, one per line</label><textarea value={managersText} onChange={(event) => setManagersText(event.target.value)} disabled={viewerMode} className="h-28 w-full rounded-xl border border-white/10 bg-slate-950 p-2 text-xs outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60" />
              <label className="block text-xs font-medium text-slate-300">Rounds</label><input type="number" min="1" max="20" value={rounds} onChange={(event) => setRounds(event.target.value)} disabled={viewerMode} className="w-full rounded-xl border border-white/10 bg-slate-950 p-2 text-xs outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60" />
              <div className="rounded-xl border border-white/10 bg-slate-950 p-2 text-xs text-slate-300">Draft type: <span className="font-semibold text-slate-100">Classic snake</span></div>
              <div className="grid grid-cols-2 gap-2"><Button onClick={() => !viewerMode && setDrafted((p) => p.slice(0, -1))} variant="secondary" className="h-8 rounded-xl text-xs" disabled={!drafted.length || viewerMode}><Undo2 className="mr-1 h-3 w-3" /> Undo</Button><Button onClick={() => !viewerMode && setDrafted([])} variant="secondary" className="h-8 rounded-xl text-xs" disabled={!drafted.length || viewerMode}><RotateCcw className="mr-1 h-3 w-3" /> Reset</Button></div>
              <div className="grid grid-cols-2 gap-2"><Button onClick={copyDraftSummary} className="h-8 rounded-xl text-xs"><ClipboardList className="mr-1 h-3 w-3" /> Copy</Button><Button onClick={exportCsv} className="h-8 rounded-xl text-xs"><Download className="mr-1 h-3 w-3" /> CSV</Button></div>
            </div></Card>

            <Card className="border-white/10 bg-slate-900 text-slate-100 shadow-xl"><div className="space-y-2 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Add player</div>
              <input placeholder="Player name" value={customName} onChange={(event) => setCustomName(event.target.value)} disabled={viewerMode} className="w-full rounded-xl border border-white/10 bg-slate-950 p-2 text-xs outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60" />
              <input placeholder="Country" value={customCountry} onChange={(event) => setCustomCountry(event.target.value)} disabled={viewerMode} className="w-full rounded-xl border border-white/10 bg-slate-950 p-2 text-xs outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60" />
              <select value={customPosition} onChange={(event) => setCustomPosition(event.target.value)} disabled={viewerMode} className="w-full rounded-xl border border-white/10 bg-slate-950 p-2 text-xs outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60">{positions.filter((item) => item !== "All" && item !== "Forward").map((item) => <option key={item}>{item}</option>)}</select>
              <Button onClick={addCustomPlayer} disabled={viewerMode} className="h-8 w-full rounded-xl text-xs">Add to pool</Button>
            </div></Card>
          </div>

          {sectionShell("players", <Card className="border-white/10 bg-slate-900 text-slate-100 shadow-xl"><div className="p-3">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center"><div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" /><input placeholder="Search player, country, position, rank, or rating" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 py-2 pl-8 pr-2 text-xs outline-none focus:ring-2 focus:ring-white/30" /></div><select value={position} onChange={(event) => setPosition(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 p-2 text-xs outline-none">{positions.map((item) => <option key={item}>{item}</option>)}</select><select value={country} onChange={(event) => setCountry(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 p-2 text-xs outline-none">{countries.map((item) => <option key={item}>{item}</option>)}</select><FullscreenButton section="players" /></div>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">{filteredPlayers.map((player) => <motion.button key={player.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => draftPlayer(player)} disabled={viewerMode || drafted.length >= totalPicks || totalPicks === 0} className={`rounded-xl border p-2 text-left shadow-md transition disabled:cursor-not-allowed disabled:opacity-40 ${positionCardColour(player.position)}`}><div className="flex items-start justify-between gap-1"><div className="min-w-0"><div className="truncate text-xs font-semibold" title={player.name}>{player.name}</div><div className="truncate text-[10px] text-slate-300">{player.country}</div></div><span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${positionColour(player.position)}`}>{positionBadge(player.position)}</span></div><div className="mt-1 flex items-center justify-between text-[9px] uppercase tracking-widest text-slate-500"><span>#{player.rank}</span><span>{ratingLabel(player.rating)}</span></div></motion.button>)}</div>
          </div></Card>)}
        </div>
      </div>
    </div>
  );
}
