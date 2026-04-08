import 'dotenv/config';
import { directPrisma } from '../prisma';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ service: 'metals-dev' });

const METALS_DEV_API_KEY = process.env.METALS_DEV_API_KEY;
const METALS_DEV_BASE_URL = 'https://api.metals.dev/v1';

const OZ_TO_G = 31.1035;

interface MetalsDevLatestResponse {
  status: string;
  metals: {
    // Spot prices (USD/oz unless currency=INR)
    gold?: number;
    silver?: number;
    platinum?: number;
    palladium?: number;
    // LBMA official fixes
    lbma_gold_am?: number;
    lbma_gold_pm?: number;
    lbma_silver?: number;
    lbma_platinum_am?: number;
    lbma_platinum_pm?: number;
    lbma_palladium_am?: number;
    lbma_palladium_pm?: number;
    // MCX India prices
    mcx_gold?: number;
    mcx_gold_am?: number;
    mcx_gold_pm?: number;
    mcx_silver?: number;
    mcx_silver_am?: number;
    mcx_silver_pm?: number;
    // IBJA India
    ibja_gold?: number;
    // Industrial metals
    copper?: number;
    lme_copper?: number;
    aluminum?: number;
    lme_aluminum?: number;
    lead?: number;
    lme_lead?: number;
    nickel?: number;
    lme_nickel?: number;
    zinc?: number;
    lme_zinc?: number;
  };
  timestamps?: {
    metal?: string;
    currency?: string;
  };
}

interface MetalsDevSpotResponse {
  status: string;
  timestamp: string;
  currency: string;
  unit: string;
  metal: string;
  rate: {
    price: number;
    ask: number;
    bid: number;
    high: number;
    low: number;
    change: number;
    change_percent: number;
  };
}

export interface MetalPrices {
  gold: {
    // MCX India session prices (INR/oz)
    mcx: number;
    mcxAm: number;
    mcxPm: number;
    // Derived INR units
    pricePer10g: number;
    pricePerKg: number;
    // Intraday (from Spot endpoint, USD)
    ask: number;
    bid: number;
    dayHigh: number;
    dayLow: number;
    change: number;
    changePercent: number;
  };
  silver: {
    // MCX India session prices (INR/oz)
    mcx: number;
    mcxAm: number;
    mcxPm: number;
    // Derived INR units
    pricePer10g: number;
    pricePerKg: number;
    // Intraday (from Spot endpoint, USD)
    ask: number;
    bid: number;
    dayHigh: number;
    dayLow: number;
    change: number;
    changePercent: number;
  };
  timestamp: string;
}

async function fetchSpotData(metal: 'gold' | 'silver'): Promise<MetalsDevSpotResponse['rate'] | null> {
  if (!METALS_DEV_API_KEY) return null;
  try {
    const url = `${METALS_DEV_BASE_URL}/metal/spot?api_key=${METALS_DEV_API_KEY}&metal=${metal}&currency=USD`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) return null;
    const data: MetalsDevSpotResponse = await res.json();
    return data.status === 'success' ? data.rate : null;
  } catch {
    return null;
  }
}

export async function fetchMetalPrices(): Promise<MetalPrices | null> {
  if (!METALS_DEV_API_KEY) {
    logger.error('METALS_DEV_API_KEY not configured');
    return null;
  }

  try {
    // Fetch latest rates (INR) + spot intraday data (USD) in parallel
    const [latestRes, goldSpot, silverSpot] = await Promise.all([
      fetch(`${METALS_DEV_BASE_URL}/latest?api_key=${METALS_DEV_API_KEY}&currency=INR&unit=toz`, {
        headers: { 'Content-Type': 'application/json' },
      }),
      fetchSpotData('gold'),
      fetchSpotData('silver'),
    ]);

    if (!latestRes.ok) {
      logger.error({ status: latestRes.status }, 'Metals.Dev latest API error');
      return null;
    }

    const data: MetalsDevLatestResponse = await latestRes.json();

    if (data.status !== 'success' || !data.metals) {
      logger.error({ data }, 'Metals.Dev invalid response');
      return null;
    }

    const m = data.metals;
    const timestamp = data.timestamps?.metal || new Date().toISOString();

    return {
      gold: {
        mcx: m.mcx_gold || 0,
        mcxAm: m.mcx_gold_am || 0,
        mcxPm: m.mcx_gold_pm || 0,
        pricePer10g: (m.mcx_gold || 0) / OZ_TO_G * 10,
        pricePerKg: (m.mcx_gold || 0) / OZ_TO_G * 1000,
        ask: goldSpot?.ask || 0,
        bid: goldSpot?.bid || 0,
        dayHigh: goldSpot?.high || 0,
        dayLow: goldSpot?.low || 0,
        change: goldSpot?.change || 0,
        changePercent: goldSpot?.change_percent || 0,
      },
      silver: {
        mcx: m.mcx_silver || 0,
        mcxAm: m.mcx_silver_am || 0,
        mcxPm: m.mcx_silver_pm || 0,
        pricePer10g: (m.mcx_silver || 0) / OZ_TO_G * 10,
        pricePerKg: (m.mcx_silver || 0) / OZ_TO_G * 1000,
        ask: silverSpot?.ask || 0,
        bid: silverSpot?.bid || 0,
        dayHigh: silverSpot?.high || 0,
        dayLow: silverSpot?.low || 0,
        change: silverSpot?.change || 0,
        changePercent: silverSpot?.change_percent || 0,
      },
      timestamp,
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch metal prices');
    return null;
  }
}

export async function syncCommodityPrices(): Promise<{ success: boolean; updated: number }> {
  const prices = await fetchMetalPrices();
  if (!prices) {
    return { success: false, updated: 0 };
  }

  const prisma = directPrisma;
  let updated = 0;

  // ── 1. Update GC=F / SI=F metadata (USD COMEX futures) ──────────────────
  const comexAssets = await prisma.asset.findMany({
    where: { symbol: { in: ['GC=F', 'SI=F'] } },
    select: { id: true, symbol: true, metadata: true },
  });

  for (const asset of comexAssets) {
    const existingMeta = (asset.metadata as Record<string, unknown>) || {};
    let metaPatch: Record<string, unknown> = {};
    const topLevelPatch: Record<string, unknown> = {};

    if (asset.symbol === 'GC=F') {
      const g = prices.gold;
      metaPatch = {
        mcxPricePerOz: g.mcx,
        mcxGoldAm: g.mcxAm,
        mcxGoldPm: g.mcxPm,
        mcxPricePer10g: g.pricePer10g,
        mcxPricePerKg: g.pricePerKg,
        spotAsk: g.ask,
        spotBid: g.bid,
        dayHigh: g.dayHigh,
        dayLow: g.dayLow,
        dayChange: g.change,
        dayChangePercent: g.changePercent,
        priceSource: 'metals.dev',
        lastMetalUpdate: prices.timestamp,
      };
      if (g.changePercent) topLevelPatch.changePercent = g.changePercent;
    }

    if (asset.symbol === 'SI=F') {
      const s = prices.silver;
      metaPatch = {
        mcxPricePerOz: s.mcx,
        mcxSilverAm: s.mcxAm,
        mcxSilverPm: s.mcxPm,
        mcxPricePer10g: s.pricePer10g,
        mcxPricePerKg: s.pricePerKg,
        spotAsk: s.ask,
        spotBid: s.bid,
        dayHigh: s.dayHigh,
        dayLow: s.dayLow,
        dayChange: s.change,
        dayChangePercent: s.changePercent,
        priceSource: 'metals.dev',
        lastMetalUpdate: prices.timestamp,
      };
      if (s.changePercent) topLevelPatch.changePercent = s.changePercent;
    }

    if (Object.keys(metaPatch).length === 0) continue;

    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        metadata: { ...existingMeta, ...metaPatch },
        ...topLevelPatch,
      } as never,
    });

    updated++;
    logger.info({ symbol: asset.symbol }, 'Updated COMEX commodity metadata from Metals.Dev');
  }

  // ── 2. Upsert GOLD-MCX / SILVER-MCX (IN region, INR-priced) ─────────────
  // These are standalone Indian commodity assets priced in INR per 10g (gold)
  // and INR per kg (silver), matching MCX India quotation standards.
  const inAssets: Array<{
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
    meta: Record<string, unknown>;
    description: string;
    contractUnit: string;
  }> = [];

  const g = prices.gold;
  if (g.pricePer10g > 0) {
    inAssets.push({
      symbol: 'GOLD-MCX',
      name: 'Gold (MCX India)',
      price: g.pricePer10g,           // INR per 10g — MCX standard quotation
      changePercent: g.changePercent,
      description: 'Gold futures traded on MCX India. Quoted in INR per 10 grams. 1 lot = 100g. Tracks COMEX gold with USD/INR conversion.',
      contractUnit: '100g (1 lot)',
      meta: {
        mcxPricePerOz: g.mcx,
        mcxGoldAm: g.mcxAm,
        mcxGoldPm: g.mcxPm,
        mcxPricePer10g: g.pricePer10g,
        mcxPricePerKg: g.pricePerKg,
        spotAsk: g.ask,
        spotBid: g.bid,
        dayHigh: g.dayHigh,
        dayLow: g.dayLow,
        dayChange: g.change,
        dayChangePercent: g.changePercent,
        exchangeName: 'MCX',
        commodityClass: 'Metal',
        priceSource: 'metals.dev',
        lastMetalUpdate: prices.timestamp,
        contractUnit: '100g (1 lot)',
        quotation: 'INR per 10g',
        linkedSymbol: 'GC=F',
      },
    });
  }

  const s = prices.silver;
  if (s.pricePerKg > 0) {
    inAssets.push({
      symbol: 'SILVER-MCX',
      name: 'Silver (MCX India)',
      price: s.pricePerKg,            // INR per kg — MCX standard quotation
      changePercent: s.changePercent,
      description: 'Silver futures traded on MCX India. Quoted in INR per kg. 1 lot = 30kg. Tracks COMEX silver with USD/INR conversion.',
      contractUnit: '30kg (1 lot)',
      meta: {
        mcxPricePerOz: s.mcx,
        mcxSilverAm: s.mcxAm,
        mcxSilverPm: s.mcxPm,
        mcxPricePer10g: s.pricePer10g,
        mcxPricePerKg: s.pricePerKg,
        spotAsk: s.ask,
        spotBid: s.bid,
        dayHigh: s.dayHigh,
        dayLow: s.dayLow,
        dayChange: s.change,
        dayChangePercent: s.changePercent,
        exchangeName: 'MCX',
        commodityClass: 'Metal',
        priceSource: 'metals.dev',
        lastMetalUpdate: prices.timestamp,
        contractUnit: '30kg (1 lot)',
        quotation: 'INR per kg',
        linkedSymbol: 'SI=F',
      },
    });
  }

  for (const asset of inAssets) {
    const upserted = await prisma.asset.upsert({
      where: { symbol: asset.symbol },
      update: {
        price: asset.price,
        changePercent: asset.changePercent || null,
        lastPriceUpdate: new Date(),
        metadata: asset.meta as never,
        description: asset.description,
      },
      create: {
        symbol: asset.symbol,
        name: asset.name,
        type: 'COMMODITY',
        region: 'IN',
        currency: 'INR',
        sector: 'Commodities',
        industry: 'Precious Metals',
        description: asset.description,
        price: asset.price,
        changePercent: asset.changePercent || null,
        lastPriceUpdate: new Date(),
        metadata: asset.meta as never,
      },
      select: { id: true },
    });

    // Write today's price history point so the chart has data
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const dayHighInr = asset.symbol === 'GOLD-MCX'
      ? Number(asset.meta.mcxPricePer10g) * (1 + Math.abs(Number(asset.meta.dayChangePercent) / 100))
      : Number(asset.meta.mcxPricePerKg) * (1 + Math.abs(Number(asset.meta.dayChangePercent) / 100));
    const dayLowInr = asset.symbol === 'GOLD-MCX'
      ? Number(asset.meta.mcxPricePer10g) * (1 - Math.abs(Number(asset.meta.dayChangePercent) / 100))
      : Number(asset.meta.mcxPricePerKg) * (1 - Math.abs(Number(asset.meta.dayChangePercent) / 100));

    await prisma.priceHistory.upsert({
      where: { assetId_date: { assetId: upserted.id, date: today } },
      update: {
        close: asset.price,
        open: dayLowInr > 0 ? dayLowInr : asset.price,
        high: dayHighInr > 0 ? dayHighInr : asset.price,
        low: dayLowInr > 0 ? dayLowInr : asset.price,
      },
      create: {
        assetId: upserted.id,
        date: today,
        close: asset.price,
        open: dayLowInr > 0 ? dayLowInr : asset.price,
        high: dayHighInr > 0 ? dayHighInr : asset.price,
        low: dayLowInr > 0 ? dayLowInr : asset.price,
        volume: 0,
      },
    });

    updated++;
    logger.info({ symbol: asset.symbol, price: asset.price }, 'Upserted IN commodity asset from Metals.Dev');
  }

  logger.info({ updated }, 'Commodity price sync complete');
  return { success: true, updated };
}
