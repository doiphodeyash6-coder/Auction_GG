import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useAuctions } from './context/AuctionContext';
import { useAuctionSocket } from './hooks/useAuctionSocket';
import { useCountdown } from './hooks/useCountdown';
import { api } from './lib/api';

const money = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
const dateLabel = (value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const CATEGORIES = ['All objects', 'Furniture', 'Lighting', 'Ceramics', 'Collectibles'];

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

function DashboardStat({ label, value, detail }) {
  return <div className="rounded-2xl border border-line bg-white/70 p-4"><p className="eyebrow">{label}</p><p className="mt-2 font-display text-3xl tracking-[-.04em]">{value}</p>{detail && <p className="mt-1 text-[10px] text-stone-500">{detail}</p>}</div>;
}

function AuthModal({ onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('buyer');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  async function submit(event) {
    event.preventDefault(); setError(''); setWorking(true);
    try {
      if (mode === 'register') await register({ username: name, email, password, role });
      else await login({ email, password });
      onClose();
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  }

  return <div className="modal-backdrop fixed inset-0 z-[70] grid place-items-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="fade-up w-full max-w-[430px] rounded-[26px] bg-paper p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between"><div><p className="eyebrow">Your place in the room</p><h2 id="auth-title" className="mt-2 font-display text-3xl tracking-[-.04em]">{mode === 'login' ? 'Welcome back.' : 'Join the house.'}</h2></div><CloseButton onClick={onClose} /></div>
      <p className="mt-3 text-sm leading-6 text-stone-600">{mode === 'login' ? 'Sign in to follow lots and take part in the auction.' : 'Choose how you want to take part in the auction house.'}</p>
      <form onSubmit={submit} method="post" autoComplete="on" className="mt-6 space-y-4">
        {mode === 'register' && <label className="field-label">Display name<input required minLength="2" maxLength="32" value={name} onChange={(event) => setName(event.target.value)} placeholder="How buyers and sellers will see you" autoComplete="nickname" className="field-input" /></label>}
        {mode === 'register' && <fieldset><legend className="field-label mb-2">I want to…</legend><div className="grid grid-cols-2 gap-2">
          {[['buyer', 'Buyer', 'Browse and bid'], ['bidder', 'Bidder', 'Compete in live bids'], ['seller', 'Seller', 'List and manage items']].map(([value, title, description]) => <label key={value} className={`cursor-pointer rounded-2xl border p-3 transition ${role === value ? 'border-moss bg-[#e7ecdf]' : 'border-line bg-white/60 hover:bg-white'}`}><input className="sr-only" type="radio" name="account-role" value={value} checked={role === value} onChange={() => { setRole(value); if (value === 'seller') setEmail('2024.yash.doiphode@ves.ac.in'); }} /><span className="block text-xs font-semibold">{title}</span><span className="mt-1 block text-[10px] leading-4 text-stone-500">{description}</span></label>)}
        </div></fieldset>}
        <label className="field-label">Email address<input required type="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="username" className="field-input" /></label>
        <label className="field-label">Password<input required type="password" name="password" minLength="8" maxLength="72" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="field-input" /></label>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{error}</p>}
        <button disabled={working} className="primary-button w-full">{working ? 'Please wait…' : mode === 'login' ? 'Sign in' : `Create ${role} account`}<span aria-hidden="true">↗</span></button>
      </form>
      <p className="mt-5 text-center text-sm text-stone-500">{mode === 'login' ? 'New to the auction house?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="font-semibold text-ink underline decoration-stone-300 underline-offset-4">{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
    </section>
  </div>;
}

function AuctionDetail({ auction, onClose, onLogin, onToast }) {
  const { user } = useAuth();
  const { updateAuction } = useAuctions();
  const { placeBid, connection, watchers } = useAuctionSocket(auction._id);
  const [amount, setAmount] = useState(auction.currentPrice + auction.minIncrement);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
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
    else onToast('Your bid is in. The price is live for everyone in the room.');
  }

  async function closeAuction() {
    setClosing(true); setBidError('');
    try {
      const { auction: closedAuction } = await api(`/auctions/${auction._id}/close`, { method: 'POST' });
      updateAuction(closedAuction);
      onToast('Auction ended. The listing is now closed.');
    } catch (error) { setBidError(error.message); }
    finally { setClosing(false); }
  }

  const bids = [...(auction.bids || [])].reverse();
  const ownerId = auction.createdBy?._id || auction.createdBy;
  const canClose = user?.role === 'admin' || (user?.role === 'seller' && String(ownerId) === String(user.id));
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
        <div className="flex items-center justify-between gap-3"><p className="eyebrow">Current standing</p><div className="flex items-center gap-2">{canClose && auction.status === 'active' && !timer.ended && <button type="button" onClick={closeAuction} disabled={closing} className="rounded-full border border-line bg-white px-3 py-1.5 text-[10px] font-semibold text-stone-600 transition hover:border-red-200 hover:text-red-700 disabled:opacity-50">{closing ? 'Ending…' : 'End auction'}</button>}<span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.13em] ${auction.status === 'active' && !timer.ended ? 'bg-[#e7ecdf] text-moss' : 'bg-stone-200 text-stone-600'}`}>{auction.status === 'active' && !timer.ended ? 'Open for bids' : 'Auction ended'}</span></div></div>
        <div className="mt-3 flex items-end justify-between gap-4"><div><p className="font-display text-4xl tracking-[-.04em] sm:text-5xl">{money(auction.currentPrice)}</p><p className="mt-2 text-xs text-stone-500">{auction.highestBidderName ? `Leading bidder · ${auction.highestBidderName}` : 'Opening bid · be the first'}</p></div><div className="text-right"><p className="eyebrow">Time remaining</p><p className={`mt-2 font-mono text-xl tabular-nums ${timer.ended ? 'text-stone-400' : 'text-clay'}`}>{timer.ended ? 'Closed' : timer.label}</p></div></div>
        {user?.role === 'seller' ? <div className="mt-6 rounded-[20px] border border-line bg-white p-4 text-xs leading-5 text-stone-600">You’re viewing this as a seller. Buyer and bidder accounts place bids; you can manage your own listings.</div> : <form onSubmit={submitBid} className="mt-6 rounded-[20px] border border-line bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between"><label htmlFor="bid-amount" className="text-xs font-semibold text-stone-600">Your bid <span className="text-stone-400">· increments {money(auction.minIncrement)}</span></label><span className="text-[10px] font-semibold uppercase tracking-[.12em] text-moss">Next from {money(nextMinimum)}</span></div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-paper px-4"><span className="font-display text-2xl text-stone-400">₹</span><input id="bid-amount" type="number" inputMode="numeric" min={nextMinimum} step={auction.minIncrement} value={amount} onChange={(event) => setAmount(event.target.value)} className="h-14 min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none" aria-label="Bid amount in rupees" /><span className="text-xs text-stone-400">INR</span></div>
          {bidError && <p role="alert" className="mt-3 text-xs leading-5 text-red-700">{bidError}</p>}
          <button type="submit" disabled={busy || auction.status !== 'active' || timer.ended} className="primary-button mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Sending your bid…' : !user ? 'Sign in to bid' : 'Place bid'}<span aria-hidden="true">↗</span></button>
          <p className="mt-3 text-center text-[10px] leading-4 text-stone-400">Highest valid bid wins when the auction closes. The live price updates for every connected buyer.</p>
        </form>}
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
  const { user } = useAuth();
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
      <div className="flex items-start justify-between"><div><p className="eyebrow">{user?.role === 'admin' ? 'Curator tools' : 'Seller tools'}</p><h2 id="create-title" className="mt-2 font-display text-3xl tracking-[-.04em]">Bring a piece to the block.</h2></div><CloseButton onClick={onClose} /></div>
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
  const [emailBusy, setEmailBusy] = useState(false);

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
  const sellerLots = user?.role === 'seller' ? auctions.filter((auction) => String(auction.createdBy?._id || auction.createdBy) === String(user.id)) : [];
  const buyerActivity = ['buyer', 'bidder'].includes(user?.role) ? auctions.filter((auction) => auction.bids?.some((bid) => String(bid.bidderId) === String(user.id))) : [];
  const buyerBidCount = buyerActivity.reduce((count, auction) => count + auction.bids.filter((bid) => String(bid.bidderId) === String(user.id)).length, 0);
  const buyerWins = buyerActivity.filter((auction) => auction.status === 'ended' && String(auction.highestBidder) === String(user.id)).length;
  const sellerBidCount = sellerLots.reduce((count, auction) => count + (auction.bids?.length || 0), 0);

  async function sendTestEmail() {
    setEmailBusy(true);
    try {
      const { message } = await api('/auth/email-test', { method: 'POST' });
      setToast(message);
    } catch (sendError) {
      setToast(sendError.message);
    } finally {
      setEmailBusy(false);
    }
  }

  function createdAuction(auction) { setToast(`“${auction.title}” is now open for bids.`); setCategory('All objects'); setQuery(''); }

  useEffect(() => {
    const requestedId = new URLSearchParams(window.location.search).get('auction');
    if (!requestedId || !auctions.some((auction) => auction._id === requestedId)) return;
    setSelectedId(requestedId);
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
  }, [auctions]);

  return <div className="min-h-screen bg-paper text-ink">
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-4 sm:px-7 lg:px-10">
        <a href="#top" aria-label="Gavel and Grain home"><Wordmark /></a>
        <nav className="hidden items-center gap-8 text-xs font-medium text-stone-600 md:flex">{user?.role === 'seller' ? <a href="#seller-studio" className="transition hover:text-ink">Seller studio</a> : ['buyer', 'bidder'].includes(user?.role) ? <a href="#buyer-dashboard" className="transition hover:text-ink">My bidding</a> : null}<a href="#lots" className="transition hover:text-ink">Marketplace</a><a href="#how-it-works" className="transition hover:text-ink">How it works</a></nav>
        <div className="flex items-center gap-2.5">
          {(user?.role === 'admin' || user?.role === 'seller') && <button onClick={() => setCreateOpen(true)} className="rounded-full border border-line px-3 py-2.5 text-[11px] font-semibold transition hover:bg-white sm:px-4 sm:text-xs"><span className="sm:hidden">+ Item</span><span className="hidden sm:inline">+ Add product</span></button>}
          {user ? <div className="flex items-center gap-2"><span className="hidden max-w-28 truncate text-xs font-medium sm:block">{user.username}</span><span className="hidden rounded-full bg-[#e7ecdf] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-moss sm:inline-flex">{user.role === 'admin' ? 'Curator' : user.role}</span><button onClick={logout} className="rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-moss">Sign out</button></div> : <button onClick={() => setAuthOpen(true)} disabled={authLoading} className="rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-moss">Sign in <span className="ml-1" aria-hidden="true">↗</span></button>}
        </div>
      </div>
    </header>

    <main id="top" className="mx-auto max-w-7xl px-4 pb-20 sm:px-7 lg:px-10">
      <section className="relative overflow-hidden border-b border-line py-12 sm:py-16 lg:py-[76px]">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#e4e1d8] sm:right-2 sm:top-1"><div className="absolute inset-7 rounded-full border border-[#e4e1d8]" /><div className="absolute inset-14 rounded-full border border-[#e4e1d8]" /></div>
        <div className="relative grid items-end gap-8 md:grid-cols-[1fr_auto]">
          <div><p className="eyebrow"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-clay align-middle" />A considered auction house <span className="mx-2 text-stone-300">/</span> Est. for good things</p><h1 className="mt-5 max-w-3xl font-display text-[clamp(3.2rem,8vw,6.6rem)] leading-[.91] tracking-[-.065em]">Find the one.<br /><span className="text-moss">Make it yours.</span></h1><p className="mt-5 max-w-xl text-sm leading-6 text-stone-600 sm:text-base">Buyers find pieces to love. Sellers bring well-kept objects to the block. Join the room, follow live bids and take home something made to last.</p></div>
          <div className="flex flex-wrap gap-2 md:justify-end"><div className="rounded-2xl border border-line bg-white/60 px-4 py-3"><p className="eyebrow">On the block</p><p className="mt-1 font-display text-2xl">{String(activeCount).padStart(2, '0')} <span className="text-sm text-stone-500">lots</span></p></div><div className="rounded-2xl border border-line bg-white/60 px-4 py-3"><p className="eyebrow">Bidding</p><p className="mt-1 inline-flex items-center gap-2 font-display text-2xl"><i className="h-2 w-2 rounded-full bg-emerald-500" />Live</p></div></div>
        </div>
      </section>

      {user?.role === 'seller' && <section id="seller-studio" className="scroll-mt-28 pt-10 sm:pt-12">
        <div className="flex flex-col justify-between gap-5 rounded-[26px] border border-line bg-[#eeeee7] p-5 sm:p-7 lg:flex-row lg:items-end">
          <div><p className="eyebrow text-moss">Seller workspace</p><h2 className="mt-2 font-display text-3xl tracking-[-.045em] sm:text-4xl">Your Seller Studio</h2><p className="mt-2 max-w-xl text-xs leading-5 text-stone-600">Add a product for bidding, follow its activity, and close your own listing when you’re ready.</p></div>
          <button onClick={() => setCreateOpen(true)} className="primary-button shrink-0">Add a product <span aria-hidden="true">↗</span></button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><DashboardStat label="Your products" value={String(sellerLots.length).padStart(2, '0')} detail="Listings you created"/><DashboardStat label="Open for bids" value={String(sellerLots.filter((auction) => auction.status === 'active').length).padStart(2, '0')} detail="Active seller listings"/><DashboardStat label="Total bids" value={String(sellerBidCount).padStart(2, '0')} detail="Across your listings"/></div>
        {sellerLots.length ? <div className="mt-6 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">{sellerLots.map((auction, index) => <AuctionCard key={auction._id} auction={auction} index={index} onClick={() => setSelectedId(auction._id)} />)}</div> : <div className="mt-5 rounded-[22px] border border-dashed border-stone-300 bg-white/50 p-8 text-center"><p className="font-display text-2xl">Your first product can go on the block.</p><p className="mt-2 text-xs text-stone-500">Create a listing and buyers will be able to bid on it.</p><button onClick={() => setCreateOpen(true)} className="mt-4 rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-moss">List your first product</button></div>}
      </section>}

      {['buyer', 'bidder'].includes(user?.role) && <section id="buyer-dashboard" className="scroll-mt-28 pt-10 sm:pt-12">
        <div className="rounded-[26px] bg-ink p-5 text-paper sm:p-7"><p className="eyebrow text-[#c5cebd]">Buyer workspace</p><div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="font-display text-3xl tracking-[-.045em] sm:text-4xl">Your Bidding Desk</h2><p className="mt-2 max-w-xl text-xs leading-5 text-white/60">Track the auctions you’ve bid on. Place the highest valid bid when the clock runs out to win the item.</p></div><a href="#lots" className="inline-flex w-fit items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-xs font-semibold text-ink transition hover:bg-[#dfe5d9]">Find an item <span aria-hidden="true">↗</span></a></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><DashboardStat label="Auctions you bid on" value={String(buyerActivity.length).padStart(2, '0')} detail="Your bidding activity"/><DashboardStat label="Your bids" value={String(buyerBidCount).padStart(2, '0')} detail="Accepted bids"/><DashboardStat label="Items won" value={String(buyerWins).padStart(2, '0')} detail="Auctions ended in your lead"/></div>
        {buyerActivity.length ? <div className="mt-6 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">{buyerActivity.map((auction, index) => <AuctionCard key={auction._id} auction={auction} index={index} onClick={() => setSelectedId(auction._id)} />)}</div> : <div className="mt-5 rounded-[22px] border border-line bg-white/55 p-6 text-center"><p className="text-sm font-semibold">Your bidding activity will appear here.</p><p className="mt-1 text-xs text-stone-500">Browse the marketplace and place your first bid.</p></div>}
      </section>}

      {user && <section aria-label="Email notification settings" className="mt-7 flex flex-col gap-3 rounded-[20px] border border-line bg-white/65 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><p className="eyebrow">Auction email updates</p><p className="mt-1 text-xs leading-5 text-stone-600">Buyer and seller activity notices go to <span className="font-semibold text-ink">{user.email}</span>.</p></div>
        <button type="button" onClick={sendTestEmail} disabled={emailBusy} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-xs font-semibold transition hover:border-moss hover:text-moss disabled:cursor-wait disabled:opacity-60">{emailBusy ? 'Sending test…' : 'Send a test email'} <span aria-hidden="true">↗</span></button>
      </section>}

      <section id="lots" className="scroll-mt-28 pt-9 sm:pt-12">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">{user?.role === 'seller' ? 'Public marketplace' : 'Buyer marketplace'}</p><h2 className="mt-2 font-display text-3xl tracking-[-.045em] sm:text-[40px]">{user?.role === 'seller' ? 'See what buyers are bidding on.' : 'Find something worth winning.'}</h2></div><label className="relative block w-full sm:max-w-[280px]"><span className="sr-only">Search lots</span><svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.6"/><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the collection" className="h-11 w-full rounded-full border border-line bg-white/60 pl-10 pr-4 text-xs outline-none transition placeholder:text-stone-400 focus:border-moss" /></label></div>
        <div className="soft-scroll mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter lots by category">{CATEGORIES.map((item) => <button key={item} role="tab" aria-selected={category === item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold transition ${category === item ? 'bg-ink text-white' : 'border border-line bg-white/50 text-stone-600 hover:bg-white'}`}>{item}</button>)}</div>

        {error && <div role="alert" className="mt-8 flex flex-col justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-amber-900">Couldn’t reach the auction house.</p><p className="mt-1 text-xs leading-5 text-amber-800">{error} {import.meta.env.PROD ? 'Check the configured API service and database, then try again.' : 'Start MongoDB and the API server, then try again.'}</p></div><button onClick={refresh} className="rounded-full border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-900">Retry</button></div>}
        {loading && !auctions.length && <div className="grid gap-x-5 gap-y-9 pt-7 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map((item) => <div key={item} className="animate-pulse"><div className="aspect-[1.22/1] rounded-[22px] bg-stone-200"/><div className="mt-4 h-5 w-3/4 rounded bg-stone-200"/><div className="mt-3 h-3 w-1/2 rounded bg-stone-200"/></div>)}</div>}
        {!loading && !error && !sorted.length && <div className="mt-8 rounded-[22px] border border-dashed border-stone-300 py-16 text-center"><p className="font-display text-2xl">Nothing on this shelf yet.</p><p className="mt-2 text-sm text-stone-500">Try another search, or check back when the next lot arrives.</p></div>}
        {!!sorted.length && <div className="grid gap-x-5 gap-y-9 pt-7 sm:grid-cols-2 lg:grid-cols-4">{sorted.map((auction, index) => <AuctionCard key={auction._id} auction={auction} index={index} onClick={() => setSelectedId(auction._id)} />)}</div>}
      </section>

      <section id="how-it-works" className="mt-20 overflow-hidden rounded-[28px] bg-ink text-paper sm:mt-28">
        <div className="grid lg:grid-cols-[.92fr_1.08fr]">
          <div className="p-6 sm:p-10 lg:p-12"><p className="eyebrow text-[#c5cebd]">The good part is the room</p><h2 className="mt-4 max-w-md font-display text-4xl leading-[1.05] tracking-[-.045em] sm:text-5xl">A bid should feel like being there.</h2><p className="mt-4 max-w-md text-sm leading-6 text-white/60">Buyers place bids while sellers follow their listings. Every connected visitor sees the live price, and the people involved receive email updates about important auction activity.</p><a href="#lots" className="mt-7 inline-flex items-center gap-3 rounded-full bg-paper px-5 py-3 text-xs font-semibold text-ink transition hover:bg-[#dfe5d9]">Explore the lots <span aria-hidden="true">↗</span></a></div>
          <div className="flex items-center border-t border-white/10 p-6 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
            <div className="w-full space-y-3">
              {[['01', 'Buyer places a bid', 'A secure request reaches the auction server.'], ['02', 'The server checks it', 'Minimum increment, buyer role and close time.'], ['03', 'The room updates', 'A WebSocket event pushes the new high bid to every visitor.'], ['04', 'Buyer and seller hear back', 'Email alerts cover bids, outbids and auction results.']].map(([num, title, text]) => <div key={num} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[.045] p-4"><span className="font-mono text-xs text-[#bdc8b5]">{num}</span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-white/55">{text}</p></div></div>)}
              <p className="px-1 pt-1 text-[10px] text-white/35">REST API + MongoDB + Socket.IO rooms</p>
            </div>
          </div>
        </div>
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
