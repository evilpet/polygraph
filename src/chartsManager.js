import * as echarts from 'echarts';
import { escapeHtml } from './htmlEscape.js';

export class ChartsManager {
  constructor() {
    this.networkGrowthChart = null;
    this.stiRiskChart = null;
    this.longitudinalChart = null;
    this.topologyRadarChart = null;
    this.optimizerChart = null;
    this.resizeObservers = [];
  }

  init(containers) {
    const initChartWithObserver = (container) => {
      if (!container) return null;
      const chart = echarts.init(container, 'dark');

      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
          if (container.clientWidth > 0 && container.clientHeight > 0) {
            chart.resize();
          }
        });
        ro.observe(container);
        this.resizeObservers.push(ro);
      }
      return chart;
    };

    if (containers.growth) this.networkGrowthChart = initChartWithObserver(containers.growth);
    if (containers.risk) this.stiRiskChart = initChartWithObserver(containers.risk);
    if (containers.longitudinal) this.longitudinalChart = initChartWithObserver(containers.longitudinal);
    if (containers.radar) this.topologyRadarChart = initChartWithObserver(containers.radar);
    if (containers.optimizer) this.optimizerChart = initChartWithObserver(containers.optimizer);

    window.addEventListener('resize', () => {
      this.resizeAll();
    });
  }

  resizeAll() {
    this.networkGrowthChart?.resize();
    this.stiRiskChart?.resize();
    this.longitudinalChart?.resize();
    this.topologyRadarChart?.resize();
    this.optimizerChart?.resize();
  }

  updateNetworkGrowth(metrics) {
    if (!this.networkGrowthChart) return;

    const degrees = metrics.theoreticalCountByDegree.map((_, i) => `Degree ${i}`);
    const counts = metrics.theoreticalCountByDegree;

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        confine: true,
        extraCssText: 'z-index: 99999 !important; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);',
        formatter: '{b}: <strong>{c} Theoretical Partners in Your Network</strong>'
      },
      grid: { left: '8%', right: '8%', bottom: '15%', top: '20%', containLabel: true },
      xAxis: {
        type: 'category',
        data: degrees,
        axisLine: { lineStyle: { color: '#64748b' } },
        axisLabel: { color: '#cbd5e1' }
      },
      yAxis: {
        type: 'log',
        logBase: 10,
        name: 'Nodes (Log Scale)',
        axisLine: { lineStyle: { color: '#64748b' } },
        splitLine: { lineStyle: { color: '#33415544' } },
        axisLabel: { color: '#cbd5e1' }
      },
      series: [
        {
          data: counts,
          type: 'bar',
          barWidth: '40%',
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#ff2a85' },
                { offset: 1, color: '#8a2be2' }
              ]
            },
            borderRadius: [6, 6, 0, 0]
          },
          label: {
            show: true,
            position: 'top',
            color: '#00f0ff',
            formatter: '{c}'
          }
        }
      ]
    };

    this.networkGrowthChart.setOption(option, true);
    this.networkGrowthChart.resize();
  }

  updateSTIRiskProfile(riskResults, categoryFilter = 'top', viewMode = 'protected', timeHorizonMonths = 1) {
    const dom = document.getElementById('chart-sti');
    if (!dom) return;

    let chart = echarts.getInstanceByDom(dom);
    if (!chart) {
      chart = echarts.init(dom, 'dark');
    } else if (chart.getWidth() === 0 && dom.clientWidth > 0) {
      chart.dispose();
      chart = echarts.init(dom, 'dark');
    }
    this.stiRiskChart = chart;

    if (!this.stiRiskChart || !riskResults || riskResults.length === 0) return;

    const horizon = Math.max(1, Number(timeHorizonMonths) || 1);
    const getHorizonLabel = (m) => {
      if (m === 12) return '1 Yr';
      if (m === 24) return '2 Yrs';
      if (m === 36) return '3 Yrs';
      if (m === 60) return '5 Yrs';
      if (m === 120) return '10 Yrs';
      return `${m} Mo`;
    };
    const horizonStr = getHorizonLabel(horizon);

    const scaleRisk = (pMonthlyPct) => {
      if (horizon === 1) return pMonthlyPct;
      const pMonthly = pMonthlyPct / 100;
      const pHorizon = 1 - Math.pow(1 - pMonthly, horizon);
      return Math.min(99.9, pHorizon * 100);
    };

    let filtered = [...riskResults];

    // 1. Sort descending by selected view mode risk metric FIRST
    if (viewMode === 'unprotected') {
      filtered.sort((a, b) => scaleRisk(b.monthlyRiskUnprotectedPct) - scaleRisk(a.monthlyRiskUnprotectedPct));
    } else if (viewMode === 'delta') {
      filtered.sort((a, b) => (scaleRisk(b.monthlyRiskUnprotectedPct) - scaleRisk(b.monthlyRiskProtectedPct)) - (scaleRisk(a.monthlyRiskUnprotectedPct) - scaleRisk(a.monthlyRiskProtectedPct)));
    } else {
      filtered.sort((a, b) => scaleRisk(b.monthlyRiskProtectedPct) - scaleRisk(a.monthlyRiskProtectedPct));
    }

    // 2. Filter pathogens by category
    if (categoryFilter === 'bacterial') {
      filtered = filtered.filter(s => {
        const cName = (s.category || '').toLowerCase();
        const name = (s.name || '').toLowerCase();
        return cName.includes('bacteri') || cName.includes('diplococcus') || cName.includes('spirochete') || cName.includes('protozo') || cName.includes('dysbiosis') || name.includes('chlamydia') || name.includes('syphilis') || name.includes('gonorrh') || name.includes('trich') || name.includes('mgen') || name.includes('ureaplasma') || name.includes('bv') || name.includes('chancroid') || name.includes('donovanosis');
      });
    } else if (categoryFilter === 'skin') {
      filtered = filtered.filter(s => {
        const cName = (s.category || '').toLowerCase();
        const name = (s.name || '').toLowerCase();
        return name.includes('hsv') || name.includes('hpv') || name.includes('mpox') || name.includes('bv') || name.includes('molluscum') || name.includes('scabies') || name.includes('lice') || name.includes('syphilis') || cName.includes('herpes') || cName.includes('papilloma') || cName.includes('pox') || cName.includes('parasit') || cName.includes('mite') || cName.includes('insect') || cName.includes('fungal');
      });
    } else if (categoryFilter === 'viral') {
      filtered = filtered.filter(s => {
        const cName = (s.category || '').toLowerCase();
        const name = (s.name || '').toLowerCase();
        return name.includes('hiv') || name.includes('hepatitis') || name.includes('hsv') || name.includes('hpv') || name.includes('mpox') || name.includes('ebv') || name.includes('cmv') || name.includes('htlv') || name.includes('zika') || name.includes('ebola') || cName.includes('virus') || cName.includes('retrovirus') || cName.includes('pox') || cName.includes('herpes');
      });
    }

    // 3. Slice top 8 items for Top Threats
    if (categoryFilter === 'top') {
      filtered = filtered.slice(0, 8);
    }

    // Map data for horizontal bars (reversed so highest risk is at top of y-axis)
    const items = [...filtered].reverse();
    const names = items.map(s => s.name);
    
    // Map items to color objects based on risk level
    const getItemColor = (val) => {
      if (val > 15) return { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#ff2a85' }, { offset: 1, color: '#e11d48' }] };
      if (val > 5) return { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#f59e0b' }, { offset: 1, color: '#d97706' }] };
      return { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#00f0ff' }] };
    };

    const getItemTextColor = (val) => {
      if (val > 15) return '#ff2a85';
      if (val > 5) return '#f59e0b';
      return '#00f0ff';
    };

    // Update Toolbar Badge Text for instant user visual feedback
    const badgeEl = document.getElementById('sti-profile-title-badge');
    if (badgeEl) {
      const modeNames = { protected: 'Protected', delta: 'Armor Delta', unprotected: 'Raw Baseline' };
      badgeEl.textContent = `📊 Displaying ${items.length} Pathogens (${modeNames[viewMode] || 'Protected'}) over:`;
    }

    const dynamicChartHeight = Math.max(220, items.length * 28 + 40);
    const chartEl = document.getElementById('chart-sti');
    if (chartEl) {
      chartEl.style.height = `${dynamicChartHeight}px`;
      this.stiRiskChart.resize();
    }

    const itemMap = {};
    items.forEach(it => {
      itemMap[it.name] = it;
    });

    let series = [];

    if (viewMode === 'unprotected') {
      const data = items.map(s => {
        const val = scaleRisk(s.monthlyRiskUnprotectedPct);
        return {
          value: Number(val.toFixed(2)),
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#ff2a85' }, { offset: 1, color: '#e11d48' }] },
            borderRadius: [0, 4, 4, 0]
          }
        };
      });
      series.push({
        id: 'series-unprotected',
        name: `Raw Baseline Risk (${horizonStr})`,
        type: 'bar',
        data: data,
        label: {
          show: true,
          position: 'right',
          color: '#ff2a85',
          formatter: '{c}%'
        }
      });
    } else if (viewMode === 'delta') {
      const protectedData = items.map(s => {
        const val = scaleRisk(s.monthlyRiskProtectedPct);
        return {
          value: Number(val.toFixed(2)),
          itemStyle: { color: getItemColor(val), borderRadius: [0, 0, 0, 0] }
        };
      });

      const blockedData = items.map(s => {
        const protVal = scaleRisk(s.monthlyRiskProtectedPct);
        const unprotVal = scaleRisk(s.monthlyRiskUnprotectedPct);
        const delta = Math.max(0, unprotVal - protVal);
        return {
          value: Number(delta.toFixed(2)),
          itemStyle: { color: 'rgba(16, 185, 129, 0.35)', borderRadius: [0, 4, 4, 0] }
        };
      });

      series.push(
        {
          id: 'series-protected-delta',
          name: `Protected Risk (${horizonStr})`,
          type: 'bar',
          stack: 'total',
          data: protectedData
        },
        {
          id: 'series-blocked-delta',
          name: `🛡️ Prophylactic Barrier (${horizonStr})`,
          type: 'bar',
          stack: 'total',
          data: blockedData,
          label: {
            show: true,
            position: 'right',
            color: '#10b981',
            formatter: (params) => {
              const rawName = names[params.dataIndex];
              const pathogen = itemMap[rawName];
              if (!pathogen) return '';
              const protVal = scaleRisk(pathogen.monthlyRiskProtectedPct);
              const unprotVal = scaleRisk(pathogen.monthlyRiskUnprotectedPct);
              const delta = Math.max(0, unprotVal - protVal);
              return `Blocked: -${delta.toFixed(1)}% (Base: ${unprotVal.toFixed(1)}%)`;
            }
          }
        }
      );
    } else {
      // Protected mode (Default)
      const data = items.map(s => {
        const val = scaleRisk(s.monthlyRiskProtectedPct);
        return {
          value: Number(val.toFixed(2)),
          itemStyle: { color: getItemColor(val), borderRadius: [0, 4, 4, 0] },
          labelTextColor: getItemTextColor(val)
        };
      });

      series.push({
        id: 'series-protected',
        name: `Protected Risk (${horizonStr})`,
        type: 'bar',
        data: data,
        label: {
          show: true,
          position: 'right',
          color: '#cbd5e1',
          formatter: (params) => `${params.value}%`
        }
      });
    }

    const option = {
      backgroundColor: 'transparent',
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        confine: true,
        position: function (point, params, dom, rect, size) {
          const contentWidth = size.contentSize[0];
          const contentHeight = size.contentSize[1];
          const viewWidth = size.viewSize[0];
          const viewHeight = size.viewSize[1];

          let x = point[0] + 15;
          let y = point[1] - 20;

          if (x + contentWidth > viewWidth - 10) {
            x = Math.max(10, point[0] - contentWidth - 15);
          }

          if (y + contentHeight > viewHeight - 10) {
            y = Math.max(10, point[1] - contentHeight - 15);
          }
          if (y < 10) y = 10;

          return [x, y];
        },
        extraCssText: 'z-index: 999999 !important; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 10px; padding: 10px 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.95); pointer-events: none;',
        formatter: (params) => {
          if (!params || params.length === 0) return '';
          const rawName = names[params[0].dataIndex];
          const pathogen = itemMap[rawName];
          if (!pathogen) return '';
          const protVal = scaleRisk(pathogen.monthlyRiskProtectedPct);
          const unprotVal = scaleRisk(pathogen.monthlyRiskUnprotectedPct);
          const prot = protVal < 0.01 && protVal > 0 ? protVal.toFixed(3) : protVal.toFixed(2);
          const unprot = unprotVal.toFixed(2);
          const blocked = Math.max(0, unprotVal - protVal).toFixed(2);

          let statusBadge = '';
          let qualDesc = '';

          if (protVal > 15) {
            statusBadge = '<span style="color: #ff2a85; font-weight: 800; background: rgba(255,42,133,0.15); padding: 2px 6px; border-radius: 4px;">⚠️ High Concern</span>';
            qualDesc = `High transmission probability over ${horizonStr}. Barrier methods, routine STI panels, or targeted biomedical armor (PrEP / Doxy-PEP) are strongly recommended.`;
          } else if (protVal > 5) {
            statusBadge = '<span style="color: #f59e0b; font-weight: 800; background: rgba(245,158,11,0.15); padding: 2px 6px; border-radius: 4px;">⚡ Moderate Risk</span>';
            qualDesc = `Moderate transmission likelihood over ${horizonStr}. Consider routine screening every 3 months and active partner status alignment.`;
          } else if (protVal >= 1) {
            statusBadge = '<span style="color: #10b981; font-weight: 800; background: rgba(16,185,129,0.15); padding: 2px 6px; border-radius: 4px;">🛡️ Low Risk</span>';
            qualDesc = `Low network exposure over ${horizonStr}. Standard preventive hygiene and periodic testing recommended.`;
          } else {
            statusBadge = '<span style="color: #38bdf8; font-weight: 800; background: rgba(56,189,248,0.15); padding: 2px 6px; border-radius: 4px;">💚 Minimal / Negligible</span>';
            qualDesc = `Minimal exposure over ${horizonStr} under current protection & network parameters.`;
          }

          const isCurable = pathogen.curable === 'Yes' || (typeof pathogen.curable === 'string' && pathogen.curable.includes('Curable'));
          return `
            <div style="font-size: 14px; font-weight: 800; color: #fff; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <span>${escapeHtml(pathogen.name)}</span>
              ${statusBadge}
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">
              ${escapeHtml(pathogen.category)} | ${isCurable ? '💊 Curable with Antibiotics' : '🛡️ Chronic / Managed Pathogen'}
            </div>
            <div style="font-size: 11px; color: #e2e8f0; font-style: italic; background: rgba(255,255,255,0.05); padding: 6px 8px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #00f0ff;">
              "${qualDesc}"
            </div>
            <div style="font-size: 12px; color: #00f0ff; margin-bottom: 2px;">
              • Protected Risk (${horizonStr} Horizon): <strong>${prot}%</strong>
            </div>
            <div style="font-size: 12px; color: #ff2a85; margin-bottom: 2px;">
              • Raw Baseline Risk (${horizonStr} Horizon): <strong>${unprot}%</strong>
            </div>
            <div style="font-size: 12px; color: #10b981; font-weight: 700; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
              🛡️ Prophylactic Barrier Avoided: <strong>-${blocked}%</strong>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
              💊 Primary Protocol: ${escapeHtml(pathogen.primaryTreatment || 'Standard Care')}
            </div>
          `;
        }
      },
      grid: { left: '3%', right: '14%', bottom: '30px', top: '4px', containLabel: true },
      xAxis: {
        type: 'value',
        name: `${horizonStr} Risk (%)`,
        nameLocation: 'end',
        nameTextStyle: { color: '#cbd5e1', fontSize: 11 },
        min: 0,
        max: 100,
        axisLine: { lineStyle: { color: '#334155' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLabel: { color: '#94a3b8', formatter: '{value}%' }
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: {
          color: '#e2e8f0',
          fontSize: 11,
          formatter: (value) => value.length > 24 ? value.slice(0, 22) + '...' : value
        }
      },
      series: series
    };

    const calculatedHeight = Math.max(260, items.length * 28);
    dom.style.height = `${calculatedHeight}px`;

    this.stiRiskChart.clear();
    this.stiRiskChart.setOption(option, true);
    this.stiRiskChart.resize();
    requestAnimationFrame(() => {
      if (this.stiRiskChart) this.stiRiskChart.resize();
    });
  }

  updateLongitudinalProjection(longitudinalData) {
    if (!this.longitudinalChart) return;

    const series = longitudinalData.series.map(s => ({
      name: s.name,
      type: 'line',
      smooth: true,
      data: s.data,
      lineStyle: { width: s.name.includes('HIV') ? 3 : 2 }
    }));

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        confine: true,
        extraCssText: 'z-index: 99999 !important; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 8px;',
        formatter: (params) => {
          let html = `<strong>${params[0].name}</strong><br/>`;
          params.forEach(p => {
            html += `${p.marker} ${p.seriesName}: <strong>${p.value.toFixed(2)}%</strong><br/>`;
          });
          return html;
        }
      },
      legend: {
        data: longitudinalData.series.map(s => s.name),
        textStyle: { color: '#cbd5e1', fontSize: 10 },
        type: 'scroll',
        top: 0
      },
      grid: { left: '5%', right: '8%', bottom: '15%', top: '28%', containLabel: true },
      xAxis: {
        type: 'category',
        data: longitudinalData.labels,
        axisLine: { lineStyle: { color: '#64748b' } }
      },
      yAxis: {
        type: 'value',
        name: 'Your Cumulative Exposure Risk %',
        max: 100,
        splitLine: { lineStyle: { color: '#33415544' } }
      },
      series: series
    };

    this.longitudinalChart.setOption(option, true);
    this.longitudinalChart.resize();
  }

  updateLongitudinalRisk(longitudinalData) {
    this.updateLongitudinalProjection(longitudinalData);
  }

  updateTopologyRadar(metrics, params) {
    if (!this.topologyRadarChart) return;

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        confine: true,
        extraCssText: 'z-index: 99999 !important; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255, 42, 133, 0.3); border-radius: 8px;'
      },
      radar: {
        indicator: [
          { name: 'Your Sluttiness Index', max: 100 },
          { name: 'Your Ingroup Density', max: 100 },
          { name: 'Your Condom Barrier %', max: 100 },
          { name: 'Cheating Risk Vulnerability', max: 100 },
          { name: 'Your Network Reach Depth', max: 100 }
        ],
        splitArea: {
          areaStyle: {
            color: ['#1e293b55', '#0f172a88']
          }
        },
        axisLine: { lineStyle: { color: '#475569' } },
        splitLine: { lineStyle: { color: '#334155' } }
      },
      series: [
        {
          name: 'Your Network Topology Profile',
          type: 'radar',
          data: [
            {
              value: [
                Math.round(params.sluttinessIndex * 100),
                Math.round((1 - params.sluttinessIndex) * 100),
                Math.round(params.condomUsageExternal * 100),
                Math.round(params.cheatingLikelihood),
                Math.min(100, params.nDegrees * 20)
              ],
              name: 'Your Current Network State',
              itemStyle: { color: '#ff2a85' },
              areaStyle: { color: '#ff2a8533' }
            }
          ]
        }
      ]
    };

    this.topologyRadarChart.setOption(option, true);
    this.topologyRadarChart.resize();
  }

  updateHedonicFrontier(results) {
    const emptyState = document.getElementById('optimizer-empty-state');
    const chartContainer = document.getElementById('chart-optimizer');

    if (!results || !results.paretoFrontier || results.paretoFrontier.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      if (chartContainer) chartContainer.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (chartContainer) chartContainer.style.display = 'block';

    if (!this.optimizerChart) return;

    const data = results.paretoFrontier.map(item => [
      item.maxBacterialRiskPct,
      item.hedonicScore,
      item.totalMonthlyActs,
      item.params.polyculePct
    ]);

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        extraCssText: 'z-index: 99999 !important; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px;',
        formatter: (params) => {
          const [risk, score, acts, poly] = params.value;
          return `<strong>Hedonic Score: ${score}</strong><br/>` +
                 `Monthly Bacterial Risk: <strong>${risk.toFixed(2)}%</strong><br/>` +
                 `Total Monthly Acts: <strong>${acts}</strong><br/>` +
                 `Polycule Ingroup: <strong>${poly}%</strong>`;
        }
      },
      grid: { left: '8%', right: '8%', bottom: '15%', top: '15%', containLabel: true },
      xAxis: {
        type: 'value',
        name: 'Max Monthly Bacterial Risk %',
        axisLine: { lineStyle: { color: '#64748b' } },
        splitLine: { lineStyle: { color: '#33415544' } }
      },
      yAxis: {
        type: 'value',
        name: 'Hedonic Intimacy Score',
        axisLine: { lineStyle: { color: '#64748b' } },
        splitLine: { lineStyle: { color: '#33415544' } }
      },
      series: [
        {
          type: 'scatter',
          symbolSize: (val) => Math.max(8, Math.min(26, val[2] / 2)),
          data: data,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#10b981' },
                { offset: 1, color: '#06b6d4' }
              ]
            },
            opacity: 0.85
          }
        }
      ]
    };

    this.optimizerChart.setOption(option, true);
    this.optimizerChart.resize();
  }
}
