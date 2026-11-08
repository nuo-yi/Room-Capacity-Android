import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Asterisk,
  AudioLines,
  BookOpen,
  ChevronDown,
  Clock3,
  DoorOpen,
  Heart,
  Info,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import {
  availableSeats,
  formatNoise,
  noiseBand,
  roomState,
  sampleHistory,
  sampleRooms,
  timeAgo,
  locationLabel,
  occupancyReading, noiseReading, hasStaticDemo, hasDisplayedOccupancy, hasRecentReading,
} from "./rooms.js";
import { useRooms, useSavedRooms } from "./useRooms.js";
import { fetchJson } from "./api.js";
import { Capacitor } from "@capacitor/core";
import { readApiOrigin, saveApiOrigin } from "./apiConfig.js";
import { startNativeRuntime } from "./nativeRuntime.js";
import directoryRooms from "../data/rooms.json";
import roomPhotos from "../data/room-images.json";
import { mergeDirectory, directionsUrl, compareRooms } from "./directory.js";

import { matchesRoomSearch } from "./roomSearch.js";

import ReportForm from "./ReportForm.jsx";

function EstimateSource({ room, now }) {
  const values = [
    ["Occupancy", room.estimate?.occupancy],
    ["Noise", room.estimate?.noise],
  ].filter(([, value]) => value && now < Date.parse(value.expires_at));
  const recent = room.estimate?.reports?.recent ?? 0;
  if (!values.length && !recent) return null;
  return (
    <p className="estimate-source">
      {values.length
        ? values.map(([label, value]) => `${label}: ${value.source} · ${value.report_count} contributing ${value.report_count === 1 ? "report" : "reports"}`).join(" / ")
        : `${recent} recent community ${recent === 1 ? "report" : "reports"} · no current contribution after filtering`}
    </p>
  );
}

const filters = [
  { id: "all", label: "All spaces" },
  { id: "available", label: "Seats available" },
  { id: "quiet", label: "Quiet" },
  { id: "saved", label: "Saved" },
];

function Brand({ small = false }) {
  return (
    <span className={`brand ${small ? "brand-small" : ""}`}>
      <span className="brand-mark">
        <DoorOpen size={small ? 19 : 23} strokeWidth={1.7} />
      </span>
      <span>
        SensoryAtlas<span className="brand-period">.</span>
      </span>
    </span>
  );
}

function DeskIllustration() {
  return (
    <svg
      className="desk-illustration"
      viewBox="0 0 380 280"
      fill="none"
      aria-hidden="true"
    >
      <rect x="75" y="23" width="235" height="213" rx="112" fill="#e7e8d4" />
      <path
        d="M159 110V40M225 111V44M91 113h204"
        stroke="#faf9f3"
        strokeWidth="6"
      />
      <circle cx="246" cy="63" r="20" fill="#e4b96c" />
      <path
        d="M57 233h274"
        stroke="#d5d8c7"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M92 163h220M109 165v68M292 165v68"
        stroke="#254e43"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <rect
        x="154"
        y="125"
        width="62"
        height="38"
        rx="4"
        fill="#f1d7a6"
        stroke="#b99b6c"
        strokeWidth="2"
      />
      <path d="m156 151 21-14 36 14" stroke="#b99b6c" strokeWidth="2" />
      <path
        d="M254 160v-55l-24-17"
        stroke="#254e43"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="m212 82 33 19-4-29-29 10Z" fill="#254e43" />
      <path d="m218 92-16 25 38 3-7-20" fill="#f2d59c" opacity=".55" />
      <path
        d="M128 209v24M176 209v24"
        stroke="#a66a4d"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M124 183c0-13 12-21 27-21 17 0 29 8 29 21v22h-56v-22Z"
        fill="#cf8d6a"
      />
      <path
        d="M121 204h61"
        stroke="#a66a4d"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M325 203c0-25-9-43-9-60M316 173c-21-1-27-17-21-29 16 3 24 16 21 29ZM318 159c18-4 24-20 17-31-14 6-21 19-17 31Z"
        fill="#72947a"
        stroke="#72947a"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M303 201h32l-5 31h-22l-5-31Z" fill="#d7bc91" />
      <rect x="107" y="151" width="25" height="9" rx="2" fill="#a6b5a0" />
      <rect x="110" y="142" width="25" height="9" rx="2" fill="#e1bc7b" />
      <path
        d="M71 52v14m-7-7h14M324 96v10m-5-5h10"
        stroke="#a4af88"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <button
          className="icon-button modal-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </dialog>
  );
}

function ApiConnection({ onClose, onSave }) {
  const [value, setValue] = useState(readApiOrigin);
  const [error, setError] = useState("");
  return (
    <Modal title="API connection" onClose={onClose}>
      <h2>API connection</h2>
      <p className="modal-intro">Connect to your deployed Room Capacity website to check monitored rooms. The directory is available without a connection.</p>
      <form className="connection-form" onSubmit={(event) => {
        event.preventDefault();
        try { saveApiOrigin(value); onSave(); onClose(); }
        catch (problem) { setError(problem.message); }
      }}>
        <label htmlFor="api-origin">Website address</label>
        <input id="api-origin" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck="false" placeholder="https://your-site.vercel.app" value={value} onChange={(event) => setValue(event.target.value)} aria-describedby="api-help" />
        <p id="api-help">Use the HTTPS website address without /api. Leave blank to disconnect monitored readings.</p>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="primary-button">Save connection</button>
      </form>
    </Modal>
  );
}

function HowItWorks({ onClose }) {
  return (
    <Modal title="How SensoryAtlas works" onClose={onClose}>
      <span className="eyebrow">A little less guesswork</span>
      <h2>
        A good spot changes
        <br />
        your whole study session.
      </h2>
      <p className="modal-intro">
        SensoryAtlas brings occupancy, sound readings, and community observations together, so you can choose a
        space before you head over.
      </p>
      <div className="how-steps">
        <div>
          <span>01</span>
          <div>
            <h3>Find your kind of space</h3>
            <p>Search by room or building, or save a favourite for later.</p>
          </div>
        </div>
        <div>
          <span>02</span>
          <div>
            <h3>Check the latest reading</h3>
            <p>
              See the people count, available seats when capacity is known, and
              the sound band at the last measurement. Favourites are saved only
              in this browser.
            </p>
          </div>
        </div>
        <div>
          <span>03</span>
          <div>
            <h3>Settle in and focus</h3>
            <p>
              The dashboard checks for updates roughly every 10 seconds. Each
              measurement has its own timestamp; a successful check does not
              mean a new measurement arrived. Delayed readings are marked.
            </p>
          </div>
        </div>
      </div>
      <div className="quiet-note">
        <Info size={18} />
        <p>
          Noise labels are approximate bands. Relative levels depend on the
          sensor; dBA is shown only when supplied as that unit. Only counts and
          noise readings appear here.
        </p>
      </div>
    </Modal>
  );
}

function NoiseLevel({ reading, live }) {
  const band = live ? noiseBand(reading) : null;
  return (
    <div className="noise-level">
      <span
        className={`noise-wave ${band?.level ?? "unknown"}`}
        aria-hidden="true"
      >
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <div>
        <span className="metric-caption">
          Sound band{reading?.noise_unit === "relative" ? " · approximate" : ""}
        </span>
        <strong>{band?.label ?? "No current reading"}</strong>
      </div>
      <span className="noise-value">{live ? formatNoise(reading) : "—"}</span>
    </div>
  );
}

function RoomCard({ room, now, staleAfterSeconds, saved, onSave, onOpen, demo }) {
  const state = !hasDisplayedOccupancy(room, now, staleAfterSeconds) && hasRecentReading(room, now, staleAfterSeconds)
    ? { key: "live", label: "Community noise estimate" } : roomState(room, now, staleAfterSeconds);
  const live = hasDisplayedOccupancy(room, now, staleAfterSeconds);
  const occupancy = occupancyReading(room, now);
  const sound = noiseReading(room, now, staleAfterSeconds);
  const seats = availableSeats(room, now, staleAfterSeconds);
  const estimate = [room.estimate?.occupancy, room.estimate?.noise].find(value => value && now < Date.parse(value.expires_at));
  return (
    <article className="room-card">
      <div className="room-card-body">
        <div className="card-heading">
          <div>
            {demo && <p className="sample-label">Fictional sample data</p>}
            <h3 aria-label={room.name}><button className="room-title" onClick={() => onOpen(room)} aria-label={`View ${room.name}`}>{room.name}<ArrowUpRight size={17} /></button></h3>
            <p className="room-location"><MapPin size={15} />{locationLabel(room.location) || "Location not listed yet"}</p>
          </div>
          <button className={`save-button ${saved ? "is-saved" : ""}`} onClick={() => onSave(room.room_id)} aria-label={`${saved ? "Unsave" : "Save"} ${room.name}`} aria-pressed={saved}><Heart size={20} fill={saved ? "currentColor" : "none"} /></button>
        </div>
        <div className="card-readings">
          <NoiseLevel reading={sound} live={Boolean(sound)} />
          <div className="seat-estimate"><Users size={20} /><div><span className="metric-caption">{live ? "Estimated availability" : "Live availability"}</span><strong>{!live ? "Seats unknown" : seats == null ? Number.isFinite(occupancy?.people_count) ? `${occupancy.people_count} people` : occupancy?.fraction != null ? `~${Math.round(occupancy.fraction * 100)}% full` : "Occupancy unavailable" : seats === 0 ? "0 estimated seats available" : <>About <span>{seats} seats</span> free</>}</strong></div></div>
        </div>
        <span className={`status-pill status-${state.key}`}><span />{hasRecentReading(room, now, staleAfterSeconds) && !live ? "Community noise estimate" : live ? state.label : room.latest_reading ? state.label : "No live readings"}</span>
        <EstimateSource room={room} now={now} />
        {!demo && hasStaticDemo(room) && <p className="sample-label">Fictional sensor history · static demo data</p>}
        <p className="capacity-note">{room.total_capacity == null ? "Capacity unknown" : `Published capacity: ${room.total_capacity} seats`}</p>
      </div>
      <div className="room-card-footer"><span><Clock3 size={14} />{estimate ? `Reported ${timeAgo(estimate.measured_at, now).toLowerCase()}` : room.latest_reading ? `Measured ${timeAgo(room.latest_reading.measured_at, now).toLowerCase()}` : "No measurement yet"}</span><button onClick={() => onOpen(room)} aria-label={`Details for ${room.name}`}>Details <ArrowRight size={16} /></button></div>
    </article>
  );
}

function ActivityChart({ readings }) {
  readings = readings.filter((reading) => Number.isFinite(reading.people_count) && Number.isFinite(Date.parse(reading.measured_at))).sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));
  if (!readings.length)
    return (
      <div className="activity-empty">
        <AudioLines size={25} strokeWidth={1.4} />
        <strong>No occupancy history yet.</strong>
        <p>Recent occupancy will appear after readings arrive.</p>
      </div>
    );
  const max = Math.max(4, ...readings.map((r) => r.people_count));
  const left = 28,
    right = 572,
    top = 14,
    bottom = 132;
  const times = readings.map((r) => Date.parse(r.measured_at));
  const start = Math.min(...times),
    end = Math.max(...times);
  const points = readings.map((r, i) => [
    end === start
      ? (left + right) / 2
      : left + ((times[i] - start) / (end - start)) * (right - left),
    bottom - (r.people_count / max) * (bottom - top),
  ]);
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const format = (value) =>
    new Date(value).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  return (
    <div className="activity-chart">
      <svg
        viewBox="0 0 600 160"
        role="img"
        aria-label={`People count over time, ${readings.length} readings`}
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={left}
              y1={bottom - f * (bottom - top)}
              x2={right}
              y2={bottom - f * (bottom - top)}
              stroke="#e7ebe5"
              strokeDasharray="3 5"
            />
            <text
              x="9"
              y={bottom - f * (bottom - top) + 4}
              fill="#7b857e"
              fontSize="10"
            >
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        {points.length > 1 && (
          <>
            <path
              d={`${path} L${points.at(-1)[0]},${bottom} L${points[0][0]},${bottom} Z`}
              fill="#dce8df"
              opacity=".6"
            />
            <path
              d={path}
              fill="none"
              stroke="#326451"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </>
        )}
        {points.map(([x, y], i) => (
          <circle
            key={`${readings[i].measured_at}-${i}`}
            cx={x}
            cy={y}
            r={points.length > 30 ? 2 : 3.5}
            fill="#326451"
          >
            <title>
              {readings[i].people_count} people at{" "}
              {format(readings[i].measured_at)}
            </title>
          </circle>
        ))}
        <text x={left} y="155" fill="#7b857e" fontSize="10">
          {format(start)}
        </text>
        <text x={right} y="155" textAnchor="end" fill="#7b857e" fontSize="10">
          {format(end)}
        </text>
      </svg>
    </div>
  );
}

function RoomDetails({
  room,
  demo,
  now,
  staleAfterSeconds,
  saved,
  onSave,
  onClose,
  onReported,
}) {
  const [history, setHistory] = useState({ status: "loading", readings: [] });
  const [attempt, setAttempt] = useState(0);
  const state = !hasDisplayedOccupancy(room, now, staleAfterSeconds) && hasRecentReading(room, now, staleAfterSeconds)
    ? { key: "live", label: "Community noise estimate" } : roomState(room, now, staleAfterSeconds);
  const live = hasDisplayedOccupancy(room, now, staleAfterSeconds);
  const occupancy = occupancyReading(room, now);
  const sound = noiseReading(room, now, staleAfterSeconds);
  useEffect(() => {
    if (demo) {
      setHistory({ status: "ok", readings: sampleHistory(room, now) });
      return;
    }
    if (!room.latest_reading) { setHistory({ status: "ok", readings: [] }); return; }
    const controller = new AbortController();
    setHistory({ status: "loading", readings: [] });
    fetchJson(
      `/api/readings?room_id=${encodeURIComponent(room.room_id)}&limit=100`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (!Array.isArray(data.readings)) throw new Error();
        setHistory({ status: "ok", readings: data.readings });
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setHistory({ status: "error", readings: [] });
      });
    return () => controller.abort();
    // A detail request represents one snapshot; the room's latest reading still updates live.
  }, [room.room_id, Boolean(room.latest_reading), demo, attempt]);
  const location = locationLabel(room.location);
  return (
    <Modal title={room.name} onClose={onClose} wide>
      <span className="eyebrow">
        {demo ? "Fictional sample data" : "Your next place to focus"}
      </span>
      <h2>{room.name}</h2>
      <p className="detail-location">
        <MapPin size={16} />
        {location || "Location not listed yet"}
      </p>
      <div className="detail-status">
        <span className={`status-pill status-${state.key}`}>
          <span />
          {state.label}
        </span>
        <button
          className={`text-save ${saved ? "is-saved" : ""}`}
          onClick={() => onSave(room.room_id)}
          aria-pressed={saved}
        >
          <Heart size={16} fill={saved ? "currentColor" : "none"} />
          {saved ? "Saved space" : "Save this space"}
        </button>
      </div>
      <div className="detail-metrics">
        <div>
          <Users size={19} />
          <span>Estimated people</span>
          <strong>
            {live && Number.isFinite(occupancy?.people_count) ? occupancy.people_count : live && occupancy?.fraction != null ? `~${Math.round(occupancy.fraction * 100)}% full` : "—"}
            <small> / {room.total_capacity ?? "—"}</small>
          </strong>
        </div>
        <div>
          <AudioLines size={20} />
          <span>Sound band · approximate</span>
          <strong>
            {noiseBand(sound)?.label ?? "—"}
            <small>
              {sound ? formatNoise(sound) : "No current reading"}
            </small>
          </strong>
        </div>
        <div>
          <DoorOpen size={20} />
          <span>Estimated available seats</span>
          <strong>
            {availableSeats(room, now, staleAfterSeconds) ?? "—"}
            <small>
              {room.total_capacity == null
                ? "Capacity unknown"
                : `Capacity: ${room.total_capacity} seats`}
            </small>
          </strong>
        </div>
      </div>
      <EstimateSource room={room} now={now} />
      {!demo && <ReportForm key={room.room_id} room={room} onReported={onReported} />}
      {Number.isFinite(room.latest_reading?.average_confidence) && <p className="measurement-time">Detection confidence: {Math.round(room.latest_reading.average_confidence * 100)}% · mean person-box score, not count accuracy</p>}
      {!demo && hasStaticDemo(room) && <p className="sample-label">Fictional sensor history · static demo data</p>}
      <p className="measurement-time">
        {room.latest_reading
          ? `Last measured ${new Date(room.latest_reading.measured_at).toLocaleString()} (${timeAgo(room.latest_reading.measured_at, now).toLowerCase()})`
          : "Awaiting the first measurement"}
      </p>
      {room.location?.address && (
        <p className="address-line">
          <MapPin size={15} />
          {room.location.address}
        </p>
      )}
      <div className="detail-actions">
        {directionsUrl(room) && <a className="primary-button" href={directionsUrl(room)} target="_blank" rel="noreferrer"><MapPin size={18} />Directions <ArrowUpRight size={16} /></a>}
        {room.source_url && <a className="secondary-button" href={room.source_url} target="_blank" rel="noreferrer">View on UBC <ArrowUpRight size={16} /></a>}
      </div>
      {roomPhotos.images[room.catalog_id ?? room.room_id] && <figure className="detail-photo"><img src={roomPhotos.images[room.catalog_id ?? room.room_id].path} alt={`${room.name} study area`} loading="lazy" /><figcaption>Photo: UBC Learning Spaces</figcaption></figure>}
      <div className="activity-heading">
        <h3>Recent occupancy</h3>
        <span>{demo ? "Up to 100 recent readings · fictional" : "Up to 100 recent readings"}</span>
      </div>
      {history.status === "loading" ? (
        <div className="activity-empty">
          <RefreshCw size={22} className="spin" />
          <p>Loading recent occupancy…</p>
        </div>
      ) : history.status === "error" ? (
        <div className="activity-empty">
          <p>Occupancy history couldn’t be loaded.</p>
          <button
            className="text-button"
            onClick={() => setAttempt((x) => x + 1)}
          >
            Try again <RefreshCw size={14} />
          </button>
        </div>
      ) : (
        <><ActivityChart readings={history.readings} />{history.readings.length > 0 && <p className="chart-latest">Latest count: {history.readings.at(-1).people_count} people at {new Date(history.readings.at(-1).measured_at).toLocaleString()}</p>}</>
      )}
      <div className="detail-footnote">
        <Info size={16} />
        <p>
          {room.latest_reading
            ? `Last measured ${new Date(room.latest_reading.measured_at).toLocaleString()}. `
            : "No sensor readings yet. "}
          Noise labels are approximate; readings retain their original units.
        </p>
      </div>
      {room.source_url && (
        <a
          className="source-link"
          href={room.source_url}
          target="_blank"
          rel="noreferrer"
        >
          Room information source <ArrowUpRight size={14} />
        </a>
      )}
    </Modal>
  );
}

function FilterFields({ building, setBuilding, sort, setSort, buildings }) {
  return <>
    <label className="select-field"><MapPin size={17} /><span>Building</span><select aria-label="Building" value={building} onChange={(e) => setBuilding(e.target.value)}><option value="all">All buildings</option>{buildings.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={16} /></label>
    <label className="select-field"><SlidersHorizontal size={17} /><span>Sort spaces</span><select aria-label="Sort spaces" value={sort} onChange={(e) => setSort(e.target.value)}><option value="fresh">Fresh readings first</option><option value="name">Name: A–Z</option><option value="seats">Most seats available</option></select><ChevronDown size={16} /></label>
  </>;
}

function FilterSheet({ building, sort, buildings, onApply, onClose }) {
  const [draftBuilding, setDraftBuilding] = useState(building);
  const [draftSort, setDraftSort] = useState(sort);
  return <Modal title="Filters and sort" onClose={onClose}><span className="eyebrow">Make room for your preferences</span><h2>Filters and sort</h2><div className="sheet-fields"><FilterFields building={draftBuilding} setBuilding={setDraftBuilding} sort={draftSort} setSort={setDraftSort} buildings={buildings} /></div><div className="sheet-actions"><button className="secondary-button" onClick={() => { setDraftBuilding("all"); setDraftSort("fresh"); }}>Reset</button><button className="primary-button" onClick={() => onApply(draftBuilding, draftSort)}>Apply filters <ArrowRight size={17} /></button></div></Modal>;
}

export default function App() {
  const live = useRooms();
  const [now, setNow] = useState(Date.now());
  const native = Capacitor.isNativePlatform();
  const [mobile, setMobile] = useState(() => native || matchMedia("(max-width: 700px)").matches);
  const [demo, setDemo] = useState(false);
  const liveSaved = useSavedRooms();
  const demoSaved = useSavedRooms("room.saved.demo");
  const { saved, toggle } = demo ? demoSaved : liveSaved;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [building, setBuilding] = useState("all");
  const [sort, setSort] = useState("fresh");
  const [selected, setSelected] = useState(() => new URLSearchParams(location.search).get("room"));
  const [how, setHow] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const spacesRef = useRef(null);
  const order = useRef(new Map());
  const listPosition = useRef(0);
  useEffect(() => startNativeRuntime(() => {}), []);
  useEffect(() => {
    const media = matchMedia("(max-width: 700px)");
    const change = () => { setMobile(native || media.matches); if (native || media.matches) setDemo(false); };
    media.addEventListener("change", change);
    // Old preview links resolve to the live directory on phones.
    if (mobile && (location.hash.includes("demo") || new URLSearchParams(location.search).has("demo"))) {
      const url = new URL(location.href); url.searchParams.delete("demo"); url.hash = "spaces"; history.replaceState(null, "", url);
    }
    return () => media.removeEventListener("change", change);
  }, [native, mobile]);
  useEffect(() => {
    const pop = () => setSelected(new URLSearchParams(location.search).get("room"));
    window.addEventListener("popstate", pop);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer); window.removeEventListener("popstate", pop); };
  }, []);
  const examples = useMemo(() => sampleRooms(), [demo]);
  const clock = demo ? Date.parse(examples[0].latest_reading.measured_at) : now;
  const rooms = useMemo(() => demo ? examples : mergeDirectory(directoryRooms, live.rooms), [demo, examples, live.rooms]);
  const staleAfter = live.staleAfterSeconds;
  const reporting = rooms.filter((room) => hasRecentReading(room, clock, staleAfter));
  const buildings = [...new Set(rooms.map((room) => room.location?.building).filter(Boolean))].sort();
  const savedCount = rooms.filter((room) => saved.has(room.room_id)).length;
  const matchesFilter = (room, kind) => kind === "all" || (kind === "saved" ? saved.has(room.room_id) : kind === "available" ? (availableSeats(room, clock, staleAfter) ?? 0) > 0 : noiseBand(noiseReading(room, clock, staleAfter))?.level === "quiet");
  // Snapshot ranks after a successful check or a deliberate sort change. Polls
  // update metrics in place without moving a card under a student's thumb.
  const orderKey = `${demo}:${sort}:${Boolean(live.checkedAt)}`;
  if (order.current.key !== orderKey) { order.current = new Map(); order.current.key = orderKey; }
  const sorted = [...rooms].sort((a, b) => compareRooms(a, b, sort, clock, staleAfter));
  for (const room of sorted) if (!order.current.has(room.room_id)) order.current.set(room.room_id, order.current.size);
  const filtered = rooms.filter((room) => matchesRoomSearch(room, query) && matchesFilter(room, filter) && (building === "all" || room.location?.building === building)).sort((a, b) => order.current.get(a.room_id) - order.current.get(b.room_id));
  const currentRoom = rooms.find((room) => room.room_id === selected);
  function clearFilters() { setQuery(""); setFilter("all"); setBuilding("all"); setSort("fresh"); }
  function openRoom(room) {
    listPosition.current = window.scrollY;
    const url = new URL(location.href); url.searchParams.set("room", room.room_id);
    history.pushState({ roomDetails: true }, "", url); setSelected(room.room_id);
  }
  function closeRoom() {
    if (history.state?.roomDetails) history.back();
    else { const url = new URL(location.href); url.searchParams.delete("room"); history.replaceState(null, "", url); setSelected(null); }
    requestAnimationFrame(() => window.scrollTo({ top: listPosition.current, behavior: "instant" }));
  }
  function switchDemo(value) { setDemo(value); clearFilters(); }
  return <>
    <a className="skip-link" href="#spaces">Skip to study spaces</a>
    <header className="site-header"><div className="nav-wrap"><a className="brand-link" href="#spaces" aria-label="SensoryAtlas home"><Brand /></a><span className="header-campus">UBC study spaces</span><nav aria-label="Main navigation"><a className="nav-link" href="#spaces">Find a space</a><button className="nav-link" onClick={() => setHow(true)}>How it works</button></nav><button className="nav-saved" aria-label={`Saved spaces${savedCount ? ` (${savedCount})` : ""}`} onClick={() => { setFilter("saved"); spacesRef.current?.scrollIntoView(); }}><Heart size={18} /><span>Saved</span>{savedCount > 0 && <span className="saved-count">{savedCount}</span>}</button><button className="mobile-help icon-button" aria-label="How it works" onClick={() => setHow(true)}><Info size={20} /></button></div></header>
    <main>
      {!mobile && <section className="hero page-width"><div className="hero-copy"><span className="eyebrow"><Asterisk size={18} />A little less guesswork</span><h1>Find a quiet<br />spot at <em>UBC</em></h1><p>Find a place for your next study session. Explore campus spaces and check live occupancy and sound readings where sensors are available.</p><div className="hero-actions"><a className="primary-button" href="#spaces">Explore study spaces <ArrowDown size={17} /></a><button className="secondary-button" onClick={() => switchDemo(true)}>Try sample preview <ArrowUpRight size={17} /></button></div></div><div className="hero-art"><div className="art-note"><span className="note-dot" />A good spot makes all the difference.</div><DeskIllustration /><span className="art-signature">Make yourself at home.</span></div></section>}
      <section className="spaces-section page-width" ref={spacesRef} id="spaces" aria-labelledby="spaces-heading">
        <div className="section-heading"><div><span className="eyebrow section-eyebrow"><MapPin size={14} />UBC Vancouver · study spaces</span><h1 id="spaces-heading">Find your space<span>.</span></h1><p className="directory-subtitle">A quiet corner. A little room to focus.</p></div><span className={`connection-status ${live.status}`} role="status"><span className="connection-dot" />{demo ? "Sample preview · fictional" : live.status === "ok" ? "API reachable · checks every ~10s" : live.status === "error" ? "API refresh failed · retrying" : "Connecting to API"}</span></div>
        {demo && <div className="demo-banner"><p><strong>You’re exploring sample spaces.</strong> These rooms and readings are fictional examples.</p><button onClick={() => switchDemo(false)}>Back to monitored rooms <ArrowRight size={16} /></button></div>}
        <div className="search-row"><div className="search-field"><Search size={20} /><input type="search" aria-label="Search by building or room" placeholder="Search by building or room" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button className="clear-search" aria-label="Clear search" onClick={() => setQuery("")}><X size={19} /></button>}</div></div>
        <div className="filter-row"><div className="filter-tabs" role="group" aria-label="Filter spaces">{filters.map((item) => <button key={item.id} className={filter === item.id ? "selected" : ""} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.id === "saved" && <Heart size={15} />}{item.label}</button>)}</div><button className="filters-trigger secondary-button" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={17} />Filters and sort{(building !== "all" || sort !== "fresh") && <span className="saved-count">{Number(building !== "all") + Number(sort !== "fresh")}</span>}</button><div className="inline-filters"><FilterFields building={building} setBuilding={setBuilding} sort={sort} setSort={setSort} buildings={buildings} /></div></div>
        <div className="coverage-note" aria-label="Live coverage"><span className="legend-dot" /><span>{reporting.length} of {rooms.length} spaces have recent readings</span><span className="coverage-limited">Limited sensor coverage</span></div>
        {!demo && live.status === "error" && <div className="error-banner" role="alert"><WifiOff size={19} /><p>{live.checkedAt ? `Couldn’t refresh. Last successful check: ${new Date(live.checkedAt).toLocaleString()}. Readings continue to age.` : "Couldn't load study spaces from the live service. The offline UBC directory is available below."}</p><button onClick={() => live.retry()}>Retry <RefreshCw size={15} /></button></div>}
        <div className="results-label"><span>{filtered.length} {filtered.length === 1 ? "space" : "spaces"}{query || filter !== "all" || building !== "all" ? " found" : " to explore"}</span><span>{sort === "fresh" ? "Fresh readings first" : sort === "seats" ? "Most seats available" : "Name: A–Z"}</span></div>
        {live.status === "loading" && !demo && <p className="loading-note" role="status">Checking live readings… You can browse the directory now.</p>}
        {filtered.length ? <div className="room-grid">{filtered.map((room) => <RoomCard key={room.room_id} room={room} now={clock} staleAfterSeconds={staleAfter} saved={saved.has(room.room_id)} onSave={toggle} onOpen={openRoom} demo={demo} />)}</div> : <div className="empty-state"><Search size={28} /><h3>{rooms.length ? "No spaces match just yet." : "No study spaces listed yet."}</h3><p>{filter === "saved" ? "Save a space with the heart to keep it close, even without live readings." : "Try another search or give your filters a little more room."}</p><button className="secondary-button" onClick={clearFilters}>Show all spaces <ArrowRight size={16} /></button></div>}
        <div className="data-note"><span><Info size={16} />Readings are estimates, with their own timestamps.</span><button onClick={() => setHow(true)}>A note on the numbers <ArrowUpRight size={16} /></button></div>
      </section>
      <section className="about-section page-width"><div><span className="eyebrow">A little less guesswork</span><h2>A good spot changes<br />your study session.</h2><p>Browse real locations from <a href="https://learningspaces.ubc.ca/find-a-space-informal/" target="_blank" rel="noreferrer">UBC Learning Spaces</a>. Live sensors cover a limited set of spaces. Community observations can also provide short-lived estimates for spaces without sensors.</p><p>No account or location permission needed. Saved spaces stay on this device. Sensors report people counts and sound levels.</p><button className="secondary-button" onClick={() => setHow(true)}>How it works <ArrowRight size={16} /></button></div>{mobile && <DeskIllustration />}</section>
      {native && <div className="native-connection page-width"><span>{readApiOrigin() ? "Monitored rooms use your saved API connection" : "Live connection not configured · directory available offline"}</span><button onClick={() => setConnectionOpen(true)}>API connection</button></div>}
    </main>
    <footer className="page-width site-footer"><Brand small /><p>Made for better study days.</p><span>An independent UBC prototype · limited coverage.</span></footer>
    {filtersOpen && <FilterSheet building={building} sort={sort} buildings={buildings} onClose={() => setFiltersOpen(false)} onApply={(nextBuilding, nextSort) => { setBuilding(nextBuilding); setSort(nextSort); setFiltersOpen(false); }} />}
    {connectionOpen && <ApiConnection onClose={() => setConnectionOpen(false)} onSave={() => live.retry({ clear: true })} />}
    {how && <HowItWorks onClose={() => setHow(false)} />}
    {currentRoom && <RoomDetails room={currentRoom} demo={demo} now={clock} staleAfterSeconds={staleAfter} saved={saved.has(currentRoom.room_id)} onSave={toggle} onClose={closeRoom} onReported={() => live.retry()} />}
  </>;
}
