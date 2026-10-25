// Built-in messy sample dataset. Every case from SPEC section 20 appears here at least once;
// the comment on each row says which. Values are deliberately inconsistent in format.

import { EXISTING_STORES_DEFAULT } from './config';
import type { EngineInput, RawApplication, RawTerritory } from './engine/types';

const row = (
  rowNumber: number,
  applicationId: unknown,
  applicantName: unknown,
  city: unknown,
  state: unknown,
  pin: unknown,
  investment: unknown,
  experience: unknown,
  business: unknown,
  spaceAvailable: unknown,
  spaceSize: unknown,
  floor: unknown,
  targetLaunch: unknown,
  language: unknown,
  notes: unknown,
): RawApplication => ({ rowNumber, applicationId, applicantName, city, state, pin, investment, experience, business, spaceAvailable, spaceSize, floor, targetLaunch, language, notes });

export const SAMPLE_APPLICATIONS: RawApplication[] = [
  // Strong Bengaluru applicant; wins pin 560010 (case 1)
  row(4, 'APP-001', 'Shreyas Hegde', 'Bengaluru', 'Karnataka', '560010', 45, 6, 'Runs two mobile accessories shops in Jayanagar', 'Rented', 450, 'Ground', 3, 'Kannada', ''),
  // Same pin as APP-001, lower score -> waitlisted naming APP-001 (case 1); pin with spaces (case 19)
  row(5, 'APP-002', 'Farah Khan', 'Bangalore', 'Karnataka', ' 560 010 ', '34 lakh', '3 yrs', 'Garment shop owner', 'rent', '380 sq ft', 'Upper', 4, 'Hindi', 'Can also consider other areas of Bengaluru'),
  // Pin with an existing store (ST-02) -> rejected with redirect (case 2)
  row(6, 'APP-003', 'Manjunath Gowda', 'Bengaluru', 'Karnataka', 560034, 40, 5, 'Footwear retail for 5 years', 'Owned', 500, 'Ground', 3, 'Kannada', ''),
  // Tumakuru has no territory -> rejected (case 3)
  row(7, 'APP-004', 'Lakshmi Narayan', 'Tumakuru', 'Karnataka', '572101', 15, 4, 'Kirana store owner', 'Owned', 300, 'GF', 4, 'kannada', ''),
  // Stated Mysuru but pin is a Bengaluru pin -> hold, ask to confirm (case 4)
  row(8, 'APP-005', 'Arjun Rao', 'Mysuru', 'Karnataka', '560011', 32, 3, 'Electronics showroom manager', 'Rented', 350, 'Ground', 3, 'English', ''),
  // Rented with blank size -> hold (case 5); pin as "570001.0" text (case 19)
  row(9, 'APP-006', 'Kavya Shetty', 'Mysuru', 'Karnataka', '570001.0', 24, 2, 'Cosmetics counter at a mall', 'Rented', '', 'Mall unit', 4, 'Kannada', ''),
  // "Not yet identified" but a size filled in -> treated as no space, warning; on hold (case 6)
  row(10, 'APP-007', 'Prakash Joshi', 'Mysuru', 'Karnataka', '570002', 28, 4, 'Runs a pharmacy', 'Not yet identified', 300, '', 6, 'Kannada', ''),
  // Target launch 1 month with no space -> unrealistic flag + hold (case 8)
  row(11, 'APP-008', 'Deepa Kulkarni', 'Mysuru', 'Karnataka', 570008, 26, 4, 'Apparel boutique', 'Not yet identified', '', '', 1, 'English', 'Need to open quickly'),
  // "Before Diwali" with target 3 months -> conflict flag, conditional approval (case 9)
  row(12, 'APP-009', "Rohan D'Souza", 'Mangaluru', 'Karnataka', '575002', 25, 3, 'Mobile repair and accessories shop', 'Rented', 320, 'Ground', 3, 'English', 'Want to open before Diwali'),
  // Tier 3 city with Tier 1 money: checked against the Tier 3 minimum (case 10); outside territories but flexible -> redirects
  row(13, 'APP-010', 'Basavaraj Patil', 'Davanagere', 'Karnataka', '577001', 50, 8, 'Wholesale textile distributor', 'Owned', 600, 'Ground', 5, 'Kannada', 'Open to any city where you need a partner'),
  // Capital shortfall of 10% -> hold (case 11)
  row(14, 'APP-011', 'Sneha Kamath', 'Belagavi', 'Karnataka', '590010', '₹18 lakh', 3, 'Runs a stationery and gift shop', 'Rented', 300, 'Ground', 4, 'Kannada', ''),
  // No space -> hold; follow-up "found a ground-floor space of 400 sq ft" flips it to approved (case 7)
  row(15, 'APP-012', 'Imran Sheikh', 'Bengaluru', 'Karnataka', '560103', 38, 4, 'Electronics store supervisor', 'Not yet identified', '', '', 5, 'Hindi', 'Looking at shops on the main road'),
  // Capital shortfall of 60% -> rejected (case 11)
  row(16, 'APP-013', 'Ganesh Naik', 'Belagavi', 'Karnataka', '590006', 8, 2, 'Tea stall', 'Rented', 220, 'Ground', 3, 'Kannada', ''),
  // Territory with 0 open slots -> waitlist with redirects (case 12)
  row(17, 'APP-014', 'Vinay Hiremath', 'Hubballi-Dharwad', 'Karnataka', '580021', 30, 5, 'Runs an optical store', 'Rented', 400, 'Ground', 3, 'Kannada', 'Flexible - open to Belagavi or Mysuru too'),
  // TER-02: 2 slots but only 1 free pin -> capacity 1 (case 13); pin as a number (case 19)
  row(18, 'APP-015', 'Anitha Reddy', 'Bengaluru', 'Karnataka', 560078, 42, 7, 'Franchise owner of a bakery chain outlet', 'Owned', 650, 'Ground', 3, 'English', ''),
  row(19, 'APP-016', 'Suresh Babu', 'Bengaluru', 'Karnataka', '560011', 36, 5, 'Runs a footwear shop in Malleshwaram', 'Rented', 420, 'Ground', 2, 'Kannada', ''),
  // Competes with APP-015 for the only free pin in TER-02
  row(20, 'APP-017', 'Meena Iyer', 'Bengaluru', 'Karnataka', '560078', 31, 3, 'Saree shop', 'Rented', 300, 'Ground', 4, 'English', ''),
  // Duplicate Application ID (case 14)
  row(21, 'APP-017', 'Rahul Verma', 'Mangaluru', 'Karnataka', '575003', 22, 2, 'Sales job at a mobile store', 'Rented', 260, 'Ground', 4, 'Hindi', ''),
  // Same person under two IDs (case 14)
  row(22, 'APP-018', 'Suma Bhat', 'Mangaluru', 'Karnataka', '575006', 23, 3, 'Ladies garments shop', 'Rented', 280, 'Upper', 4, 'Kannada', ''),
  row(23, 'APP-019', 'Suma  Bhat', 'Mangalore', 'Karnataka', '575006', 23, 3, 'Ladies garments shop', 'Rented', 280, 'Upper floor', 4, 'Kannada', 'Applying again in case the first form was lost'),
  // Zero experience, low-relevance background, hires a manager -> below the bar (case 15)
  row(24, 'APP-020', 'Nikhil Jain', 'Mysuru', 'Karnataka', '570020', 21, 0, 'Software engineer, no retail background', 'Rented', 210, 'Upper', 1, 'English', 'Will hire a manager to run the store; side investment'),
  // Near miss: score just under the bar -> hold with a fix
  row(25, 'APP-021', 'Kiran Desai', 'Mysuru', 'Karnataka', '570020', 20, '6 months', 'Works in a cafe', 'Rented', 210, 'Not known', 3, 'Hindi', 'Part-time initially'),
  // State is not Karnataka -> hold
  row(26, 'APP-022', 'Harish Menon', 'Mangaluru', 'Kerala', '575003', 30, 4, 'Runs a supermarket', 'Rented', 400, 'Ground', 3, 'English', ''),
  // Impossible value -> hold
  row(27, 'APP-023', 'Divya Prasad', 'Belagavi', 'Karnataka', '590016', -5, 3, 'Mobile accessories kiosk', 'Rented', 250, 'Ground', 4, 'Kannada', ''),
  // Experience 0 but the text says 8 years -> conditional approval; 0 years -> extended training (cases 15 and note conflict)
  row(28, 'APP-024', 'Shilpa Angadi', 'Belagavi', 'Karnataka', '590006', 22, 0, 'Running my saree shop for 8 years from home', 'own', 240, 'ground floor', 4, 'Kannada', ''),
  // Strong but at risk: part-time and loan pending -> approved, high drop-off risk
  row(29, 'APP-025', 'Mohan Shetty', 'Mysuru', 'Karnataka', '570008', 35, 6, 'Ran a kirana store for 6 years; now part-time while working at a bank', 'Rented', 350, 'Ground', 3, 'Kannada', 'Loan pending with the bank for part of the investment'),
  row(30, 'APP-026', 'Chaitra Murthy', 'Bengaluru', 'Karnataka', '560102', 55, 9, 'Owns an eyewear store', 'Owned', 700, 'Ground', 3, 'Kannada', ''),
  // Third applicant on pin 560010 (waitlist depth for the withdrawal demo)
  row(31, 'APP-027', 'Ramesh Pai', 'Bengaluru', 'Karnataka', '560010', 31, 2, 'Distributor for FMCG goods', 'Rented', 260, 'Upper', 4, 'English', ''),
  // Fully blank row (skipped)
  row(32, '', '', '', '', '', '', '', '', '', '', '', '', '', ''),
  // Missing name and unreadable investment -> hold
  row(33, 'APP-028', '', 'Belagavi', 'Karnataka', '590010', 'twenty lakh', 2, 'Clothing store', 'Rented', 300, 'Ground', 4, 'Kannada', ''),
];

export const SAMPLE_TERRITORIES: RawTerritory[] = [
  { rowNumber: 4, territoryId: 'TER-01', city: 'Bengaluru', state: 'Karnataka', pins: '560001, 560034, 560010, 560011, 560102, 560103', tier: 'Tier 1', openSlots: 4, priority: 'High' },
  // 2 slots but two of three pins already have stores (case 13)
  { rowNumber: 5, territoryId: 'TER-02', city: 'Bengaluru', state: 'Karnataka', pins: '560066,560076, 560078', tier: 'Tier 1', openSlots: 2, priority: 'Medium' },
  { rowNumber: 6, territoryId: 'TER-03', city: 'Mysuru', state: 'Karnataka', pins: '570001, 570002, 570008, 570009', tier: 'Tier 2', openSlots: 2, priority: 'High' },
  { rowNumber: 7, territoryId: 'TER-04', city: 'Mangaluru', state: 'Karnataka', pins: '575002, 575003, 575006', tier: 'Tier 2', openSlots: 1, priority: 'Medium' },
  // 0 open slots (case 12)
  { rowNumber: 8, territoryId: 'TER-05', city: 'Hubballi-Dharwad', state: 'Karnataka', pins: '580020, 580021, 580023', tier: 'Tier 2', openSlots: 0, priority: 'Low' },
  { rowNumber: 9, territoryId: 'TER-06', city: 'Belagavi', state: 'Karnataka', pins: '590006, 590010, 590016', tier: 'Tier 2', openSlots: 2, priority: 'High' },
  // 570002 also listed in TER-03 -> overlap flagged, assigned to TER-03
  { rowNumber: 10, territoryId: 'TER-07', city: 'Mysuru', state: 'Karnataka', pins: '570017, 570020, 570002', tier: 'tier 2', openSlots: 1, priority: 'Low' },
];

export function sampleInput(): EngineInput {
  return {
    applications: SAMPLE_APPLICATIONS.map((r) => ({ ...r })),
    territories: SAMPLE_TERRITORIES.map((t) => ({ ...t })),
    existingStores: EXISTING_STORES_DEFAULT.map((s) => ({ ...s })),
    events: [],
    source: 'Built-in sample data',
  };
}
