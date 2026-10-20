#!/usr/bin/env node
import process from 'node:process';

const PROJECT = 'gen-lang-client-0982077967';
const DATABASE = 'emprovex-warehouse';
const WORKSPACE = 'hgesm-aprov';
const DEFAULT_MATERIAL = 'mat_272f2d996ee65ed3530ad2d7e27b66d7';
const CAP = 200;

const token = String(process.env.WAREHOUSE_AUDIT_ACCESS_TOKEN || '').trim();
const material = String(process.argv.find((x) => x.startsWith('--material='))?.slice(11) || DEFAULT_MATERIAL).trim();
if (!token) throw new Error('WAREHOUSE_AUDIT_ACCESS_TOKEN_REQUIRED');
if (!/^mat_[a-f0-9]{32}$/.test(material)) throw new Error('MATERIAL_ID_INVALID');

const root = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents/warehouse/${WORKSPACE}`;
let httpRequests = 0;
let documentReads = 0;

async function getJson(url) {
  httpRequests += 1;
  const response = await fetch(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`READ_FAILED_${response.status}`);
  return response.json();
}

function stringField(doc, key) {
  return doc?.fields?.[key]?.stringValue ?? null;
}

async function exact(collection, id) {
  const doc = await getJson(`${root}/${collection}/${encodeURIComponent(id)}`);
  if (doc) documentReads += 1;
  return doc;
}

async function listForMaterial(collection) {
  const payload = await getJson(`${root}/${collection}?pageSize=${CAP}`);
  const docs = payload?.documents || [];
  documentReads += docs.length;
  return {
    capped: Boolean(payload?.nextPageToken),
    observed: docs.length,
    matches: docs.filter((doc) => stringField(doc, 'materialId') === material),
  };
}

const [materialDoc, balanceDoc, locationBalances, lots, barcodes] = await Promise.all([
  exact('materials', material),
  exact('balances', material),
  listForMaterial('locationBalances'),
  listForMaterial('lots'),
  listForMaterial('barcodes'),
]);

console.log(JSON.stringify({
  identity: { project: PROJECT, database: DATABASE, workspace: WORKSPACE, material },
  guard: { mode: 'GET_ONLYIËØ\\“\İYÛÛXİ[ÛˆĞTKˆÛİ[ÎˆÈ™\]Y\İËØİ[Y[™XYÈKˆØ\YÛÛXİ[ÛœÎˆÉÛØØ][Û˜[[˜Ù\ÉË	ÛİÉË	Ø˜\˜ÛÙ\É×K™š[\Š
˜[YJHOˆ
ÈØØ][Û˜[[˜Ù\ËİË˜\˜ÛÙ\ÈJVÛ˜[YWK˜Ø\Y
KˆX]\šX[ˆX]\šX[ØËˆ˜[[˜ÙNˆ˜[[˜ÙQØËˆØØ][Û˜[[˜Ù\ÎˆØØ][Û˜[[˜Ù\Ë›X]Ú\ËˆİÎˆİË›X]Ú\Ëˆ˜\˜ÛÙ\Îˆ˜\˜ÛÙ\Ë›X]Ú\ËŸK[ŠJNÂ