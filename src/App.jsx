import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useAuctions } from './context/AuctionContext';
import { useAuctionSocket } from './hooks/useAuctionSocket';
import { useCountdown } from './hooks/useCountdown';
import { api } from './lib/api';

const money = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
const dateLabel = (value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const CATEGORIES = ['All objects', 'Furniture', 'Lighting', 'Ceramics', 'Collectibles'];

const LABS = [
  ['01', 'Responsive UI', 'Tailwind CSS layouts adapt from phone to desktop.'],
  ['02', 'React Hooks', 'useEffect, useContext and custom countdown/socket hooks.'],
  ['03', 'Shared state', 'Reducer based Context API for auctions and session.'],
  ['04', 'MongoDB + Mongoose', 'Persistent auction, account and bid documents.'],
  ['05', 'Secure REST API', 'Input validation, Helmet, CORS and request limits.'],
  ['06', 'JWT roles', 'Password hashing and bidder/admin permissions.'],
  ['07', 'Postman', 'Ready-to-import collection covers the main API flows.'],
  ['08', 'WebSockets', 'Socket.IO rooms broadcast accepted bids live.'],
  ['09', 'CI/CD', 'GitHub Actions builds, then calls a Render deploy hook.'],
  ['10', 'Docker', 'Compose starts the app and MongoDB together.'],
];

function Wordmark() {
  return <div className="flex items-center gap-2.5">
    <div className="grid h-10 w-10 place-items-center rounded-full bg-ink text-paper">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 4 7 7M5 7l7-7 7 7-7 7L5 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="m14 13 5 5m-3 3 5-5M4 21h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
    </div>
    <div className="leading-none"><span className="font-display text-[19px] tracking-[-.04em]">Gavel <span className="text-clay">&</span> Grain</span><span className="mt-1.5 block text-[9px] font-semibold uppercase tracking-[.2em] text-stone-500">Objects with a past</span></div>
  </div>;
}

function CloseButton({ onClick, label = 'Close' }) {
  return <button type="button" onClick={onClick} aria-label={label} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-stone-600 transition hover:bg-stone-100 hover:text-ink"><svg width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg></button>;
}

function LivePill({ connection }) {
  const live = connection === 'live';
  const label = live ? 'Live connection' : connection === 'connecting' ? 'Connecting' : connection === 'reconnecting' ? 'Reconnecting' : 'Offline';
  return <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-stone-600"><i className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.12)]' : 'bg-amber-500'}`} />{label}</span>;
}

function AuctionCard({ auction, onClick, index }) {
  const timer = useCountdown(auction.endsAt);
  return <button onClick={onClick} className="group fade-up text-left" style={{ animationDelay: `${index * 45}ms` }}>
    <div className="relative overflow-hidden rounded-[22px] bg-[#e7e5dd]">
      <div className="art-grid aspect-[1.22/1] overflow-hidden">
        <img src={auction.imageUrl} alt={auction.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-paper/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-ink">{auction.category}</span>
      <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-2.5 py-1.5 text-[10px] font-medium text-white"><i className={`h-1.5 w-1.5 rounded-full ${auction.status === 'active' ? 'bg-emerald-400' : 'bg-stone-400'}`} />{auction.status === 'active' ? 'On the block' : 'Closed'}</span>
      <span className="absolute bottom-3 right-3 grid h-9 w-9 translate-y-2 place-items-center rounded-full bg-paper text-ink opacity-0 shadow transition group-hover:translate-y-0 group-hover:opacity-100" aria-hidden="true">↗</span>
    </div>
    <div className="flex items-start justify-between gap-4 px-1 pt-4">
      <div><h3 className="font-display text-[21px] leading-tight tracking-[-.03em] text-ink">{auction.title}</h3><p className="mt-1.5 text-xs text-stone-500">{auction.bids?.length || 0} bids <span className="px-1">·</span> closes {dateLabel(auction.endsAt)}</p></div>
      <div className="shrink-0 text-right"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-stone-500">Current bid</p><p className="mt-1 font-semibold tracking-tight">{money(auction.currentPrice)}</p></div>
    </div>
    <div className="mt-3 flex items-center justify-between border-t border-line px-1 pt-3 text-[11px] text-stone-500">
      <span>Next bid from <b className="font-semibold text-ink">{money(auction.currentPrice + auction.minIncrement)}</b></span>
      <span className="font-mono tabular-nums">{timer.ended ? 'Ended' : timer.label}</span>
    </div>
  </button>;
}

function AuthModal({ onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  async function submit(event) {
    event.preventDefault(); setError(''); setWorking(true);
    try {
      if (mode === 'register') await register({ username: name, email, password });
      else await login({ email, password });
      onClose();
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  }

  return <div className="modal-backdrop fixed inset-0 z-[70] grid place-items-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="fade-up w-full max-w-[430px] rounded-[26px] bg-paper p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between"><div><p className="eyebrow">Your place in the room</p><h2 id="auth-title" className="mt-2 font-display text-3xl tracking-[-.04em]">{mode === 'login' ? 'Welcome back.' : 'Join the house.'}</h2></div><CloseButton onClick={onClose} /></div>
      <p className="mt-3 text-sm leading-6 text-stone-600">{mode === 'login' ? 'Sign in to follow lots and place a bid.' : 'Create a bidder account. It only takes a moment.'}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === 'register' && <label className="field-label">Display name<input required minLength="2" maxLength="32" value={name} onChange={(event) => setName(event.target.value)} placeholder="How bidders will see you" autoComplete="nickname" className="field-input" /></label>}
        <label className="field-label">Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" className="field-input" /></label>
        <label className="field-label">Password<input required type="password" minLength="10" maxLength="72" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="field-input" /></label>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{error}</p>}
        <button disabled={working} className="primary-button w-full">{working ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create bidder account'}<span aria-hidden="true">↗</span></button>
      </form>
      <p className="mt-5 text-center text-sm text-stone-500">{mode === 'login' ? 'New to the auction house?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="font-semibold text-ink underline decoration-stone-300 underline-offset-4">{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
    </section>
  </div>;
}

function AuctionDetail({ auction, onClose, onLogin, onToast }) {
  const { user } = useAuth();
  const { placeBid, connection, watchers } = useAuctionSocket(auction._id);
  const [amount, setAmount] = useState(auction.currentPrice + auction.minIncrement);
  const [busy, setBusy] = useState(false);
  const [bidError, setBidError] = useState('');
  const timer = useCountdown(auction.endsAt);
  const nextMinimum = auction.currentPrice + auction.minIncrement;

  useEffect(() => { setAmount(nextMinimum); }, [nextMinimum]);

  async function submitBid(event) {
    event.preventDefault(); setBidError('');
    if (!user) { onLogin(); return; }
    if (Number(amount) < nextMinimum) { setBidError(`Minimum bid is ${money(nextMinimum)}.`); return; }
    setBusy(true);
    const result = await placeBid(Number(amount));
    setBusy(false);
    if (!result.ok) setBidError(result.error || 'Bid could not be placed.');
    else onToast('Your bid is in. Everyone in the room has been updated.');
  }

  const bids = [...(auction.bids || [])].reverse();
  return <div className="modal-backdrop fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="auction-title" className="auction-dialog fade-up mx-auto grid w-full max-w-6xl overflow-hidden rounded-[26px] bg-paper shadow-2xl lg:grid-cols-[1.05fr_.95fr]">
      <div className="relative min-h-[320px] bg-[#e7e5dd] lg:min-h-full">
        <div className="art-grid absolute inset-0"><img src={auction.imageUrl} alt={auction.title} className="h-full w-full object-cover" /></div>
        <div className="absolute left-5 top-5"><Wordmark /></div><div className="absolute right-5 top-5"><CloseButton onClick={onClose} /></div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/75 to-transparent p-6 pt-24 text-white sm:p-8 sm:pt-28">
          <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] backdrop-blur">{auction.category}</span>
          <h2 className="mt-4 max-w-xl font-display text-4xl leading-[1.05] tracking-[-.045em] sm:text-5xl">{auction.title}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">{auction.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-white/80"><span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-400" />{watchers} in this auction room</span><span className="text-white/40">·</span><LivePill connection={connection} /></div>
        </div>
      </div>
      <div className="auction-panel-scroll soft-scroll flex flex-col overflow-y-auto p-5 sm:p-8">
        <div className="flex items-center justify-between"><p className="eyebrow">Current standing</p><span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.13em] ${auction.status === 'active' && !timer.ended ? 'bg-[#e7ecdf] text-moss' : 'bg-stone-200 text-stone-600'}`}>{auction.status === 'active' && !timer.ended ? 'Open for bids' : 'Auction ended'}</span></div>
        <div className="mt-3 flex items-end justify-between gap-4"><div><p className="font-display text-4xl tracking-[-.04em] sm:text-5xl">{money(auction.currentPrice)}</p><p className="mt-2 text-xs text-stone-500">{auction.highestBidderName ? `Leading bidder · ${auction.highestBidderName}` : 'Opening bid · be the first'}</p></div><div className="text-right"><p className="eyebrow">Time remaining</p><p className={`mt-2 font-mono text-xl tabular-nums ${timer.ended ? 'text-stone-400' : 'text-clay'}`}>{timer.ended ? 'Closed' : timer.label}</p></div></div>
        <form onSubmit={submitBid} className="mt-6 rounded-[20px] border border-line bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between"><label htmlFor="bid-amount" className="text-xs font-semibold text-stone-600">Your bid <span className="text-stone-400">· increments {money(auction.minIncrement)}</span></label><span className="text-[10px] font-semibold uppercase tracking-[.12em] text-moss">Next from {money(nextMinimum)}</span></div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-paper px-4"><span className="font-display text-2xl text-stone-400">₹</span><input id="bid-amount" type="number" inputMode="numeric" min={nextMinimum} step={auction.minIncrement} value={amount} onChange={(event) => setAmount(event.target.value)} className="h-14 min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none" aria-label="Bid amount in rupees" /><span className="text-xs text-stone-400">INR</span></div>
          {bidError && <p role="alert" className="mt-3 text-xs leading-5 text-red-700">{bidError}</p>}
          <button type="submit" disabled={busy || auction.status !== 'active' || timer.ended} className="primary-button mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Sending your bid…' : !user ? 'Sign in to bid' : 'Place bid'}<span aria-hidden="true">↗</span></button>
          <p className="mt-3 text-center text-[10px] leading-4 text-stone-400">Bids are final. The live price updates for every connected bidder.</p>
        </form>
        <div className="mt-7 flex items-center justify-between"><div><p className="eyebrow">Bidding activity</p><p className="mt-1 text-xs text-stone-500">Most recent bids appear first</p></div><span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-stone-500">{bids.length} total</span></div>
        <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white px-4">
          {bids.length ? bids.slice(0, 6).map((bid) => <div key={bid._id} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e7ecdf] text-[10px] font-bold uppercase text-moss">{(bid.bidderName || 'B').slice(0, 1)}</span><div className="min-w-0"><p className="truncate text-xs font-semibold">{bid.bidderName}</p><p className="mt-0.5 text-[10px] text-stone-400">{new Date(bid.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p></div></div><p className="shrink-0 text-sm font-semibold">{money(bid.amount)}</p></div>) : <p className="py-6 text-center text-xs text-stone-500">No bids yet. Make the opening move.</p>}
        </div>
        <div className="mt-5 rounded-2xl bg-[#e9e7df] p-4"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-ink"><span className="grid h-6 w-6 place-items-center rounded-full bg-white text-moss">↗</span>Live bid, end to end</div><p className="mt-2 text-xs leading-5 text-stone-600">Socket.IO sends your bid to the server. The server validates and saves it to MongoDB, then broadcasts the new price to this auction room.</p></div>
      </div>
    </section>
  </div>;
}

function CreateAuctionModal({ onClose, onCreated }) {
  const { updateAuction } = useAuctions();
  const [form, setForm] = useState({ title: '', description: '', category: 'Furniture', startingPrice: '', minIncrement: '500', durationHours: '24', imageUrl: '/assets/sling-chair.svg' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function change(event) { setForm((value) => ({ ...value, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const { auction } = await api('/auctions', { method: 'POST', body: JSON.stringify({ ...form, startingPrice: Number(form.startingPrice), minIncrement: Number(form.minIncrement), durationHours: Number(form.durationHours) }) });
      updateAuction(auction); onCreated(auction); onClose();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="create-title" className="fade-up my-auto w-full max-w-[560px] rounded-[26px] bg-paper p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between"><div><p className="eyebrow">Curator tools</p><h2 id="create-title" className="mt-2 font-display text-3xl tracking-[-.04em]">Bring a piece to the block.</h2></div><CloseButton onClick={onClose} /></div>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="field-label sm:col-span-2">Lot title<input className="field-input" name="title" required minLength="4" maxLength="90" value={form.title} onChange={change} placeholder="e.g. Danish teak side table" /></label>
        <label className="field-label sm:col-span-2">Description<textarea className="field-input min-h-24 resize-y" name="description" required minLength="12" maxLength="2000" value={form.description} onChange={change} placeholder="Tell bidders what makes it worth keeping…" /></label>
        <label className="field-label">Category<select className="field-input" name="category" value={form.category} onChange={change}>{CATEGORIES.filter((category) => category !== 'All objects').map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className="field-label">Image<select className="field-input" name="imageUrl" value={form.imageUrl} onChange={change}><option value="/assets/sling-chair.svg">Walnut sling chair</option><option value="/assets/table-lamp.svg">Brass table lamp</option><option value="/assets/film-camera.svg">Film camera</option><option value="/assets/ceramic-vase.svg">Stoneware vase</option></select></label>
        <label className="field-label">Starting bid (₹)<input className="field-input" name="startingPrice" required type="number" min="1" value={form.startingPrice} onChange={change} placeholder="12,000" /></label>
        <label className="field-label">Bid increment (₹)<input className="field-input" name="minIncrement" required type="number" min="1" value={form.minIncrement} onChange={change} /></label>
        <label className="field-label sm:col-span-2">Duration in hours<input className="field-input" name="durationHours" required type="number" min="1" max="720" value={form.durationHours} onChange={change} /></label>
        {error && <p role="alert" className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</p>}
        <button disabled={busy} className="primary-button sm:col-span-2">{busy ? 'Publishing…' : 'Publish auction'}<span aria-hidden="true">↗</span></button>
      </form>
    </section>
  </div>;
}

function App() {
  const { user, logout, loading: authLoading } = useAuth();
  const { auctions, loading, error, refresh } = useAuctions();
  const [category, setCategory] = useState('All objects');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(''), 3800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const filtered = useMemo(() => auctions.filter((auction) => {
    const matchesCategory = category === 'All objects' || auction.category === category;
    const haystack = `${auction.title} ${auction.description} ${auction.category}`.toLowerCase();
    return matchesCategory && haystack.includes(query.toLowerCase());
  }), [auctions, category, query]);
  const activeCount = auctions.filter((auction) => auction.status === 'active').length;
  const selected = auctions.find((auction) => auction._id === selectedId);
  const sorted = [...filtered].sort((a, b) => (a.status === b.status ? new Date(a.endsAt) - new Date(b.endsAt) : a.status === 'active' ? -1 : 1));

  function createdAuction(auction) { setToast(`“${auction.title}” is now open for bids.`); setCategory('All objects'); setQuery(''); }

  return <div className="min-h-screen bg-paper text-ink">
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-4 sm:px-7 lg:px-10">
        <a href="#top" aria-label="Gavel and Grain home"><Wordmark /></a>
        <nav className="hidden items-center gap-8 text-xs font-medium text-stone-600 md:flex"><a href="#lots" className="transition hover:text-ink">The lots</a><a href="#how-it-works" className="transition hover:text-ink">How it works</a><a href="#lab-notes" className="transition hover:text-ink">Lab experiments</a></nav>
        <div className="flex items-center gap-2.5">
          {user?.role === 'admin' && <button onClick={() => setCreateOpen(true)} className="rounded-full border border-line px-3 py-2.5 text-[11px] font-semibold transition hover:bg-white sm:px-4 sm:text-xs"><span className="sm:hidden">+ Lot</span><span className="hidden sm:inline">+ Add a lot</span></button>}
          {user ? <div className="flex items-center gap-2"><span className="hidden max-w-28 truncate text-xs font-medium sm:block">{user.username}</span>{user.role === 'admin' && <span className="hidden rounded-full bg-[#e7ecdf] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-moss sm:inline-flex">Curator</span>}<button onClick={logout} className="rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-moss">Sign out</button></div> : <button onClick={() => setAuthOpen(true)} disabled={authLoading} className="rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-moss">Sign in <span className="ml-1" aria-hidden="true">↗</span></button>}
        </div>
      </div>
    </header>

    <main id="top" className="mx-auto max-w-7xl px-4 pb-20 sm:px-7 lg:px-10">
      <section className="relative overflow-hidden border-b border-line py-12 sm:py-16 lg:py-[76px]">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#e4e1d8] sm:right-2 sm:top-1"><div className="absolute inset-7 rounded-full border border-[#e4e1d8]" /><div className="absolute inset-14 rounded-full border border-[#e4e1d8]" /></div>
        <div className="relative grid items-end gap-8 md:grid-cols-[1fr_auto]">
          <div><p className="eyebrow"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-clay align-middle" />A considered auction house <span className="mx-2 text-stone-300">/</span> Est. for good things</p><h1 className="mt-5 max-w-3xl font-display text-[clamp(3.2rem,8vw,6.6rem)] leading-[.91] tracking-[-.065em]">Find the one.<br /><span className="text-moss">Make it yours.</span></h1><p className="mt-5 max-w-xl text-sm leading-6 text-stone-600 sm:text-base">Objects with a past, looking for a next chapter. Join the room, follow the bids and take home something made to last.</p></div>
          <div className="flex flex-wrap gap-2 md:justify-end"><div className="rounded-2xl border border-line bg-white/60 px-4 py-3"><p className="eyebrow">On the block</p><p className="mt-1 font-display text-2xl">{String(activeCount).padStart(2, '0')} <span className="text-sm text-stone-500">lots</span></p></div><div className="rounded-2xl border border-line bg-white/60 px-4 py-3"><p className="eyebrow">Bidding</p><p className="mt-1 inline-flex items-center gap-2 font-display text-2xl"><i className="h-2 w-2 rounded-full bg-emerald-500" />Live</p></div></div>
        </div>
      </section>

      <section id="lots" className="scroll-mt-28 pt-9 sm:pt-12">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">The current collection</p><h2 className="mt-2 font-display text-3xl tracking-[-.045em] sm:text-[40px]">Good things, going once.</h2></div><label className="relative block w-full sm:max-w-[280px]"><span className="sr-only">Search lots</span><svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.6"/><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the collection" className="h-11 w-full rounded-full border border-line bg-white/60 pl-10 pr-4 text-xs outline-none transition placeholder:text-stone-400 focus:border-moss" /></label></div>
        <div className="soft-scroll mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter lots by category">{CATEGORIES.map((item) => <button key={item} role="tab" aria-selected={category === item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold transition ${category === item ? 'bg-ink text-white' : 'border border-line bg-white/50 text-stone-600 hover:bg-white'}`}>{item}</button>)}</div>

        {error && <div role="alert" className="mt-8 flex flex-col justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-amber-900">Couldn’t reach the auction house.</p><p className="mt-1 text-xs leading-5 text-amber-800">{error} Start MongoDB and the API server, then try again.</p></div><button onClick={refresh} className="rounded-full border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-900">Retry</button></div>}
        {loading && !auctions.length && <div className="grid gap-x-5 gap-y-9 pt-7 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map((item) => <div key={item} className="animate-pulse"><div className="aspect-[1.22/1] rounded-[22px] bg-stone-200"/><div className="mt-4 h-5 w-3/4 rounded bg-stone-200"/><div className="mt-3 h-3 w-1/2 rounded bg-stone-200"/></div>)}</div>}
        {!loading && !error && !sorted.length && <div className="mt-8 rounded-[22px] border border-dashed border-stone-300 py-16 text-center"><p className="font-display text-2xl">Nothing on this shelf yet.</p><p className="mt-2 text-sm text-stone-500">Try another search, or check back when the next lot arrives.</p></div>}
        {!!sorted.length && <div className="grid gap-x-5 gap-y-9 pt-7 sm:grid-cols-2 lg:grid-cols-4">{sorted.map((auction, index) => <AuctionCard key={auction._id} auction={auction} index={index} onClick={() => setSelectedId(auction._id)} />)}</div>}
      </section>

      <section id="how-it-works" className="mt-20 overflow-hidden rounded-[28px] bg-ink text-paper sm:mt-28">
        <div className="grid lg:grid-cols-[.92fr_1.08fr]">
          <div className="p-6 sm:p-10 lg:p-12"><p className="eyebrow text-[#c5cebd]">The good part is the room</p><h2 className="mt-4 max-w-md font-display text-4xl leading-[1.05] tracking-[-.045em] sm:text-5xl">A bid should feel like being there.</h2><p className="mt-4 max-w-md text-sm leading-6 text-white/60">When you bid, the room moves with you. Every connected bidder sees the same price, the same moment it changes.</p><a href="#lots" className="mt-7 inline-flex items-center gap-3 rounded-full bg-paper px-5 py-3 text-xs font-semibold text-ink transition hover:bg-[#dfe5d9]">Explore the lots <span aria-hidden="true">↗</span></a></div>
          <div className="flex items-center border-t border-white/10 p-6 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
            <div className="w-full space-y-3">
              {[['01', 'You place a bid', 'A secure request reaches the auction server.'], ['02', 'The server checks it', 'Minimum increment, auction status and close time.'], ['03', 'The room updates', 'A WebSocket event pushes the new high bid to every bidder.']].map(([num, title, text]) => <div key={num} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[.045] p-4"><span className="font-mono text-xs text-[#bdc8b5]">{num}</span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-white/55">{text}</p></div></div>)}
              <p className="px-1 pt-1 text-[10px] text-white/35">REST API + MongoDB + Socket.IO rooms</p>
            </div>
          </div>
        </div>
      </section>

      <section id="lab-notes" className="scroll-mt-24 pt-20 sm:pt-28">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="eyebrow">The build behind the bids</p><h2 className="mt-2 font-display text-3xl tracking-[-.045em] sm:text-[40px]">Ten experiments. One auction house.</h2></div><p className="max-w-sm text-xs leading-5 text-stone-500">Each part of this application demonstrates one step in the full-stack lab series.</p></div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{LABS.map(([number, title, text]) => <article key={number} className="rounded-2xl border border-line bg-white/45 p-4 transition hover:-translate-y-0.5 hover:bg-white"><div className="flex items-center justify-between"><span className="font-mono text-[11px] text-clay">{number}</span>{number === '08' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}</div><h3 className="mt-4 text-xs font-bold">{title}</h3><p className="mt-2 text-[11px] leading-[1.55] text-stone-500">{text}</p></article>)}</div>
      </section>

      <footer className="mt-16 flex flex-col gap-3 border-t border-line pt-5 text-[10px] text-stone-500 sm:flex-row sm:items-center sm:justify-between"><span>© 2026 Gavel & Grain <span className="px-1.5">·</span> Made for objects worth keeping</span><span>Role protected bidding <span className="px-1.5">·</span> Live auctions are powered by Socket.IO</span></footer>
    </main>

    {selected && <AuctionDetail auction={selected} onClose={() => setSelectedId(null)} onLogin={() => setAuthOpen(true)} onToast={setToast} />}
    {createOpen && <CreateAuctionModal onClose={() => setCreateOpen(false)} onCreated={createdAuction} />}
    {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    {toast && <div role="status" className="fixed bottom-5 left-1/2 z-[80] w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-2xl bg-ink px-5 py-4 text-sm font-medium text-white shadow-2xl">{toast}</div>}
  </div>;
}

export default App;
