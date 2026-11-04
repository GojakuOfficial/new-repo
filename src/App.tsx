import React, { useState, useEffect, useRef, useCallback } from 'react';
import { gsap, useGSAP } from './motion/gsap';
import { CityState, LogEntry, MetricComparison } from './types/city';
import { ProtocolType } from './types/game';
import {
  getInitialState,
  stepSimulation,
  cloneMetrics,
  formatClockTime,
  getRecommendations,
} from './utils/simulation';
import {
  OPTIMIZATION_RULES,
  EMERGENCIES,
  PRESETS,
  clamp,
  roundVal,
} from './data/cityData';

import { Navigation } from './components/Navigation';
import { HeroSection } from './components/HeroSection';
import { CrisisCommanderGame } from './components/CrisisCommanderGame';
import { City3DSection } from './components/City3DSection';
import { ProtocolDeepDive } from './components/ProtocolDeepDive';
import { VisionSection } from './components/VisionSection';
import { SystemsShowcase } from './components/SystemsShowcase';
import { FutureSimulator } from './components/FutureSimulator';
import { OperationsSuite } from './components/OperationsSuite';
import { Epilogue } from './components/Epilogue';

export const App: React.FC = () => {
  const appRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const motion = gsap.matchMedia();
    motion.add('(prefers-reduced-motion: no-preference)', () => {
      const root = appRef.current;
      if (!root) return;

      const hero = root.querySelector<HTMLElement>('#hero');
      if (hero) {
        gsap.timeline({ defaults: { ease: 'power3.out' } })
          .from(hero.querySelector('.hero-eyebrow-capsule'), { y: 18, autoAlpha: 0, duration: 0.8 })
          .from(hero.querySelector('.hero-massive-headline'), { yPercent: 24, autoAlpha: 0, duration: 1.05 }, '-=0.35')
          .from(hero.querySelector('.hero-cinematic-sub'), { y: 20, autoAlpha: 0, duration: 0.8 }, '-=0.55')
          .from(hero.querySelectorAll('.hero-buttons-row > *'), { y: 16, autoAlpha: 0, duration: 0.65, stagger: 0.12 }, '-=0.35')
          .from(hero.querySelectorAll('.htb-item'), { y: 14, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, '-=0.2');
        const grid = hero.querySelector('.hero-grid-lines');
        if (grid) gsap.to(grid, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.7 } });
      }

      const sections = gsap.utils.toArray<HTMLElement>(
        'main > .page-section, main > section.page-section, main > .epilogue-section, main > section.epilogue-section', root
      );
      sections.forEach(section => {
        if (section.id === 'hero') return;
        const lead = section.querySelectorAll('.section-eyebrow, .section-heading-lg, .section-subtext');
        if (lead.length) gsap.from(lead, {
          y: 30, autoAlpha: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 78%', once: true },
        });

        const feature = section.querySelectorAll(
          '.bento-card, .protocol-showcase-container, .system-panel, .city-3d-wrapper, .operations-dashboard, .commander-viewport-frame, .epilogue-card'
        );
        if (feature.length) gsap.from(feature, {
          y: 38, scale: 0.985, autoAlpha: 0, duration: 1, stagger: 0.14, ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 72%', once: true },
        });

        const tabs = section.querySelectorAll('.protocol-pill-tab');
        if (tabs.length) gsap.from(tabs, {
          y: 18, autoAlpha: 0, duration: 0.65, stagger: 0.08, ease: 'power2.out',
          scrollTrigger: { trigger: section, start: 'top 66%', once: true },
        });
      });

      const navItems = root.querySelectorAll('.nexus-nav .nav-link, .nexus-nav .nav-cta-btn');
      if (navItems.length) gsap.from(navItems, { y: -8, autoAlpha: 0, duration: 0.55, stagger: 0.06, delay: 0.2, ease: 'power2.out' });

      const interactive = root.querySelectorAll<HTMLElement>(
        'button, .bento-card, .protocol-showcase-container, .system-details-card, .epilogue-card'
      );
      const cleanups: Array<() => void> = [];
      interactive.forEach(element => {
        const enter = () => gsap.to(element, { y: element.matches('button') ? -2 : -4, duration: 0.24, ease: 'power2.out', overwrite: 'auto' });
        const leave = () => gsap.to(element, { y: 0, duration: 0.32, ease: 'power2.out', overwrite: 'auto' });
        element.addEventListener('pointerenter', enter);
        element.addEventListener('pointerleave', leave);
        cleanups.push(() => { element.removeEventListener('pointerenter', enter); element.removeEventListener('pointerleave', leave); });
      });
      return () => cleanups.forEach(cleanup => cleanup());
    });
    return () => motion.revert();
  }, { scope: appRef });
  const [cityState, setCityState] = useState<CityState>(getInitialState);
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType | null>('energy');

  // Sparkline history buffers
  const [history, setHistory] = useState<Record<string, number[]>>({
    traffic: [89.4],
    renewable: [18.2],
    water: [12.5],
    aqi: [218],
    demand: [94.6],
  });

  // Decision Log
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'log-init-1',
      time: formatClockTime(new Date()),
      severity: 'warning',
      tag: 'SYSTEM',
      title: 'Crisis Baseline Loaded',
      detail: 'Metropolitan simulation initialized in elevated crisis baseline for demonstration purposes.',
    },
    {
      id: 'log-init-2',
      time: formatClockTime(new Date()),
      severity: 'critical',
      tag: 'RULE-TRAFFIC-01',
      title: 'Traffic Congestion Critical',
      detail: 'Traffic congestion at 89.4% exceeds the 65% threshold.',
    },
    {
      id: 'log-init-3',
      time: formatClockTime(new Date()),
      severity: 'critical',
      tag: 'RULE-AQI-04',
      title: 'Severe Particulate Spike',
      detail: 'AQI at 218 exceeds the 150 threshold for poor air quality.',
    },
  ]);

  // Operations Active Tab
  const [activeOpsTab, setActiveOpsTab] = useState<string>('metrics');

  // Optimization comparison
  const [comparisonData, setComparisonData] = useState<{
    before: MetricComparison;
    after: MetricComparison;
    title: string;
  } | null>(null);

  // Helper to add log entries
  const addLog = useCallback(
    (severity: 'good' | 'warning' | 'critical' | 'info', tag: string, title: string, detail: string) => {
      const newEntry: LogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        time: formatClockTime(new Date()),
        severity,
        tag,
        title,
        detail,
      };
      setLogs(prev => [newEntry, ...prev.slice(0, 199)]);
    },
    []
  );

  // Live simulation ticker (runs every 1000ms)
  useEffect(() => {
    const interval = setInterval(() => {
      setCityState(prev => {
        const next = stepSimulation(prev);

        // Update history if running
        if (prev.simRunning) {
          setHistory(h => {
            const nextH: Record<string, number[]> = {};
            (['traffic', 'renewable', 'water', 'aqi', 'demand'] as const).forEach(key => {
              const arr = [...(h[key] || []), next.metrics[key]];
              if (arr.length > 40) arr.shift();
              nextH[key] = arr;
            });
            return nextH;
          });
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Sync recommendation events with logs
  const lastRecIdsRef = useRef<Set<string>>(new Set());
  const trackingInitRef = useRef<boolean>(false);

  useEffect(() => {
    const recs = getRecommendations(cityState).filter(
      r => r.id !== 'SYSTEM-NOMINAL' && r.id !== 'EMERGENCY-ACTIVE'
    );
    const currentIds = new Set(recs.map(r => r.id));

    if (!trackingInitRef.current) {
      lastRecIdsRef.current = currentIds;
      trackingInitRef.current = true;
      return;
    }

    recs.forEach(r => {
      if (!lastRecIdsRef.current.has(r.id)) {
        addLog(r.severity, r.id, 'Condition Detected', `${r.title} — ${r.detail}`);
      }
    });

    lastRecIdsRef.current.forEach(id => {
      if (!currentIds.has(id)) {
        const rule = OPTIMIZATION_RULES.find(r => r.id === id);
        addLog('info', id, 'Condition Resolved', `${rule ? rule.title : id} no longer detected — metric is back within threshold.`);
      }
    });

    lastRecIdsRef.current = currentIds;
  }, [cityState, addLog]);

  // Actions
  const handleToggleSim = () => {
    setCityState(prev => {
      const nextSim = !prev.simRunning;
      addLog(
        'info',
        'SIMULATION',
        nextSim ? 'Simulation Resumed' : 'Simulation Paused',
        nextSim ? 'Autonomous time drift and sensor jitter active.' : 'City state paused.'
      );
      return { ...prev, simRunning: nextSim };
    });
  };

  const handleReset = () => {
    const initial = getInitialState();
    setCityState(initial);
    setComparisonData(null);
    addLog(
      'critical',
      'SYSTEM',
      'City Reset to Crisis Baseline',
      'Loaded high-congestion, stressed-grid baseline for demo purposes.'
    );
  };

  const handleUpdateTimeOfDay = (time: number) => {
    setCityState(prev => ({ ...prev, timeOfDay: time, autoTime: false }));
  };

  const handleToggleAutoTime = () => {
    setCityState(prev => ({ ...prev, autoTime: !prev.autoTime }));
  };

  const handleOptimizeCity = () => {
    setCityState(prev => {
      const before = cloneMetrics(prev);
      const next = {
        ...prev,
        metrics: { ...prev.metrics },
        budgets: { ...prev.budgets },
      };

      let appliedAny = false;

      OPTIMIZATION_RULES.forEach(rule => {
        if (!rule.condition(next)) return;
        appliedAny = true;
        const detectMsg = rule.detect(next);

        if (next.budgets.infra <= 0) {
          addLog(
            'warning',
            rule.id,
            `${rule.title} — Skipped`,
            `${detectMsg} No infrastructure budget remains.`
          );
          return;
        }

        let factor = 1;
        let partialNote = '';
        if (next.budgets.infra < rule.cost) {
          factor = next.budgets.infra / rule.cost;
          partialNote = ` Applied partially (${Math.round(factor * 100)}%) — only ${roundVal(
            next.budgets.infra
          )} of ${rule.cost} units available.`;
        }

        const spend = Math.min(rule.cost, next.budgets.infra);
        next.budgets.infra = clamp(next.budgets.infra - spend, 0, next.budgets.infraMax);
        rule.apply(next, factor);

        addLog(
          rule.severity,
          rule.id,
          rule.title,
          `${detectMsg} Spent ${roundVal(spend)} infrastructure budget.${partialNote}`
        );
      });

      if (!appliedAny) {
        addLog(
          'good',
          'SYSTEM',
          'No Action Needed',
          'All monitored metrics are within healthy thresholds — optimization was not required.'
        );
      }

      const after = cloneMetrics(next);
      setComparisonData({ before, after, title: 'City Optimization' });
      setActiveOpsTab('optimize');

      return next;
    });
  };

  const handleTriggerEmergency = (id: string) => {
    setCityState(prev => {
      if (prev.activeEmergency) {
        const activeLabel = EMERGENCIES[prev.activeEmergency.id]?.label || 'Crisis';
        addLog(
          'warning',
          'SYSTEM',
          'Emergency Already Active',
          `Cannot trigger ${EMERGENCIES[id]?.label}: resolve active ${activeLabel} first.`
        );
        return prev;
      }

      const em = EMERGENCIES[id];
      if (!em) return prev;

      const next = {
        ...prev,
        metrics: { ...prev.metrics },
        budgets: { ...prev.budgets },
      };
      em.trigger(next);
      next.activeEmergency = { id, startedTick: prev.tick };

      addLog('critical', id.toUpperCase(), `${em.label} Detected`, em.description);
      return next;
    });
  };

  const handleDeployEmergencyResponse = () => {
    setCityState(prev => {
      if (!prev.activeEmergency) return prev;
      const em = EMERGENCIES[prev.activeEmergency.id];
      if (!em) return prev;

      const before = cloneMetrics(prev);

      if (prev.budgets.response <= 0) {
        addLog(
          'warning',
          em.id.toUpperCase(),
          'Response Blocked',
          'No Emergency Response Capacity remains — wait for budget recovery.'
        );
        return prev;
      }

      const next = {
        ...prev,
        metrics: { ...prev.metrics },
        budgets: { ...prev.budgets },
      };

      let factor = 1;
      let partialNote = '';
      if (next.budgets.response < em.responseCost) {
        factor = next.budgets.response / em.responseCost;
        partialNote = ` (partial response — ${Math.round(factor * 100)}% effect)`;
      }

      const spend = Math.min(em.responseCost, next.budgets.response);
      next.budgets.response = clamp(next.budgets.response - spend, 0, next.budgets.responseMax);
      em.response(next, factor);
      next.activeEmergency = null;

      const after = cloneMetrics(next);
      addLog(
        'good',
        em.id.toUpperCase(),
        em.responseTitle,
        `Deployed in response to ${em.label}${partialNote}. Spent ${roundVal(spend)} capacity.`
      );

      setComparisonData({ before, after, title: `${em.label} Response` });
      return next;
    });
  };

  const handleApplyScenario = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    setCityState(prev => ({
      ...prev,
      temperature: preset.temperature,
      metrics: { ...preset.metrics },
      hospitalLoad: preset.hospitalLoad,
      activeEmergency: null,
      budgets: {
        ...prev.budgets,
        infra: prev.budgets.infraMax,
        response: prev.budgets.responseMax,
      },
    }));

    setComparisonData(null);
    addLog('info', 'SCENARIO', preset.label, `Preset loaded — ${preset.blurb}`);
  };

  const handleScrollToGame = () => {
    const el = document.getElementById('game-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScrollToCity = () => {
    const el = document.getElementById('city3d-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="nexus-app" ref={appRef}>
      {/* 1. Frosted Navigation Bar */}
      <Navigation
        simRunning={cityState.simRunning}
        onToggleSim={handleToggleSim}
        onReset={handleReset}
        onLaunchGame={handleScrollToGame}
      />

      <main>
        {/* 1. Hero: Introduce LUMINA CITY */}
        <HeroSection state={cityState} onLaunchGame={handleScrollToGame} />

        {/* 2. Vision: Explain intelligent sustainable city */}
        <VisionSection />

        {/* 3. Explore the City: Interactive 3D Digital Twin */}
        <City3DSection
          state={cityState}
          onUpdateTimeOfDay={handleUpdateTimeOfDay}
          onToggleAutoTime={handleToggleAutoTime}
          selectedProtocol={selectedProtocol}
          onSelectProtocol={setSelectedProtocol}
        />

        {/* 4. AI Protocols: Five protocols with 3D map interaction */}
        <ProtocolDeepDive
          selectedProtocol={selectedProtocol || undefined}
          onSelectProtocol={setSelectedProtocol}
        />

        {/* 5. Connected Systems: Architecture, Simulator, Operations */}
        <SystemsShowcase onSelectOpsTab={setActiveOpsTab} />
        <FutureSimulator state={cityState} />
        <OperationsSuite
          state={cityState}
          history={history}
          logs={logs}
          activeOpsTab={activeOpsTab}
          onSelectOpsTab={setActiveOpsTab}
          onOptimizeCity={handleOptimizeCity}
          onTriggerEmergency={handleTriggerEmergency}
          onDeployEmergencyResponse={handleDeployEmergencyResponse}
          onApplyScenario={handleApplyScenario}
          onClearLogs={() => setLogs([])}
          comparisonData={comparisonData}
        />

        {/* 6. Experience Lumina City: Optional Playable Game */}
        <section id="game-section" className="page-section" style={{ paddingTop: '3rem', borderTop: '1px solid var(--border)' }}>
          <div className="container">
            <div className="section-eyebrow">OPTIONAL INTERACTIVE EXPERIENCE</div>
            <h2 className="section-heading-lg">Experience Lumina City: Crisis Commander.</h2>
            <p className="section-subtext">
              An optional interactive adventure set inside the same living 3D city. Launch the simulation below to explore streets, monitor telemetry, and solve engineering challenges.
            </p>

            <CrisisCommanderGame onExploreCity={handleScrollToCity} />
          </div>
        </section>

        {/* 7. Closing Section: Epilogue */}
        <Epilogue onOpenGame={handleScrollToGame} />
      </main>
    </div>
  );
};
