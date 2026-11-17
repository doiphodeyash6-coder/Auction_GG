import { randomUUID } from 'node:crypto';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
let missingConfigurationLogged = false;

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function identity(user) {
  if (!user?.email) return null;
  return {
    email: String(user.email).trim().toLowerCase(),
    name: String(user.username || 'Auction participant').trim(),
  };
}

async function sendEmail({ recipient, subject, text, idempotencyKey }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    if (!missingConfigurationLogged) {
      console.warn('Auction emails are disabled. Set RESEND_API_KEY and EMAIL_FROM to enable delivery.');
      missingConfigurationLogged = true;
    }
    return false;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ from, to: [recipient.email], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const details = await response.text();
      console.error(`Auction email delivery failed (${response.status}): ${details.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Auction email delivery failed: ${error.message}`);
    return false;
  }
}

async function sendNotifications(notifications, eventId) {
  const seen = new Set();
  const tasks = notifications.flatMap(({ user, subject, text }) => {
    const recipient = identity(user);
    if (!recipient || seen.has(recipient.email)) return [];
    seen.add(recipient.email);
    return [sendEmail({
      recipient,
      subject,
      text,
      idempotencyKey: `${eventId}:${recipient.email}`,
    })];
  });
  await Promise.all(tasks);
}

function auctionUrl(auctionId) {
  const origin = (process.env.CLIENT_URL || '').split(',')[0].trim().replace(/\/$/, '');
  return origin ? `${origin}/?auction=${auctionId}` : '';
}

function linkLine(auctionId) {
  const url = auctionUrl(auctionId);
  return url ? `\n\nView the auction: ${url}` : '';
}

export function notifyAuctionListed({ auction, seller }) {
  const title = auction.title;
  return sendNotifications([{
    user: seller,
    subject: `Your auction is live: ${title}`,
    text: `Hi ${seller.username},\n\nYour listing “${title}” is now open for bids.${linkLine(auction._id)}`,
  }], `auction:${auction._id}:listed`);
}

export function notifyBidPlaced({ auctionId, title, amount, bidId, buyer, seller, outbidBuyer }) {
  const formattedAmount = `₹${Number(amount).toLocaleString('en-IN')}`;
  const link = linkLine(auctionId);
  const notifications = [
    {
      user: buyer,
      subject: `Your bid was placed: ${title}`,
      text: `Hi ${buyer.username},\n\nYour bid of ${formattedAmount} was accepted for “${title}”.${link}`,
    },
    {
      user: seller,
      subject: `New bid on your listing: ${title}`,
      text: `Hi ${seller.username},\n\n${buyer.username} placed a bid of ${formattedAmount} on “${title}”.${link}`,
    },
  ];

  if (outbidBuyer) {
    notifications.push({
      user: outbidBuyer,
      subject: `You have been outbid: ${title}`,
      text: `Hi ${outbidBuyer.username},\n\nA new bid of ${formattedAmount} has been placed on “${title}”. You are no longer the highest bidder.${link}`,
    });
  }

  return sendNotifications(notifications, `auction:${auctionId}:bid:${bidId}`);
}

export function notifyAuctionClosed({ auctionId, title, seller, buyer, finalPrice }) {
  const link = linkLine(auctionId);
  const notifications = [{
    user: seller,
    subject: `Auction ended: ${title}`,
    text: buyer
      ? `Hi ${seller.username},\n\n“${title}” has ended with a winning bid of ₹${Number(finalPrice).toLocaleString('en-IN')} from ${buyer.username}.${link}`
      : `Hi ${seller.username},\n\n“${title}” has ended without any bids.${link}`,
  }];

  if (buyer) {
    notifications.push({
      user: buyer,
      subject: `You won the auction: ${title}`,
      text: `Hi ${buyer.username},\n\nThe auction for “${title}” has ended. Your winning bid was ₹${Number(finalPrice).toLocaleString('en-IN')}.${link}`,
    });
  }

  return sendNotifications(notifications, `auction:${auctionId}:closed`);
}

export function sendTestEmail(user) {
  const recipient = identity(user);
  if (!recipient) return Promise.resolve(false);
  return sendEmail({
    recipient,
    subject: 'Gavel & Grain email check',
    text: `Hi ${recipient.name},\n\nEmail delivery is set up for your Gavel & Grain account. Auction updates for your activity will be sent to this address.`,
    idempotencyKey: `email-test:${user._id || recipient.email}:${randomUUID()}`,
  });
}
