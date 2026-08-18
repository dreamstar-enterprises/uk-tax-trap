import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  LabelList,
} from 'recharts';
import './style.css';

const PA = 12570;
const START = 100000;
const END = 125140;
const BASIC = 37700;
const NI_PT = 12570;
const NI_UEL = 50270;

const money = n =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(Math.round(n));

const pct = n => `${Number(n).toFixed(1)}%`;

function taxCalc(income, pension = 0) {
  const ani = Math.max(0, income - pension);

  // Personal Allowance taper: £1 lost for every £2 earned above £100,000
  const lostAllowance = Math.min(PA, Math.max(0, (ani - START) / 2));
  const allowance = Math.max(0, PA - lostAllowance);

  // Taxable income is ANI minus available Personal Allowance
  const taxable = Math.max(0, ani - allowance);

  // 1. Basic Rate (20%): first £37,700 of taxable income
  const basic = Math.min(taxable, BASIC);
  const basicTax = basic * 0.20;

  // 2. Higher Rate (40%): taxable income between basic band and £125,140 total ANI
  const higher = Math.min(
    Math.max(0, taxable - basic),
    Math.max(0, END - allowance - BASIC)
  );
  const higherTax = higher * 0.40;

  // 3. Additional Rate (45%): ANI above £125,140
  const additional = Math.max(0, ani - END);
  const additionalTax = additional * 0.45;

  const incomeTax = basicTax + higherTax + additionalTax;
  const effectiveIncomeTaxRate = ani > 0 ? (incomeTax / ani) * 100 : 0;

  // National Insurance (Employee Class 1)
  // 0% on first £12,570 (Primary Threshold)
  const niFreePortion = Math.min(ani, NI_PT);

  // 8% on earnings between £12,570 and £50,270
  const niPrimaryPortion = Math.max(0, Math.min(ani, NI_UEL) - NI_PT);
  const niPrimaryTax = niPrimaryPortion * 0.08;

  // 2% on earnings above £50,270
  const niUpperPortion = Math.max(0, ani - NI_UEL);
  const niUpperTax = niUpperPortion * 0.02;

  const ni = niPrimaryTax + niUpperTax;
  const effectiveNiRate = ani > 0 ? (ni / ani) * 100 : 0;

  const takeHome = income - incomeTax - ni - pension;
  const effectiveTakeHomeRate = income > 0 ? (takeHome / income) * 100 : 0;

  // Marginal calculation for next £1
  const nextAni = ani + 1;
  const nextLostAllowance = Math.min(PA, Math.max(0, (nextAni - START) / 2));
  const nextAllowance = Math.max(0, PA - nextLostAllowance);
  const nextTaxable = Math.max(0, nextAni - nextAllowance);
  const nextBasic = Math.min(nextTaxable, BASIC);
  const nextHigher = Math.min(
    Math.max(0, nextTaxable - nextBasic),
    Math.max(0, END - nextAllowance - BASIC)
  );
  const nextAdditional = Math.max(0, nextAni - END);
  const nextTax = nextBasic * 0.20 + nextHigher * 0.40 + nextAdditional * 0.45;
  const nextNi =
    Math.max(0, Math.min(nextAni, NI_UEL) - NI_PT) * 0.08 +
    Math.max(0, nextAni - NI_UEL) * 0.02;

  const marginalIncomeTaxRate = Math.round((nextTax - incomeTax) * 100);
  const marginalNiRate = Math.round((nextNi - ni) * 100);
  const marginalTotalRate = marginalIncomeTaxRate + marginalNiRate;

  const isInTrap = ani >= START && ani < END;

  const totalTaxAndNi = incomeTax + ni;
  const effectiveTaxAndNiRate = income > 0 ? (totalTaxAndNi / income) * 100 : 0;
  const totalDeductions = totalTaxAndNi + pension;
  const effectiveTotalDeductionRate = income > 0 ? (totalDeductions / income) * 100 : 0;

  return {
    income,
    pension,
    ani,
    allowance,
    lostAllowance,
    taxable,
    basic,
    basicTax,
    higher,
    higherTax,
    additional,
    additionalTax,
    incomeTax,
    effectiveIncomeTaxRate,
    niFreePortion,
    niPrimaryPortion,
    niPrimaryTax,
    niUpperPortion,
    niUpperTax,
    ni,
    effectiveNiRate,
    totalTaxAndNi,
    effectiveTaxAndNiRate,
    totalDeductions,
    effectiveTotalDeductionRate,
    takeHome,
    effectiveTakeHomeRate,
    marginalIncomeTaxRate,
    marginalNiRate,
    marginalTotalRate,
    isInTrap,
  };
}

function App() {
  const [income, setIncome] = useState(120000);
  const [pension, setPension] = useState(0);
  const [view, setView] = useState('breakdown'); // 'breakdown' | 'bands' | 'marginal'

  const current = useMemo(() => taxCalc(income, pension), [income, pension]);
  const noPension = useMemo(() => taxCalc(income, 0), [income]);
  const to100 = Math.max(0, income - START);

  // Marginal deduction curve (£50k to £200k)
  const curve = useMemo(
    () =>
      Array.from({ length: 151 }, (_, i) => {
        const x = 50000 + i * 1000;
        const res = taxCalc(x, 0);
        return {
          income: x,
          marginal: Math.round(res.marginalTotalRate),
          marginalTax: Math.round(res.marginalIncomeTaxRate),
          marginalNi: Math.round(res.marginalNiRate),
        };
      }),
    []
  );

  // Overview Bars
  const bars = [
    { name: 'Income Tax', value: current.incomeTax, fill: '#3b82f6' },
    { name: 'Employee NI', value: current.ni, fill: '#06b6d4' },
    { name: 'Pension', value: pension, fill: '#8b5cf6' },
    { name: 'Take-Home', value: current.takeHome, fill: '#10b981' },
  ];

  // Tax Bands Breakdown Bar Data
  const bandBars = [
    {
      name: '0% Allowance',
      rate: '0%',
      incomePortion: current.allowance,
      taxAmount: 0,
    },
    {
      name: '20% Basic',
      rate: '20%',
      incomePortion: current.basic,
      taxAmount: current.basicTax,
    },
    {
      name: '40% Higher',
      rate: '40%',
      incomePortion: current.higher,
      taxAmount: current.higherTax,
    },
    {
      name: '45% Additional',
      rate: '45%',
      incomePortion: current.additional,
      taxAmount: current.additionalTax,
    },
  ].filter(b => b.incomePortion > 0);

  // Detailed Table Rows
  const taxBandDetails = [
    {
      name: 'Personal Allowance',
      rate: '0%',
      tagClass: 'tag-0',
      range: '£0 – £12,570',
      incomeInBand: current.allowance,
      taxPaid: 0,
      note:
        current.lostAllowance > 0
          ? `Tapered: lost ${money(current.lostAllowance)} (down to ${money(current.allowance)})`
          : 'Full allowance active',
      isActive: current.allowance > 0,
      isTrap: false,
    },
    {
      name: 'Basic Rate',
      rate: '20%',
      tagClass: 'tag-20',
      range: '£12,571 – £50,270',
      incomeInBand: current.basic,
      taxPaid: current.basicTax,
      note:
        current.basic >= BASIC
          ? `Full band reached (${money(BASIC)} capped at 20%)`
          : `${pct((current.basic / BASIC) * 100)} of band used`,
      isActive: current.basic > 0,
      isTrap: false,
    },
    {
      name: 'Higher Rate',
      rate: '40%',
      tagClass: current.isInTrap ? 'tag-60' : 'tag-40',
      range: '£50,271 – £125,140',
      incomeInBand: current.higher,
      taxPaid: current.higherTax,
      note: current.isInTrap
        ? `⚠️ £100k–£125.1k Trap: 40% income tax + 20% lost allowance = 60% effective marginal tax`
        : current.higher > 0
        ? 'Standard 40% higher rate band'
        : 'Not reached',
      isActive: current.higher > 0,
      isTrap: current.isInTrap,
    },
    {
      name: 'Additional Rate',
      rate: '45%',
      tagClass: 'tag-45',
      range: 'Over £125,140',
      incomeInBand: current.additional,
      taxPaid: current.additionalTax,
      note:
        current.additional > 0
          ? `45% applied on income above ${money(END)}`
          : 'Not reached',
      isActive: current.additional > 0,
      isTrap: false,
    },
  ];

  // Visual bar segments calculation for Income Tax card
  const totalAni = Math.max(1, current.ani);
  const seg0 = (current.allowance / totalAni) * 100;
  const seg20 = (current.basic / totalAni) * 100;
  const seg40 = (current.higher / totalAni) * 100;
  const seg45 = (current.additional / totalAni) * 100;

  // NI segments
  const segNi0 = (current.niFreePortion / totalAni) * 100;
  const segNi8 = (current.niPrimaryPortion / totalAni) * 100;
  const segNi2 = (current.niUpperPortion / totalAni) * 100;

  return (
    <div className="app">
      <header>
        <div className="eyebrow">2026/27 • England, Wales & Northern Ireland</div>
        <h1>
          The <span>£100k</span> Tax Trap Explorer
        </h1>
      </header>

      {/* Sliders */}
      <section className="controls card">
        <div className="control">
          <div className="control-label">
            <span>Gross annual income</span>
            <strong>{money(income)}</strong>
          </div>
          <input
            type="range"
            min="50000"
            max="200000"
            step="1000"
            value={income}
            onChange={e => setIncome(+e.target.value)}
          />
          <div className="ticks">
            <span>£50k</span>
            <span>£100k (Trap starts)</span>
            <span>£125,140 (PA ends)</span>
            <span>£200k</span>
          </div>
        </div>

        <div className="control">
          <div className="control-label">
            <span>Pension contribution</span>
            <strong>{money(pension)}</strong>
          </div>
          <input
            type="range"
            min="0"
            max={Math.max(1000, income)}
            step="500"
            value={pension}
            onChange={e => setPension(Math.min(+e.target.value, income))}
          />
          <div className="ticks">
            <span>£0</span>
            <span>{money(Math.round(income / 2))}</span>
            <span>{money(income)}</span>
          </div>
        </div>
      </section>

      {/* 6 Key Metric Cards */}
      <section className="heroGrid">
        {/* Adjusted Net Income */}
        <div className="metric card">
          <div className="metric-header">
            <small>Adjusted Net Income</small>
            <span className="badge">{pct((current.ani / (income || 1)) * 100)} of gross</span>
          </div>
          <b>{money(current.ani)}</b>
          <em>{pension > 0 ? `Reduced by ${money(pension)} pension` : 'Gross income minus pension'}</em>
        </div>

        {/* Personal Allowance */}
        <div className="metric card">
          <div className="metric-header">
            <small>Personal Allowance</small>
            <span
              className={`badge ${
                current.lostAllowance > 0 ? 'badge-warning' : 'badge-info'
              }`}
            >
              {current.lostAllowance > 0
                ? current.allowance === 0
                  ? '0% Allowance Lost'
                  : 'Tapering'
                : '100% Intact'}
            </span>
          </div>
          <b>{money(current.allowance)}</b>
          <em>
            {current.lostAllowance > 0
              ? `Lost ${money(current.lostAllowance)} (taper £1 per £2 over £100k)`
              : `Full £12,570 tax-free buffer`}
          </em>
        </div>

        {/* Income Tax Card with Enhanced Band Breakdown */}
        <div className="metric card income-tax-card">
          <div className="metric-header">
            <small>Income Tax</small>
            <span className="badge badge-info">
              {pct(current.effectiveIncomeTaxRate)} effective
            </span>
          </div>
          <b>{money(current.incomeTax)}</b>

          {/* Proportional visual bar across bands */}
          <div className="band-visual-bar" title="Proportion of income across 0%, 20%, 40%, 45% bands">
            <div className="band-segment seg-0" style={{ width: `${seg0}%` }} title={`0% Allowance: ${money(current.allowance)}`} />
            <div className="band-segment seg-20" style={{ width: `${seg20}%` }} title={`20% Basic: ${money(current.basic)}`} />
            <div className="band-segment seg-40" style={{ width: `${seg40}%` }} title={`40% Higher: ${money(current.higher)}`} />
            <div className="band-segment seg-45" style={{ width: `${seg45}%` }} title={`45% Additional: ${money(current.additional)}`} />
          </div>

          {/* Detailed band breakdown list inside card */}
          <div className="tax-bands-mini">
            <div className="band-row-head">
              <span>Band & Rate</span>
              <span>Taxed Pay</span>
              <span>Tax Paid</span>
            </div>

            <div className="band-row">
              <span className="band-label">
                <span className="dot dot-0" />
                0% Allowance
              </span>
              <span className="band-income">{money(current.allowance)}</span>
              <span className="band-tax">£0</span>
            </div>

            <div className="band-row">
              <span className="band-label">
                <span className="dot dot-20" />
                20% Basic
              </span>
              <span className="band-income">{money(current.basic)}</span>
              <span className="band-tax">{money(current.basicTax)}</span>
            </div>

            {current.higher > 0 && (
              <div className="band-row">
                <span className="band-label">
                  <span className="dot dot-40" />
                  40% Higher
                </span>
                <span className="band-income">{money(current.higher)}</span>
                <span className="band-tax">{money(current.higherTax)}</span>
              </div>
            )}

            {current.additional > 0 && (
              <div className="band-row">
                <span className="band-label">
                  <span className="dot dot-45" />
                  45% Additional
                </span>
                <span className="band-income">{money(current.additional)}</span>
                <span className="band-tax">{money(current.additionalTax)}</span>
              </div>
            )}
          </div>

          {current.isInTrap && (
            <div className="trap-callout">
              ⚠️ In 60% tax trap (£100k–£125.1k)
            </div>
          )}
        </div>

        {/* Employee National Insurance */}
        <div className="metric card">
          <div className="metric-header">
            <small>Employee NI</small>
            <span className="badge">{pct(current.effectiveNiRate)} effective</span>
          </div>
          <b>{money(current.ni)}</b>

          <div className="band-visual-bar" title="National Insurance breakdown">
            <div className="band-segment seg-0" style={{ width: `${segNi0}%` }} title={`0% Free: ${money(current.niFreePortion)}`} />
            <div className="band-segment seg-ni8" style={{ width: `${segNi8}%` }} title={`8% Primary: ${money(current.niPrimaryPortion)}`} />
            <div className="band-segment seg-ni2" style={{ width: `${segNi2}%` }} title={`2% Upper: ${money(current.niUpperPortion)}`} />
          </div>

          <div className="tax-bands-mini">
            <div className="band-row-head">
              <span>NI Band</span>
              <span>Pay in Band</span>
              <span>NI Paid</span>
            </div>
            <div className="band-row">
              <span className="band-label">
                <span className="dot dot-0" />
                0% Free (&lt;£12.5k)
              </span>
              <span className="band-income">{money(current.niFreePortion)}</span>
              <span className="band-tax">£0</span>
            </div>
            <div className="band-row">
              <span className="band-label">
                <span className="dot dot-ni8" />
                8% (£12.5k–£50.2k)
              </span>
              <span className="band-income">{money(current.niPrimaryPortion)}</span>
              <span className="band-tax">{money(current.niPrimaryTax)}</span>
            </div>
            {current.niUpperPortion > 0 && (
              <div className="band-row">
                <span className="band-label">
                  <span className="dot dot-ni2" />
                  2% (&gt;£50.2k)
                </span>
                <span className="band-income">{money(current.niUpperPortion)}</span>
                <span className="band-tax">{money(current.niUpperTax)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Take-Home Pay (Highlight Card) */}
        <div className="metric highlight card">
          <div className="metric-header">
            <small>Take-Home Cash</small>
            <div className="badge-group">
              <span className="badge">
                {pct(current.effectiveTakeHomeRate)} of income
              </span>
              <span className="badge badge-deduction" title={`Total Tax + NI: ${money(current.totalTaxAndNi)}`}>
                Tax + NI: {pct(current.effectiveTaxAndNiRate)}
              </span>
            </div>
          </div>
          <b>{money(current.takeHome)}</b>
          <em>
            Net monthly pay: {money(current.takeHome / 12)} / mo • Total deductions: {money(current.totalTaxAndNi)}
          </em>
        </div>

        {/* Marginal Rate Card */}
        <div className="metric card">
          <div className="metric-header">
            <small>Marginal Rate (Next £1)</small>
            <span
              className={`badge ${
                current.marginalTotalRate >= 60 ? 'badge-warning' : 'badge-info'
              }`}
            >
              {current.marginalTotalRate >= 60 ? '60%+ Trap' : 'Standard'}
            </span>
          </div>
          <b style={{ color: current.marginalTotalRate >= 60 ? '#dc2626' : 'inherit' }}>
            {pct(current.marginalTotalRate)}
          </b>
          <em>
            {current.marginalIncomeTaxRate}% Income Tax + {current.marginalNiRate}% NI
          </em>
        </div>
      </section>

      {/* Visual Charts Card */}
      <section className="card chartCard">
        <div className="chartHead">
          <div>
            <h2>Tax & Income Visualizer</h2>
            <p>Compare deductions, examine tax band breakdown, or view the 60% trap curve.</p>
          </div>
          <div className="switch">
            <button
              className={view === 'breakdown' ? 'on' : ''}
              onClick={() => setView('breakdown')}
            >
              Overall Breakdown
            </button>
            <button
              className={view === 'bands' ? 'on' : ''}
              onClick={() => setView('bands')}
            >
              Tax Bands Split
            </button>
            <button
              className={view === 'marginal' ? 'on' : ''}
              onClick={() => setView('marginal')}
            >
              Marginal Rate Curve
            </button>
          </div>
        </div>

        {view === 'marginal' && (
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={curve} margin={{ top: 30, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="income" tickFormatter={v => `£${v / 1000}k`} />
              <YAxis tickFormatter={v => `${v}%`} domain={[0, 75]} />
              <Tooltip
                formatter={(v, name) => [`${v}%`, name]}
                labelFormatter={v => `Gross Income: ${money(v)}`}
              />
              <Legend verticalAlign="top" height={36} />
              <ReferenceLine
                x={100000}
                stroke="#dc2626"
                strokeDasharray="4 4"
                label={{
                  value: '£100k Trap Start',
                  fill: '#dc2626',
                  position: 'top',
                  fontSize: 11,
                  fontWeight: 700,
                  dy: -4,
                }}
              />
              <ReferenceLine
                x={125140}
                stroke="#dc2626"
                strokeDasharray="4 4"
                label={{
                  value: '£125,140 PA Gone',
                  fill: '#dc2626',
                  position: 'top',
                  fontSize: 11,
                  fontWeight: 700,
                  dy: -4,
                }}
              />
              <Line
                type="monotone"
                dataKey="marginal"
                name="Total Marginal Deduction (Tax + NI)"
                stroke="#d9532f"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="marginalTax"
                name="Marginal Income Tax"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {view === 'bands' && (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={bandBars} margin={{ top: 25, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={money} />
              <Tooltip
                formatter={(v, name) => [money(v), name]}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="incomePortion" name="Income in Band" fill="#94a3b8" radius={[6, 6, 0, 0]}>
                <LabelList
                  dataKey="incomePortion"
                  position="top"
                  formatter={v => (v > 0 ? money(v) : '')}
                  fill="#475569"
                  fontSize={11}
                  fontWeight={700}
                  offset={6}
                />
              </Bar>
              <Bar dataKey="taxAmount" name="Tax Paid" fill="#d9532f" radius={[6, 6, 0, 0]}>
                <LabelList
                  dataKey="taxAmount"
                  position="top"
                  formatter={v => (v > 0 ? money(v) : '£0')}
                  fill="#b91c1c"
                  fontSize={11}
                  fontWeight={700}
                  offset={6}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {view === 'breakdown' && (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={bars} margin={{ top: 25, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={money} />
              <Tooltip formatter={v => money(v)} />
              <Bar dataKey="value" name="Amount" radius={[8, 8, 0, 0]}>
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={v => (v > 0 ? money(v) : '')}
                  fill="#334155"
                  fontSize={12}
                  fontWeight={700}
                  offset={8}
                />
                {bars.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Detailed Tax Bands Table */}
      <section className="card details-section">
        <h2>Income Tax Bands Breakdown</h2>
        <p>
          Exact breakdown of how every pound of your {money(current.ani)} adjusted net income is taxed across UK bands.
        </p>

        <div className="bands-table-container">
          <table className="bands-table">
            <thead>
              <tr>
                <th>Band</th>
                <th>Rate</th>
                <th>Threshold Range</th>
                <th>Income Taxed in Band</th>
                <th>Tax Calculated</th>
                <th>Status / Notes</th>
              </tr>
            </thead>
            <tbody>
              {taxBandDetails.map((b, i) => (
                <tr
                  key={i}
                  className={`${b.isActive ? 'active-row' : ''} ${b.isTrap ? 'trap-row' : ''}`}
                >
                  <td>
                    <strong>{b.name}</strong>
                  </td>
                  <td>
                    <span className={`tag-rate ${b.tagClass}`}>{b.rate}</span>
                  </td>
                  <td>{b.range}</td>
                  <td>
                    <strong>{money(b.incomeInBand)}</strong>
                  </td>
                  <td>
                    <strong>{money(b.taxPaid)}</strong>
                  </td>
                  <td>{b.note}</td>
                </tr>
              ))}
              <tr className="summary-row">
                <td colSpan={3}>
                  <strong>Total Income Tax Liability</strong>
                </td>
                <td>
                  <strong>{money(current.taxable)} (Taxable)</strong>
                </td>
                <td>
                  <strong style={{ color: '#d9532f' }}>{money(current.incomeTax)}</strong>
                </td>
                <td>
                  <strong>{pct(current.effectiveIncomeTaxRate)} effective income tax rate</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Pension Optimization Comparison */}
      <section className="compare card">
        <div>
          <h2>What if you pensioned down to £100k?</h2>
          <p>
            If your income is above £100,000, contributing into a pension reduces your Adjusted Net Income, restores your Personal Allowance, and avoids the 60% tax trap.
          </p>
        </div>
        <div className="compareGrid">
          <div>
            <small>Suggested contribution</small>
            <strong>{money(to100)}</strong>
          </div>
          <div>
            <small>Personal Allowance today</small>
            <strong>{money(noPension.allowance)}</strong>
          </div>
          <div className="success-box">
            <small>Personal Allowance at £100k</small>
            <strong>{money(PA)}</strong>
          </div>
          <div>
            <small>Take-home after pensioning to £100k</small>
            <strong>{money(taxCalc(income, to100).takeHome)}</strong>
          </div>
        </div>
      </section>

      <footer>
        Illustrative PAYE calculation for 2026/27 tax year. Applicable to England, Wales & Northern Ireland.
        Excludes student loan deductions, marriage allowance, child benefit tax charge (HICBC), dividends, savings income, and Scottish income tax bands. Not financial advice.
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
