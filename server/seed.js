import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase } from './config/database.js';
import User from './models/User.js';
import Auction from './models/Auction.js';

export async function seedData() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  let admin = null;
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 10) throw new Error('ADMIN_PASSWORD must contain at least 10 characters.');
    admin = await User.findOne({ email: adminEmail });
    if (admin) {
      if (admin.role !== 'admin') { admin.role = 'admin'; await admin.save(); }
    } else {
      admin = await User.create({
        username: 'Auction curator', email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12), role: 'admin',
      });
    }
    console.info(`Admin account ready: ${adminEmail}`);
  }

  if (await Auction.estimatedDocumentCount() > 0) return;
  const soon = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000);
  await Auction.insertMany([
    {
      title: 'Mila table lamp, 1970s', category: 'Lighting', imageUrl: '/assets/table-lamp.svg',
      description: 'A sculptural brass and opaline glass table lamp sourced from a Copenhagen studio. Warm patina, rewired and ready to glow.',
      startingPrice: 18500, currentPrice: 18500, minIncrement: 500, endsAt: soon(7), createdBy: admin?._id,
      bids: [{ bidderName: 'Mira K.', amount: 18500, createdAt: new Date(Date.now() - 3600000) }],
    },
    {
      title: 'Olympus OM-1 film camera', category: 'Collectibles', imageUrl: '/assets/film-camera.svg',
      description: 'Classic 35mm body with a clean 50mm lens. Meter tested, shutter sounds crisp, and includes its original leather case.',
      startingPrice: 12400, currentPrice: 12400, minIncrement: 400, endsAt: soon(19), createdBy: admin?._id,
      bids: [{ bidderName: 'Rohan P.', amount: 12400, createdAt: new Date(Date.now() - 7800000) }],
    },
    {
      title: 'Studio-made stoneware vase', category: 'Ceramics', imageUrl: '/assets/ceramic-vase.svg',
      description: 'Hand-thrown stoneware with a soft ash glaze and expressive shoulder. Signed on the base; approximately 28 cm tall.',
      startingPrice: 7600, currentPrice: 7600, minIncrement: 300, endsAt: soon(31), createdBy: admin?._id,
      bids: [{ bidderName: 'Asha D.', amount: 7600, createdAt: new Date(Date.now() - 18000000) }],
    },
    {
      title: 'Low sling chair in walnut', category: 'Furniture', imageUrl: '/assets/sling-chair.svg',
      description: 'A beautifully aged walnut frame paired with a restored saddle-leather sling. Tight joinery and a mellow, lived-in finish.',
      startingPrice: 32800, currentPrice: 32800, minIncrement: 1000, endsAt: soon(46), createdBy: admin?._id,
      bids: [],
    },
  ]);
  console.info('Demo auctions seeded.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await connectDatabase();
  await seedData();
  process.exit(0);
}
